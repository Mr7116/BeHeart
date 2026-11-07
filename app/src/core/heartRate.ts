// Live heart rate: Bluetooth Heart Rate Measurement parsing, zone maths, live-session totals and
// recognising which watch brand wrote data into Apple Health. Pure functions, shared by every platform.
import type { DailyHealth, LiveSession } from './types';
import { maxHeartRate } from './scoring';
import { toISODate } from './dates';

/** Bluetooth SIG Heart Rate service and its Heart Rate Measurement characteristic. */
export const HR_SERVICE = '180d';
export const HR_MEASUREMENT = '2a37';
export const BATTERY_SERVICE = '180f';
export const BATTERY_LEVEL = '2a19';

/** True when a (16- or 128-bit) Bluetooth UUID is the given 16-bit one. */
export function sameUuid(uuid: string, short16: string): boolean {
  const u = uuid.toLowerCase();
  const s = short16.toLowerCase();
  return u === s || u === `0000${s}-0000-1000-8000-00805f9b34fb`;
}

export interface HeartRateMeasurement {
  bpm: number;
  /** Sensor contact, when the sensor reports it. */
  contact: boolean | null;
  /** Beat-to-beat (RR) intervals in milliseconds. */
  rrMs: number[];
  energyKj: number | null;
}

/** Decodes a Heart Rate Measurement (0x2A37) notification. Returns null for malformed packets. */
export function parseHeartRateMeasurement(bytes: ArrayLike<number>): HeartRateMeasurement | null {
  if (!bytes || bytes.length < 2) return null;
  const flags = bytes[0];
  let i = 1;
  let bpm: number;
  if (flags & 0x01) {
    if (bytes.length < 3) return null;
    bpm = bytes[i] | (bytes[i + 1] << 8);
    i += 2;
  } else {
    bpm = bytes[i];
    i += 1;
  }
  const contactSupported = (flags & 0x04) !== 0;
  const contact = contactSupported ? (flags & 0x02) !== 0 : null;
  let energyKj: number | null = null;
  if (flags & 0x08) {
    if (bytes.length < i + 2) return null;
    energyKj = bytes[i] | (bytes[i + 1] << 8);
    i += 2;
  }
  const rrMs: number[] = [];
  if (flags & 0x10) {
    for (; i + 1 < bytes.length; i += 2) rrMs.push(Math.round(((bytes[i] | (bytes[i + 1] << 8)) * 1000) / 1024));
  }
  if (bpm <= 0 || bpm > 250) return null;
  return { bpm, contact, rrMs, energyKj };
}

/** Heart-rate zone 0..4 (zones 1–5 at 50/60/70/80/90 % of max HR), or -1 below zone 1. */
export function zoneIndex(bpm: number, maxHr: number): number {
  const tenths = Math.floor((bpm * 10) / maxHr + 1e-9); // 5 = 50 %, 6 = 60 % …
  if (tenths < 5) return -1;
  return Math.min(4, tenths - 5);
}

/** Running totals for a live recording. Feed it one reading at a time. */
export class SessionRecorder {
  readonly startedAt: number;
  private last: { bpm: number; at: number } | null = null;
  private zoneSec = [0, 0, 0, 0, 0];
  private sum = 0;
  private secs = 0;
  max = 0;
  constructor(
    private readonly maxHr: number,
    now = Date.now(),
  ) {
    this.startedAt = now;
  }
  add(bpm: number, at = Date.now()) {
    if (this.last) {
      // Credit the time since the last reading to the previous value; ignore gaps over 30 s (lost signal).
      const dt = Math.min(30, Math.max(0, (at - this.last.at) / 1000));
      const z = zoneIndex(this.last.bpm, this.maxHr);
      if (z >= 0) this.zoneSec[z] += dt;
      this.sum += this.last.bpm * dt;
      this.secs += dt;
    }
    this.last = { bpm, at };
    this.max = Math.max(this.max, bpm);
  }
  get avg(): number {
    return this.secs ? Math.round(this.sum / this.secs) : this.last?.bpm ?? 0;
  }
  get zoneMin(): [number, number, number, number, number] {
    return this.zoneSec.map((s) => Math.round((s / 60) * 10) / 10) as [number, number, number, number, number];
  }
  finish(source: string, via: LiveSession['via'], end = Date.now()): LiveSession {
    return {
      id: `live-${this.startedAt}`,
      start: new Date(this.startedAt).toISOString(),
      end: new Date(end).toISOString(),
      source,
      via,
      avgHr: this.avg,
      maxHr: this.max,
      zoneMin: this.zoneMin,
    };
  }
}

