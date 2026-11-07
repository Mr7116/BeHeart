// Per-day metric series used by charts and trend statistics.

import { AppData, DailyHealth } from './types';
import { recoveryFor, sleepScoreFor, strainFor, asleepMinutes } from './scoring';
import { dateRange } from './dates';
import { mean, stdDev } from './stats';

export type MetricId = 'recovery' | 'strain' | 'sleep' | 'sleepHours' | 'hrv' | 'rhr' | 'resp' | 'steps' | 'activeKcal';

export const METRICS: { id: MetricId; label: string; unit: string; digits: number }[] = [
  { id: 'recovery', label: 'Recovery', unit: '%', digits: 0 },
  { id: 'strain', label: 'Strain', unit: '/21', digits: 1 },
  { id: 'sleep', label: 'Sleep score', unit: '/100', digits: 0 },
  { id: 'sleepHours', label: 'Time asleep', unit: 'h', digits: 1 },
  { id: 'hrv', label: 'HRV', unit: 'ms', digits: 0 },
  { id: 'rhr', label: 'Resting HR', unit: 'bpm', digits: 0 },
  { id: 'resp', label: 'Respiratory rate', unit: 'br/min', digits: 1 },
  { id: 'steps', label: 'Steps', unit: '', digits: 0 },
  { id: 'activeKcal', label: 'Active energy', unit: 'kcal', digits: 0 },
];

export function metricValue(data: AppData, day: DailyHealth | undefined, date: string, id: MetricId): number | null {
  switch (id) {
    case 'recovery':
      return recoveryFor(data.health, data.profile, date)?.score ?? null;
    case 'strain':
      return day ? strainFor(day).score : null;
    case 'sleep':
      return sleepScoreFor(data.health, data.profile, date)?.score ?? null;
    case 'sleepHours':
      return day?.sleep ? asleepMinutes(day.sleep) / 60 : null;
    case 'hrv':
      return day?.hrv ?? null;
    case 'rhr':
      return day?.restingHr ?? null;
    case 'resp':
      return day?.respRate ?? null;
    case 'steps':
      return day ? day.steps : null;
    case 'activeKcal':
      return day ? day.activeKcal : null;
  }
}

export function metricSeries(data: AppData, id: MetricId, end: string, days: number): { dates: string[]; values: (number | null)[] } {
  const byDate = new Map(data.health.map((d) => [d.date, d] as const));
  const dates = dateRange(end, days);
  return { dates, values: dates.map((date) => metricValue(data, byDate.get(date), date, id)) };
}

export interface SeriesStats {
  avg: number | null;
  min: number | null;
  max: number | null;
  sd: number | null;
  count: number;
}

export function seriesStats(values: (number | null)[]): SeriesStats {
  const xs = values.filter((v): v is number => v != null && !isNaN(v));
  if (!xs.length) return { avg: null, min: null, max: null, sd: null, count: 0 };
  return { avg: mean(xs), min: Math.min(...xs), max: Math.max(...xs), sd: xs.length > 1 ? stdDev(xs) : null, count: xs.length };
}
