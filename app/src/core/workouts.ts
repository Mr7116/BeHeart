// Exercise database, training volume and muscle fatigue (deterministic load model).

import { Profile, Routine, WorkoutSession } from './types';
import { addDays, daysBetween, parseISODate, weekStart } from './dates';
import { clamp, seededRandom } from './stats';

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'core', label: 'Core' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
];

export interface Exercise {
  id: string;
  name: string;
  equipment: 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Kettlebell';
  primary: Muscle[];
  secondary: Muscle[];
  /** Share of body weight moved for bodyweight movements (added to any extra load). */
  bodyweightShare?: number;
}

export const EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Bench Press', equipment: 'Barbell', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', equipment: 'Dumbbell', primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  { id: 'chest-fly', name: 'Cable Chest Fly', equipment: 'Cable', primary: ['chest'], secondary: [] },
  { id: 'push-up', name: 'Push-up', equipment: 'Bodyweight', primary: ['chest'], secondary: ['triceps', 'core'], bodyweightShare: 0.64 },
  { id: 'dip', name: 'Dip', equipment: 'Bodyweight', primary: ['triceps', 'chest'], secondary: ['shoulders'], bodyweightShare: 0.95 },
  { id: 'deadlift', name: 'Deadlift', equipment: 'Barbell', primary: ['hamstrings', 'glutes', 'back'], secondary: ['forearms', 'core', 'quads'] },
  { id: 'barbell-row', name: 'Barbell Row', equipment: 'Barbell', primary: ['back'], secondary: ['biceps', 'forearms'] },
  { id: 'pull-up', name: 'Pull-up', equipment: 'Bodyweight', primary: ['back'], secondary: ['biceps', 'forearms'], bodyweightShare: 1 },
  { id: 'lat-pulldown', name: 'Lat Pulldown', equipment: 'Cable', primary: ['back'], secondary: ['biceps'] },
  { id: 'seated-row', name: 'Seated Cable Row', equipment: 'Cable', primary: ['back'], secondary: ['biceps'] },
  { id: 'db-row', name: 'One-arm Dumbbell Row', equipment: 'Dumbbell', primary: ['back'], secondary: ['biceps'] },
  { id: 'ohp', name: 'Overhead Press', equipment: 'Barbell', primary: ['shoulders'], secondary: ['triceps', 'core'] },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbell', primary: ['shoulders'], secondary: ['triceps'] },
  { id: 'lateral-raise', name: 'Lateral Raise', equipment: 'Dumbbell', primary: ['shoulders'], secondary: [] },
  { id: 'face-pull', name: 'Face Pull', equipment: 'Cable', primary: ['shoulders'], secondary: ['back'] },
  { id: 'barbell-curl', name: 'Barbell Curl', equipment: 'Barbell', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'hammer-curl', name: 'Hammer Curl', equipment: 'Dumbbell', primary: ['biceps', 'forearms'], secondary: [] },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', equipment: 'Cable', primary: ['triceps'], secondary: [] },
  { id: 'skull-crusher', name: 'Skull Crusher', equipment: 'Barbell', primary: ['triceps'], secondary: [] },
  { id: 'back-squat', name: 'Back Squat', equipment: 'Barbell', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  { id: 'front-squat', name: 'Front Squat', equipment: 'Barbell', primary: ['quads'], secondary: ['glutes', 'core'] },
  { id: 'leg-press', name: 'Leg Press', equipment: 'Machine', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'lunge', name: 'Walking Lunge', equipment: 'Dumbbell', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', equipment: 'Dumbbell', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'rdl', name: 'Romanian Deadlift', equipment: 'Barbell', primary: ['hamstrings', 'glutes'], secondary: ['back', 'forearms'] },
  { id: 'leg-curl', name: 'Leg Curl', equipment: 'Machine', primary: ['hamstrings'], secondary: [] },
  { id: 'leg-extension', name: 'Leg Extension', equipment: 'Machine', primary: ['quads'], secondary: [] },
  { id: 'hip-thrust', name: 'Hip Thrust', equipment: 'Barbell', primary: ['glutes'], secondary: ['hamstrings'] },
  { id: 'calf-raise', name: 'Standing Calf Raise', equipment: 'Machine', primary: ['calves'], secondary: [] },
  { id: 'kb-swing', name: 'Kettlebell Swing', equipment: 'Kettlebell', primary: ['glutes', 'hamstrings'], secondary: ['core', 'back'] },
  { id: 'plank', name: 'Plank (reps = seconds/10)', equipment: 'Bodyweight', primary: ['core'], secondary: ['shoulders'], bodyweightShare: 0.5 },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', equipment: 'Bodyweight', primary: ['core'], secondary: ['forearms'], bodyweightShare: 0.35 },
  { id: 'cable-crunch', name: 'Cable Crunch', equipment: 'Cable', primary: ['core'], secondary: [] },
  { id: 'farmers-carry', name: "Farmer's Carry (reps = 10 m)", equipment: 'Dumbbell', primary: ['forearms'], secondary: ['core', 'shoulders'] },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e] as const));
