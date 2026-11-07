// Shared data model for the whole app. Everything is stored locally as JSON.

export type DataSource = 'demo-wearable' | 'manual' | 'apple-health-import';

export interface SleepNight {
  /** Minutes in bed (asleep + awake). */
  inBedMin: number;
  deepMin: number;
  remMin: number;
  coreMin: number;
  awakeMin: number;
  /** Bedtime as minutes relative to midnight (e.g. -60 = 23:00, 30 = 00:30). */
  bedtimeMin: number;
}

export interface DailyHealth {
  /** Local date, YYYY-MM-DD. Sleep belongs to the night that ended on this date. */
  date: string;
  restingHr: number | null;
  /** HRV (SDNN, ms) measured overnight. */
  hrv: number | null;
  respRate: number | null;
  avgHr: number | null;
  maxHr: number | null;
  steps: number;
  activeKcal: number;
  /** Minutes spent in heart-rate zones 1..5 (50-60, 60-70, 70-80, 80-90, 90-100 % of max HR). */
  zoneMin: [number, number, number, number, number];
  sleep: SleepNight | null;
  source: DataSource;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type BodyGoal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: BodyGoal;
  /** Baseline nightly sleep need in hours. */
  sleepNeedH: number;
}

export interface SetEntry {
  reps: number;
  weightKg: number;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetEntry[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  name: string;
  exercises: ExerciseLog[];
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  /** Values per 100 g. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'built-in' | 'openfoodfacts' | 'custom';
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: Meal;
  food: FoodItem;
  grams: number;
}

export interface SubscriptionState {
  premium: boolean;
  plan: 'monthly' | 'yearly' | null;
  since: string | null;
}

export interface AppData {
  version: 1;
  profile: Profile;
  health: DailyHealth[];
  routines: Routine[];
  sessions: WorkoutSession[];
  foods: FoodEntry[];
  customFoods: FoodItem[];
  subscription: SubscriptionState;
  lastSync: string | null;
  autoSync: boolean;
  /** iPhone: read data straight from Apple Health instead of the demo wearable. */
  healthKitConnected?: boolean;
  /** Smartwatch / chest-strap settings (iPhone). */
  watch?: WatchSettings;
  /** Workouts recorded from live heart rate (Bluetooth sensor or Apple Watch). */
  liveSessions?: LiveSession[];
}

export interface WatchSettings {
  /** Last Bluetooth heart-rate device the person paired, reconnected automatically. */
  bleDeviceId?: string;
  bleDeviceName?: string;
  autoConnect: boolean;
}

export interface LiveSession {
  id: string;
  start: string;
  end: string;
  /** Device name the heart rate came from. */
  source: string;
  /** Bluetooth sessions add their zone minutes to the day; Apple Health ones are already in the synced day. */
  via: 'bluetooth' | 'apple-health';
  avgHr: number;
  maxHr: number;
  /** Minutes in zones 1..5. */
  zoneMin: [number, number, number, number, number];
}
