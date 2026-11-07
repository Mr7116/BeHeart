import { AppData, Profile } from './types';
import { syncDemoWearable } from './sampleData';
import { sampleRoutines, sampleSessions } from './workouts';
import { addDays, todayISO } from './dates';
import { BUILT_IN_FOODS } from './nutrition';

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

function food(name: string) {
  const f = BUILT_IN_FOODS.find((x) => x.name === name);
  if (!f) throw new Error(`missing food ${name}`);
  return f;
}

/** First-run data: 120 days from the demo wearable, two routines, six weeks of workouts and a sample food log. */
export function createInitialData(): AppData {
  const today = todayISO();
  const profile = DEFAULT_PROFILE;
  const { health } = syncDemoWearable([], profile);
  const yesterday = addDays(today, -1);
  const foods = [
    { d: today, meal: 'breakfast' as const, f: 'Oats, rolled', g: 70 },
    { d: today, meal: 'breakfast' as const, f: 'Greek yogurt, plain nonfat', g: 200 },
    { d: today, meal: 'breakfast' as const, f: 'Blueberries', g: 100 },
    { d: today, meal: 'lunch' as const, f: 'Chicken breast, cooked', g: 160 },
    { d: today, meal: 'lunch' as const, f: 'White rice, cooked', g: 220 },
    { d: today, meal: 'lunch' as const, f: 'Broccoli', g: 120 },
    { d: today, meal: 'snacks' as const, f: 'Banana', g: 120 },
    { d: yesterday, meal: 'breakfast' as const, f: 'Egg, whole', g: 150 },
    { d: yesterday, meal: 'breakfast' as const, f: 'Whole wheat bread', g: 80 },
    { d: yesterday, meal: 'lunch' as const, f: 'Salmon, cooked', g: 150 },
    { d: yesterday, meal: 'lunch' as const, f: 'Quinoa, cooked', g: 200 },
    { d: yesterday, meal: 'dinner' as const, f: 'Beef, lean ground 90%, cooked', g: 180 },
    { d: yesterday, meal: 'dinner' as const, f: 'Pasta, cooked', g: 250 },
    { d: yesterday, meal: 'snacks' as const, f: 'Almonds', g: 30 },
  ].map((x, i) => ({ id: `sample-food-${i}`, date: x.d, meal: x.meal, food: food(x.f), grams: x.g }));
  return {
    version: 1,
    profile,
    health,
    routines: sampleRoutines(),
    sessions: sampleSessions(today, profile),
    foods,
    customFoods: [],
    subscription: { premium: false, plan: null, since: null },
    lastSync: new Date().toISOString(),
    autoSync: true,
  };
}