export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function effectiveLoad(ex: Exercise | undefined, weightKg: number, bodyKg: number): number {
  return weightKg + (ex?.bodyweightShare ? ex.bodyweightShare * bodyKg : 0);
}

/** Epley one-rep-max estimate. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Total tonnage (reps × kg) of a session. */
export function sessionVolume(s: WorkoutSession, bodyKg: number): number {
  let v = 0;
  for (const e of s.exercises) {
    const ex = exerciseById(e.exerciseId);
    for (const set of e.sets) v += set.reps * effectiveLoad(ex, set.weightKg, bodyKg);
  }
  return Math.round(v);
}

/** Volume credited to each muscle: 100 % for primary movers, 50 % for secondary. */
export function muscleVolume(s: WorkoutSession, bodyKg: number): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  for (const e of s.exercises) {
    const ex = exerciseById(e.exerciseId);
    if (!ex) continue;
    let v = 0;
    for (const set of e.sets) v += set.reps * effectiveLoad(ex, set.weightKg, bodyKg);
    for (const m of ex.primary) out[m] += v / ex.primary.length;
    for (const m of ex.secondary) out[m] += (v * 0.5) / Math.max(1, ex.secondary.length);
  }
  return out;
}

export interface WeekVolume {
  week: string;
  volume: number;
  sessions: number;
  sets: number;
}

export function weeklyVolume(sessions: WorkoutSession[], bodyKg: number, endDate: string, weeks: number): WeekVolume[] {
  const lastWeek = weekStart(endDate);
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ week: addDays(lastWeek, -7 * i), volume: 0, sessions: 0, sets: 0 });
  const idx = new Map(out.map((w, i) => [w.week, i] as const));
  for (const s of sessions) {
    const i = idx.get(weekStart(s.date));
    if (i == null || s.date > endDate) continue;
    out[i].volume += sessionVolume(s, bodyKg);
    out[i].sessions += 1;
    out[i].sets += s.exercises.reduce((a, e) => a + e.sets.length, 0);
  }
  return out;
}

export interface MuscleFatigue {
  muscle: Muscle;
  label: string;
  /** 0..100 */
  fatigue: number;
  acute: number;
  chronic: number;
  status: 'Fresh' | 'Recovering' | 'Fatigued';
  lastTrained: string | null;
}

const FATIGUE_TAU_DAYS = 1.5; // ~48–72 h for most of the load to clear
const CHRONIC_FLOOR = 900; // kg·reps credited per muscle when there is little history

/**
 * Acute load: every session's muscle volume decays exponentially (time constant 1.5 days).
 * Chronic load: the average daily volume over 28 days × the same time constant (what acute load
 * would be with perfectly even training). Fatigue % = acute / chronic scaled so 2.5× chronic = 100 %.
 */