/** Adds a finished live session's zone minutes and peak HR to that day's record (creating one if needed). */
export function applySessionToDay(health: DailyHealth[], session: LiveSession, date: string): DailyHealth[] {
  const cur = health.find((d) => d.date === date);
  const base: DailyHealth = cur ?? {
    date,
    restingHr: null,
    hrv: null,
    respRate: null,
    avgHr: null,
    maxHr: null,
    steps: 0,
    activeKcal: 0,
    zoneMin: [0, 0, 0, 0, 0],
    sleep: null,
    source: 'manual',
  };
  const next: DailyHealth = {
    ...base,
    zoneMin: base.zoneMin.map((z, i) => Math.round((z + session.zoneMin[i]) * 10) / 10) as DailyHealth['zoneMin'],
    maxHr: Math.max(base.maxHr ?? 0, session.maxHr) || null,
  };
  return [...health.filter((d) => d.date !== date), next].sort((a, b) => a.date.localeCompare(b.date));
}

/** Local date a session belongs to. */
export function sessionDate(s: LiveSession): string {
  return toISODate(new Date(s.start));
}

/**
 * After an Apple Health sync replaced some days, adds Bluetooth sessions back onto those days
 * (Bluetooth readings never reach Apple Health, so the synced day doesn't include them).
 */
export function reapplyBluetoothSessions(health: DailyHealth[], sessions: LiveSession[] | undefined, replacedDates: Set<string>): DailyHealth[] {
  let out = health;
  for (const s of sessions ?? []) {
    const d = sessionDate(s);
    if (s.via === 'bluetooth' && replacedDates.has(d)) out = applySessionToDay(out, s, d);
  }
  return out;
}

export type WatchBrand = 'apple-watch' | 'iphone' | 'garmin' | 'fitbit' | 'huawei' | 'samsung' | 'amazfit' | 'xiaomi' | 'polar' | 'coros' | 'suunto' | 'whoop' | 'oura' | 'withings' | 'wahoo' | 'other';

const BRANDS: [WatchBrand, RegExp][] = [
  ['garmin', /garmin/i],
  ['fitbit', /fitbit/i],
  ['huawei', /huawei|honor/i],
  ['samsung', /samsung|galaxy/i],
  ['amazfit', /amazfit|zepp|huami/i],
  ['xiaomi', /xiaomi|mi fit|mi band|mifit|redmi/i],
  ['polar', /polar/i],
  ['coros', /coros/i],
  ['suunto', /suunto/i],
  ['whoop', /whoop/i],
  ['oura', /oura/i],
  ['withings', /withings/i],
  ['wahoo', /wahoo|tickr/i],
];

/** Guesses the brand behind an Apple Health source or a Bluetooth device name. */
export function identifyBrand(name: string, bundleId = '', productType = ''): WatchBrand {
  if (/^Watch\d/i.test(productType) || /watch/i.test(name) && /apple|com\.apple/i.test(bundleId + name)) return 'apple-watch';
  for (const [b, re] of BRANDS) if (re.test(name) || re.test(bundleId)) return b;
  if (/^com\.apple\.health/i.test(bundleId) && /watch/i.test(name)) return 'apple-watch';
  if (/^iPhone/i.test(productType) || /^com\.apple\.health/i.test(bundleId)) return 'iphone';
  if (/watch/i.test(name)) return 'apple-watch';
  return 'other';
}

export const BRAND_LABEL: Record<WatchBrand, string> = {
  'apple-watch': 'Apple Watch',
  iphone: 'iPhone',
  garmin: 'Garmin',
  fitbit: 'Fitbit',
  huawei: 'Huawei',
  samsung: 'Samsung',
  amazfit: 'Amazfit / Zepp',
  xiaomi: 'Xiaomi',
  polar: 'Polar',
  coros: 'COROS',
  suunto: 'Suunto',
  whoop: 'WHOOP',
  oura: 'Oura',
  withings: 'Withings',
  wahoo: 'Wahoo',
  other: 'Other app',
};

/** Live HR is considered stale after this long without a reading. */
export const LIVE_STALE_MS = 15 * 60 * 1000;

export function defaultMaxHr(age: number): number {
  return maxHeartRate(age);
}
