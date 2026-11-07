// Rule-based daily scores. No machine learning: every number comes from a fixed formula
// so the same data always produces the same score.

import { DailyHealth, Profile } from './types';
import { clamp, mean, normCdf, stdDev } from './stats';
import { addDays } from './dates';

export const BASELINE_DAYS = 30;

export interface Baseline {
  hrvMean: number;
  hrvSd: number;
  rhrMean: number;
  rhrSd: number;
  respMean: number;
  respSd: number;
  /** Number of days that fed the baseline (population defaults are used under 4). */
  days: number;
}

const POPULATION: Baseline = { hrvMean: 55, hrvSd: 12, rhrMean: 60, rhrSd: 4, respMean: 15, respSd: 1, days: 0 };

function index(health: DailyHealth[]): Map<string, DailyHealth> {
  const m = new Map<string, DailyHealth>();
  for (const h of health) m.set(h.date, h);
  return m;
}

/** Personal baseline from the 30 days before `date` (the day itself is excluded). */
export function baselineFor(health: DailyHealth[], date: string): Baseline {
  const byDate = index(health);
  const hrv: number[] = [];
  const rhr: number[] = [];
  const resp: number[] = [];
  for (let i = 1; i <= BASELINE_DAYS; i++) {
    const d = byDate.get(addDays(date, -i));
    if (!d) continue;
    if (d.hrv != null) hrv.push(d.hrv);
    if (d.restingHr != null) rhr.push(d.restingHr);
    if (d.respRate != null) resp.push(d.respRate);
  }
  const days = Math.min(hrv.length, rhr.length);
  if (days < 4) return POPULATION;
  return {
    hrvMean: mean(hrv),
    hrvSd: Math.max(3, stdDev(hrv) || 0),
    rhrMean: mean(rhr),
    rhrSd: Math.max(1.5, stdDev(rhr) || 0),
    respMean: resp.length >= 4 ? mean(resp) : POPULATION.respMean,
    respSd: resp.length >= 4 ? Math.max(0.4, stdDev(resp) || 0) : POPULATION.respSd,
    days,
  };
}

// ---------------------------------------------------------------- Strain

/** Tanaka formula for maximum heart rate. */
export function maxHeartRate(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export const ZONE_LABELS = ['Zone 1 · 50–60%', 'Zone 2 · 60–70%', 'Zone 3 · 70–80%', 'Zone 4 · 80–90%', 'Zone 5 · 90–100%'];

export interface StrainResult {
  score: number; // 0..21
  trimp: number;
  load: number;
  activeKcal: number;
  label: 'Light' | 'Moderate' | 'High' | 'All out';
}

/** Edwards TRIMP (zone minutes × zone weight) plus a share of active energy, mapped to 0–21. */
export function strainFor(day: DailyHealth | undefined): StrainResult {
  if (!day) return { score: 0, trimp: 0, load: 0, activeKcal: 0, label: 'Light' };
  const trimp = day.zoneMin.reduce((acc, m, i) => acc + m * (i + 1), 0);
  const load = trimp + 0.05 * day.activeKcal;
  const score = 21 * (1 - Math.exp(-load / 220));
  const label = score >= 18 ? 'All out' : score >= 14 ? 'High' : score >= 10 ? 'Moderate' : 'Light';
  return { score: Math.round(score * 10) / 10, trimp: Math.round(trimp), load: Math.round(load), activeKcal: day.activeKcal, label };
}

// ---------------------------------------------------------------- Sleep

export function asleepMinutes(s: DailyHealth['sleep']): number {
  if (!s) return 0;
  return s.deepMin + s.remMin + s.coreMin;
}

export interface SleepNeed {
  totalMin: number;
  baselineMin: number;
  strainMin: number;
  debtMin: number;
}

/** Sleep need tonight = baseline + extra for yesterday's strain + a quarter of the last 3 nights' debt. */
export function sleepNeedFor(health: DailyHealth[], profile: Profile, date: string): SleepNeed {
  const byDate = index(health);
  const baselineMin = profile.sleepNeedH * 60;
  const prev = byDate.get(addDays(date, -1));
  const prevStrain = strainFor(prev).score;
  const strainMin = Math.max(0, prevStrain - 10) * 4;
  let debt = 0;
  for (let i = 1; i <= 3; i++) {
    const d = byDate.get(addDays(date, -i));
    if (d?.sleep) debt += Math.max(0, baselineMin - asleepMinutes(d.sleep));
  }
  const debtMin = debt * 0.25; // repay a quarter of the accumulated shortfall tonight
  const totalMin = Math.min(baselineMin + 90, baselineMin + strainMin + debtMin);
  return { totalMin, baselineMin, strainMin, debtMin };
}

export interface SleepScoreResult {
  score: number; // 0..100
  asleepMin: number;
  needMin: number;
  durationPts: number; // /50
  deepPts: number; // /15
  remPts: number; // /15
  efficiencyPts: number; // /10
  consistencyPts: number; // /10
  deepPct: number;
  remPct: number;
  corePct: number;
  efficiency: number;
  bedtimeSdMin: number;
}

function rangePoints(value: number, lo: number, hi: number, max: number, tolerance: number): number {
  if (value >= lo && value <= hi) return max;
  const dist = value < lo ? lo - value : value - hi;
  return max * Math.max(0, 1 - dist / tolerance);
}

/** Scores sleep against standard stage proportions (Deep 13–23 %, REM 20–25 %), duration, efficiency and bedtime regularity. */
export function sleepScoreFor(health: DailyHealth[], profile: Profile, date: string): SleepScoreResult | null {
  const byDate = index(health);
  const day = byDate.get(date);
  if (!day?.sleep) return null;
  const s = day.sleep;
  const asleep = asleepMinutes(s);
  const need = sleepNeedFor(health, profile, date).totalMin;
  const deepPct = asleep ? (s.deepMin / asleep) * 100 : 0;
  const remPct = asleep ? (s.remMin / asleep) * 100 : 0;
  const corePct = asleep ? (s.coreMin / asleep) * 100 : 0;
  const efficiency = s.inBedMin ? asleep / s.inBedMin : 0;

  const bedtimes: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = byDate.get(addDays(date, -i));
    if (d?.sleep) bedtimes.push(d.sleep.bedtimeMin);
  }
  const bedtimeSdMin = bedtimes.length >= 3 ? stdDev(bedtimes) : 0;

  const durationPts = 50 * clamp(asleep / need, 0, 1);
  const deepPts = rangePoints(deepPct, 13, 23, 15, 10);
  const remPts = rangePoints(remPct, 20, 25, 15, 10);
  const efficiencyPts = 10 * clamp((efficiency - 0.75) / 0.2, 0, 1);
  const consistencyPts = 10 * clamp(1 - (bedtimeSdMin - 30) / 90, 0, 1);
  const score = Math.round(durationPts + deepPts + remPts + efficiencyPts + consistencyPts);
  return {
    score,
    asleepMin: asleep,
    needMin: need,
    durationPts,
    deepPts,
    remPts,
    efficiencyPts,
    consistencyPts,
    deepPct,
    remPct,
    corePct,
    efficiency,
    bedtimeSdMin,
  };
}

