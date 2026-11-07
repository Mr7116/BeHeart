import { AppData, Profile } from './types';

export const DEFAULT_PROFILE: Profile = {
  name: 'Alex',
  age: 32,
  sex: 'male',
  weightKg: 78,
  heightCm: 178,
  activity: 'moderate',
  goal: 'maintain',
  sleepNeedH: 8,
};

/** First-run data: no sample days, workouts or meals — everything comes from the person, Apple Health or a watch. */
export function createEmptyData(): AppData {
  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE, name: '' },
    health: [],
    routines: [],
    sessions: [],
    foods: [],
    customFoods: [],
    subscription: { premium: false, plan: null, since: null },
    lastSync: null,
    autoSync: true,
    onboarded: false,
    liveSessions: [],
  };
}

const SAMPLE_ROUTINE_IDS = new Set(['r-upper', 'r-lower']);

/** True when the data still contains anything the old demo/sample generator created. */
export function hasSampleData(d: AppData): boolean {
  return (
    d.health.some((h) => (h.source as string) === 'demo-wearable') ||
    d.sessions.some((s) => s.id.startsWith('sample-')) ||
    d.foods.some((f) => f.id.startsWith('sample-food-')) ||
    d.routines.some((r) => SAMPLE_ROUTINE_IDS.has(r.id))
  );
}

/** Removes demo-wearable days and the sample workouts, routines and meals; keeps everything real. */
export function purgeSampleData(d: AppData): AppData {
  const isDefaultPerson = d.profile.name === 'Alex' && d.profile.age === DEFAULT_PROFILE.age && d.profile.weightKg === DEFAULT_PROFILE.weightKg && d.profile.heightCm === DEFAULT_PROFILE.heightCm;
  return {
    ...d,
    health: d.health.filter((h) => (h.source as string) !== 'demo-wearable'),
    sessions: d.sessions.filter((s) => !s.id.startsWith('sample-')),
    foods: d.foods.filter((f) => !f.id.startsWith('sample-food-')),
    routines: d.routines.filter((r) => !SAMPLE_ROUTINE_IDS.has(r.id)),
    profile: isDefaultPerson ? { ...d.profile, name: '' } : d.profile,
    onboarded: d.onboarded ?? !isDefaultPerson,
  };
}
