// Aggregates Apple Health "export.xml" records into daily summaries.
// The parser is line based so very large exports can be streamed (see main process).

import { DailyHealth } from './types';
import { addDays } from './dates';
import { maxHeartRate } from './scoring';

interface DayAcc {
  rhr: number[];
  hrv: number[];
  resp: number[];
  hr: { t: number; v: number }[];
  steps: number;
  activeKcal: number;
  deep: number;
  rem: number;
  core: number;
  awake: number;
  inBed: number;
  firstSleepStart: number | null;
}

const ATTR = /(\w+)="([^"]*)"/g;

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(line))) out[m[1]] = m[2];
  return out;
}

/** "2024-03-02 07:15:00 +0100" -> local Date (offset honoured). */
function parseAppleDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}${m[8]}:${m[9]}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class AppleHealthAggregator {
  private days = new Map<string, DayAcc>();
  records = 0;
  used = 0;

  private day(date: string): DayAcc {
    let d = this.days.get(date);
    if (!d) {
      d = { rhr: [], hrv: [], resp: [], hr: [], steps: 0, activeKcal: 0, deep: 0, rem: 0, core: 0, awake: 0, inBed: 0, firstSleepStart: null };
      this.days.set(date, d);
    }
    return d;
  }

  /** Feed one line of export.xml. */
  line(line: string): void {
    const idx = line.indexOf('<Record ');
    if (idx < 0) return;
    const a = attrs(line.slice(idx));
    const type = a.type;
    if (!type) return;
    const start = parseAppleDate(a.startDate ?? '');
    const end = parseAppleDate(a.endDate ?? '') ?? start;
    if (!start || !end) return;
    this.add(type, start, end, a.value ?? '', a.unit);
  }

  /**
   * Feed one HealthKit sample (used by the XML parser and by live HealthKit reads on iPhone).
   * `rawValue` is the quantity, or for sleep the category name ending in e.g. "AsleepDeep".
   */
  add(type: string, start: Date, end: Date, rawValue: string | number, unit?: string): void {
    const a = { value: String(rawValue), unit };
    this.records++;
    const value = Number(rawValue);
    const date = localISO(start);
    switch (type) {
      case 'HKQuantityTypeIdentifierRestingHeartRate':
        this.day(date).rhr.push(value);
        break;
      case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
        this.day(date).hrv.push(value);
        break;
      case 'HKQuantityTypeIdentifierRespiratoryRate':
        this.day(date).resp.push(value);
        break;
      case 'HKQuantityTypeIdentifierHeartRate':
        this.day(date).hr.push({ t: start.getTime(), v: value });
        break;
      case 'HKQuantityTypeIdentifierStepCount':
        this.day(date).steps += value;
        break;
      case 'HKQuantityTypeIdentifierActiveEnergyBurned':
        this.day(date).activeKcal += a.unit === 'kJ' ? value / 4.184 : value;
        break;
      case 'HKCategoryTypeIdentifierSleepAnalysis': {
        // A night belongs to the date it ends on.
        const night = this.day(localISO(end));
        const min = (end.getTime() - start.getTime()) / 60000;
        const v = a.value ?? '';
        if (v.endsWith('AsleepDeep')) night.deep += min;
        else if (v.endsWith('AsleepREM')) night.rem += min;
        else if (v.endsWith('AsleepCore') || v.endsWith('AsleepUnspecified') || v.endsWith('Asleep')) night.core += min;
        else if (v.endsWith('Awake')) night.awake += min;
        else if (v.endsWith('InBed')) night.inBed += min;
        else break;
        if (!v.endsWith('InBed')) {
          const s = start.getTime();
          if (night.firstSleepStart == null || s < night.firstSleepStart) night.firstSleepStart = s;
        }
        break;
      }
      default:
        return;
    }
    this.used++;
  }

  /** Builds daily summaries. Heart-rate samples become zone minutes using the gap to the next sample (max 10 min). */
  result(age: number): DailyHealth[] {
    const hrMax = maxHeartRate(age);
    const out: DailyHealth[] = [];
    const med = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    for (const [date, d] of this.days) {
      const zoneMin: DailyHealth['zoneMin'] = [0, 0, 0, 0, 0];
      const hr = d.hr.sort((a, b) => a.t - b.t);
      let maxHr: number | null = null;
      let sum = 0;
      for (let i = 0; i < hr.length; i++) {
        const gap = i + 1 < hr.length ? Math.min(10, (hr[i + 1].t - hr[i].t) / 60000) : 1;
        const pct = hr[i].v / hrMax;
        const z: number = pct >= 0.9 ? 4 : pct >= 0.8 ? 3 : pct >= 0.7 ? 2 : pct >= 0.6 ? 1 : pct >= 0.5 ? 0 : -1;
        if (z >= 0) zoneMin[z] += gap;
        maxHr = maxHr == null ? hr[i].v : Math.max(maxHr, hr[i].v);
        sum += hr[i].v;
      }
      const asleep = d.deep + d.rem + d.core;
      let sleep: DailyHealth['sleep'] = null;
      if (asleep > 60) {
        let bedtimeMin = 0;
        if (d.firstSleepStart != null) {
          const st = new Date(d.firstSleepStart);
          const startDate = localISO(st);
          const mins = st.getHours() * 60 + st.getMinutes();
          bedtimeMin = startDate === date ? mins : startDate === addDays(date, -1) ? mins - 1440 : 0;
        }
        sleep = {
          deepMin: Math.round(d.deep),
          remMin: Math.round(d.rem),
          coreMin: Math.round(d.core),
          awakeMin: Math.round(d.awake),
          inBedMin: Math.round(Math.max(d.inBed, asleep + d.awake)),
          bedtimeMin,
        };
      }
      const hasAnything = d.rhr.length || d.hrv.length || hr.length || d.steps || sleep;
      if (!hasAnything) continue;
      out.push({
        date,
        restingHr: med(d.rhr),
        hrv: d.hrv.length ? Math.round(d.hrv.reduce((a, b) => a + b, 0) / d.hrv.length) : null,
        respRate: d.resp.length ? Math.round((d.resp.reduce((a, b) => a + b, 0) / d.resp.length) * 10) / 10 : null,
        avgHr: hr.length ? Math.round(sum / hr.length) : null,
        maxHr: maxHr != null ? Math.round(maxHr) : null,
        steps: Math.round(d.steps),
        activeKcal: Math.round(d.activeKcal),
        zoneMin: zoneMin.map((m) => Math.round(m)) as DailyHealth['zoneMin'],
        sleep,
        source: 'apple-health-import',
      });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Merges imported days over existing ones (imported data replaces demo data for the same date, never manual entries). */
export function mergeHealth(existing: DailyHealth[], incoming: DailyHealth[]): { health: DailyHealth[]; changed: number } {
  const byDate = new Map(existing.map((d) => [d.date, d] as const));
  let changed = 0;
  for (const d of incoming) {
    const cur = byDate.get(d.date);
    if (cur && cur.source === 'manual') continue;
    byDate.set(d.date, d);
    changed++;
  }
  return { health: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)), changed };
}