// ---------------------------------------------------------------- Recovery

export interface RecoveryResult {
  score: number; // 0..100
  zone: 'green' | 'yellow' | 'red';
  hrvZ: number;
  rhrZ: number;
  sleepPerformance: number; // 0..1
  respPenalty: number;
  baseline: Baseline;
  hrv: number;
  rhr: number;
  resp: number | null;
}

/**
 * Recovery = 50 % HRV vs. personal baseline + 25 % RHR vs. baseline + 25 % sleep performance,
 * minus a penalty when respiratory rate is more than one standard deviation above normal.
 * Baseline deviations are z-scores (standard-deviation formula) turned into 0–1 with the normal curve.
 */
export function recoveryFor(health: DailyHealth[], profile: Profile, date: string): RecoveryResult | null {
  const byDate = index(health);
  const day = byDate.get(date);
  if (!day || day.hrv == null || day.restingHr == null) return null;
  const b = baselineFor(health, date);
  const hrvZ = (day.hrv - b.hrvMean) / b.hrvSd;
  const rhrZ = (b.rhrMean - day.restingHr) / b.rhrSd;
  const need = sleepNeedFor(health, profile, date).totalMin;
  const sleepPerformance = day.sleep ? clamp(asleepMinutes(day.sleep) / need, 0, 1) : 0.7;
  const respZ = day.respRate != null ? (day.respRate - b.respMean) / b.respSd : 0;
  const respPenalty = Math.max(0, respZ - 1) * 5;
  const raw = 100 * (0.5 * normCdf(hrvZ) + 0.25 * normCdf(rhrZ) + 0.25 * sleepPerformance) - respPenalty;
  const score = Math.round(clamp(raw, 1, 99));
  const zone = score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red';
  return { score, zone, hrvZ, rhrZ, sleepPerformance, respPenalty, baseline: b, hrv: day.hrv, rhr: day.restingHr, resp: day.respRate };
}

export function recoveryAdvice(r: RecoveryResult | null): string {
  if (!r) return 'Not enough overnight data to score recovery for this day.';
  if (r.zone === 'green') return 'Your body is well recovered. A good day to push intensity.';
  if (r.zone === 'yellow') return 'Moderately recovered. Train, but keep the hardest efforts short.';
  return 'Low recovery. Prioritise rest, easy movement and an earlier bedtime.';
}

/** Suggested strain range for the day, chosen from the recovery zone. */
export function targetStrain(r: RecoveryResult | null): [number, number] {
  if (!r) return [8, 12];
  if (r.zone === 'green') return [14, 18];
  if (r.zone === 'yellow') return [10, 14];
  return [4, 9];
}

// ---------------------------------------------------------------- Cardio fitness

/** Uth et al. estimate: VO2max ≈ 15.3 × HRmax / HRrest (ml/kg/min). */
export function vo2maxEstimate(age: number, rhr: number): number {
  return Math.round((15.3 * maxHeartRate(age)) / rhr * 10) / 10;
}

export function vo2Category(vo2: number, age: number, sex: Profile['sex']): string {
  // Simplified bands (ml/kg/min) adjusted for age and sex.
  const adj = (sex === 'female' ? -5 : 0) - Math.max(0, age - 30) * 0.3;
  const v = vo2 - adj;
  if (v >= 52) return 'Superior';
  if (v >= 46) return 'Excellent';
  if (v >= 40) return 'Good';
  if (v >= 35) return 'Fair';
  return 'Poor';
}
