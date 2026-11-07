// A "demo wearable": reproducible sample health data so the app is useful before any real import.
// Values for a given date are always the same (seeded by the date), so syncing is idempotent.

import { DailyHealth, Profile } from './types';
import { addDays, parseISODate, todayISO } from './dates';
import { clamp, gaussian, seededRandom } from './stats';
import { maxHeartRate } from './scoring';

function hashDate(date: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Training intensity 0..1 for a date: a weekly plan with random variation. */
function intensityFor(date: string): number {
  const rand = seededRandom(hashDate(date, 7));
  const dow = parseISODate(date).getDay();
  const plan = [0.15, 0.75, 0.55, 0.85, 0.3, 0.7, 0.95][dow];
  return clamp(plan + gaussian(rand) * 0.15, 0.05, 1);
}

export function generateDay(date: string, profile: Profile, fractionOfDay = 1): DailyHealth {
  const rand = seededRandom(hashDate(date, 13));
  const g = () => gaussian(rand);
  const intensity = intensityFor(date);
  const prevIntensity = intensityFor(addDays(date, -1));
  // Slow fitness trend so the long-term charts have a shape.
  const t = parseISODate(date).getTime() / 86400000;
  const trend = Math.sin(t / 23) * 0.5 + Math.sin(t / 61) * 0.5;

  const hrv = Math.round(clamp(58 + trend * 6 - (prevIntensity - 0.5) * 16 + g() * 7, 22, 120));
  const restingHr = Math.round(clamp(56 - trend * 2 + (prevIntensity - 0.5) * 5 + g() * 1.8, 40, 85));
  const respRate = Math.round(clamp(14.6 + (prevIntensity - 0.5) * 0.6 + g() * 0.45, 10, 22) * 10) / 10;

  // Sleep for the night ending on `date`.
  const bedtimeMin = Math.round(-45 + g() * 35 + (parseISODate(date).getDay() === 6 || parseISODate(date).getDay() === 0 ? 40 : 0));
  const asleep = Math.round(clamp(440 + g() * 38 + prevIntensity * 15, 300, 560));
  const deepMin = Math.round(asleep * clamp(0.17 + prevIntensity * 0.03 + g() * 0.03, 0.07, 0.3));
  const remMin = Math.round(asleep * clamp(0.22 + g() * 0.03, 0.12, 0.32));
  const coreMin = asleep - deepMin - remMin;
  const awakeMin = Math.round(clamp(28 + g() * 10, 6, 70));

  const f = clamp(fractionOfDay, 0, 1);
  const hrMax = maxHeartRate(profile.age);
  const workoutMin = intensity * 70;
  const zoneMin: DailyHealth['zoneMin'] = [
    Math.round((55 + intensity * 25 + g() * 10) * f),
    Math.round(clamp(workoutMin * 0.35 + g() * 5, 0, 120) * f),
    Math.round(clamp(workoutMin * 0.3 + g() * 4, 0, 90) * f),
    Math.round(clamp(workoutMin * 0.2 * intensity + g() * 3, 0, 60) * f),
    Math.round(clamp(workoutMin * 0.1 * intensity * intensity + g() * 1.5, 0, 25) * f),
  ];
  const steps = Math.round(clamp(6500 + intensity * 6000 + g() * 1800, 1500, 26000) * f);
  const activeKcal = Math.round(clamp(260 + intensity * 650 + g() * 70, 80, 1600) * f);
  const avgHr = Math.round(restingHr + 18 + intensity * 10);
  const maxHr = Math.round(clamp(hrMax * (0.72 + intensity * 0.24) + g() * 3, restingHr + 30, hrMax));

  return {
    date,
    restingHr,
    hrv,
    respRate,
    avgHr,
    maxHr,
    steps,
    activeKcal,
    zoneMin: zoneMin.map((m) => Math.max(0, m)) as DailyHealth['zoneMin'],
    sleep: { inBedMin: asleep + awakeMin, deepMin, remMin, coreMin, awakeMin, bedtimeMin },
    source: 'demo-wearable',
  };
}

/** Fraction of the local day that has passed (activity so far today), at least 0.3. */
export function dayFraction(now = new Date()): number {
  return clamp((now.getHours() * 60 + now.getMinutes()) / 1440, 0.3, 1);
}

/**
 * Adds demo-wearable days that are missing up to today. Days from manual entry or an
 * Apple Health import are never overwritten. Returns the merged list and how many days changed.
 */
export function syncDemoWearable(existing: DailyHealth[], profile: Profile, historyDays = 120): { health: DailyHealth[]; added: number } {
  const today = todayISO();
  const byDate = new Map(existing.map((d) => [d.date, d] as const));
  let added = 0;
  for (let i = historyDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const cur = byDate.get(date);
    if (cur && cur.source !== 'demo-wearable') continue;
    if (cur && date !== today) continue;
    byDate.set(date, generateDay(date, profile, date === today ? dayFraction() : 1));
    if (!cur) added++;
  }
  const health = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { health, added };
}