export function muscleFatigue(sessions: WorkoutSession[], bodyKg: number, date: string): MuscleFatigue[] {
  const acute = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  const total28 = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  const last: Partial<Record<Muscle, string>> = {};
  for (const s of sessions) {
    const ago = daysBetween(s.date, date);
    if (ago < 0) continue;
    const mv = muscleVolume(s, bodyKg);
    for (const m of MUSCLES) {
      const v = mv[m.id];
      if (v <= 0) continue;
      if (ago < 10) acute[m.id] += v * Math.exp(-ago / FATIGUE_TAU_DAYS);
      if (ago < 28) total28[m.id] += v;
      if (!last[m.id] || (last[m.id] as string) < s.date) last[m.id] = s.date;
    }
  }
  return MUSCLES.map((m) => {
    const chronic = Math.max(CHRONIC_FLOOR, (total28[m.id] / 28) * FATIGUE_TAU_DAYS);
    const fatigue = Math.round(clamp((acute[m.id] / chronic / 2.5) * 100, 0, 100));
    const status = fatigue >= 70 ? 'Fatigued' : fatigue >= 35 ? 'Recovering' : 'Fresh';
    return { muscle: m.id, label: m.label, fatigue, acute: Math.round(acute[m.id]), chronic: Math.round(chronic), status, lastTrained: last[m.id] ?? null };
  });
}

export interface PersonalBest {
  exerciseId: string;
  name: string;
  best1RM: number;
  date: string;
}

export function personalBests(sessions: WorkoutSession[], bodyKg: number): PersonalBest[] {
  const best = new Map<string, PersonalBest>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = exerciseById(e.exerciseId);
      if (!ex) continue;
      for (const set of e.sets) {
        const orm = estimated1RM(effectiveLoad(ex, set.weightKg, bodyKg), set.reps);
        const cur = best.get(ex.id);
        if (!cur || orm > cur.best1RM) best.set(ex.id, { exerciseId: ex.id, name: ex.name, best1RM: Math.round(orm * 10) / 10, date: s.date });
      }
    }
  }
  return Array.from(best.values()).sort((a, b) => b.best1RM - a.best1RM);
}

export const FREE_ROUTINE_LIMIT = 3;

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ---------------------------------------------------------------- Sample routines and history

export function sampleRoutines(): Routine[] {
  return [
    { id: 'r-upper', name: 'Upper Body Strength', exerciseIds: ['bench-press', 'barbell-row', 'ohp', 'pull-up', 'triceps-pushdown', 'barbell-curl'] },
    { id: 'r-lower', name: 'Lower Body Strength', exerciseIds: ['back-squat', 'rdl', 'leg-press', 'leg-curl', 'calf-raise'] },
  ];
}

const SAMPLE_PLAN: { name: string; items: [string, number, number, number][] }[] = [
  // [exerciseId, sets, reps, kg]
  { name: 'Upper Body Strength', items: [['bench-press', 4, 6, 80], ['barbell-row', 4, 8, 70], ['ohp', 3, 8, 47.5], ['pull-up', 3, 8, 0], ['triceps-pushdown', 3, 12, 30]] },
  { name: 'Lower Body Strength', items: [['back-squat', 4, 5, 110], ['rdl', 3, 8, 90], ['leg-press', 3, 10, 180], ['calf-raise', 4, 12, 60]] },
  { name: 'Full Body', items: [['deadlift', 3, 5, 140], ['incline-db-press', 3, 10, 28], ['lat-pulldown', 3, 10, 60], ['lunge', 3, 10, 20], ['plank', 3, 6, 0]] },
];

/** Six weeks of reproducible sample sessions (Mon/Wed/Fri/Sat pattern) with gradual progression. */
export function sampleSessions(today: string, profile: Profile): WorkoutSession[] {
  void profile;
  const rand = seededRandom(42);
  const out: WorkoutSession[] = [];
  let n = 0;
  for (let i = 42; i >= 0; i--) {
    const date = addDays(today, -i);
    const dow = parseISODate(date).getDay();
    if (![1, 3, 5, 6].includes(dow)) continue;
    if (i === 0) continue; // leave today open for the user
    const plan = SAMPLE_PLAN[n % SAMPLE_PLAN.length];
    const progress = 1 + (42 - i) * 0.003;
    out.push({
      id: `sample-${date}`,
      date,
      name: plan.name,
      exercises: plan.items.map(([exerciseId, sets, reps, kg]) => ({
        exerciseId,
        sets: Array.from({ length: sets }, () => ({
          reps: Math.max(1, reps + Math.round((rand() - 0.6) * 2)),
          weightKg: Math.round((kg * progress) / 2.5) * 2.5,
        })),
      })),
    });
    n++;
  }
  return out;
}
