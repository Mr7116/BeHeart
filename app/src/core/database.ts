// SQLite storage for everything the app keeps. Platform-neutral: the iPhone build plugs in
// expo-sqlite, the self-test plugs in Node's built-in sqlite. Each list in AppData is a table,
// single values (profile, subscription, settings) live in `meta`. Saves only write rows that changed.
import type { AppData, DailyHealth, FoodEntry, FoodItem, LiveSession, Routine, WorkoutSession } from './types';

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SqlValue[]): Promise<void>;
  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs `fn` inside BEGIN … COMMIT (ROLLBACK on error). */
  transaction(fn: () => Promise<void>): Promise<void>;
}

/** Bump and add a step to MIGRATIONS when the schema changes. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS daily_health (
    date TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    resting_hr REAL, hrv REAL, resp_rate REAL, avg_hr REAL, max_hr REAL,
    steps REAL NOT NULL DEFAULT 0, active_kcal REAL NOT NULL DEFAULT 0,
    zone1_min REAL NOT NULL DEFAULT 0, zone2_min REAL NOT NULL DEFAULT 0, zone3_min REAL NOT NULL DEFAULT 0,
    zone4_min REAL NOT NULL DEFAULT 0, zone5_min REAL NOT NULL DEFAULT 0,
    sleep_in_bed_min REAL, sleep_deep_min REAL, sleep_rem_min REAL, sleep_core_min REAL, sleep_awake_min REAL, sleep_bedtime_min REAL
  );
  CREATE TABLE IF NOT EXISTS workout_sessions (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, name TEXT NOT NULL, exercises TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS workout_sessions_date ON workout_sessions(date);
  CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, exercise_ids TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS food_entries (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, meal TEXT NOT NULL, grams REAL NOT NULL, food TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS food_entries_date ON food_entries(date);
  CREATE TABLE IF NOT EXISTS custom_foods (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, barcode TEXT, food TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS custom_foods_barcode ON custom_foods(barcode);
  CREATE TABLE IF NOT EXISTS live_sessions (
    id TEXT PRIMARY KEY NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, source TEXT NOT NULL, via TEXT NOT NULL,
    avg_hr REAL NOT NULL, max_hr REAL NOT NULL,
    zone1_min REAL NOT NULL, zone2_min REAL NOT NULL, zone3_min REAL NOT NULL, zone4_min REAL NOT NULL, zone5_min REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS live_sessions_start ON live_sessions(start);
  `,
];

interface Table<T> {
  name: string;
  key: string;
  pick(d: AppData): T[];
  id(x: T): string;
  toRow(x: T): Row;
  fromRow(r: any): T;
  /** ORDER BY used when loading. */
  order: string;
  /**
   * Tables whose list order matters get a `position` column. New rows go after the last one
   * ('append') or before the first ('prepend'); existing rows keep theirs, so adding or removing
   * one item never rewrites the others.
   */
  positioned?: 'append' | 'prepend';
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const zones = (r: any): [number, number, number, number, number] => [r.zone1_min, r.zone2_min, r.zone3_min, r.zone4_min, r.zone5_min].map(Number) as any;
const zoneCols = (z: number[]) => ({ zone1_min: z[0], zone2_min: z[1], zone3_min: z[2], zone4_min: z[3], zone5_min: z[4] });

const TABLES: Table<any>[] = [
  {
    name: 'daily_health',
    key: 'date',
    order: 'date',
    pick: (d) => d.health,
    id: (x: DailyHealth) => x.date,
    toRow: (x: DailyHealth) => ({
      date: x.date,
      source: x.source,
      resting_hr: x.restingHr,
      hrv: x.hrv,
      resp_rate: x.respRate,
      avg_hr: x.avgHr,
      max_hr: x.maxHr,
      steps: x.steps,
      active_kcal: x.activeKcal,
      ...zoneCols(x.zoneMin),
      sleep_in_bed_min: x.sleep?.inBedMin ?? null,
      sleep_deep_min: x.sleep?.deepMin ?? null,
      sleep_rem_min: x.sleep?.remMin ?? null,
      sleep_core_min: x.sleep?.coreMin ?? null,
      sleep_awake_min: x.sleep?.awakeMin ?? null,
      sleep_bedtime_min: x.sleep?.bedtimeMin ?? null,
    }),
    fromRow: (r): DailyHealth => ({
      date: r.date,
      source: r.source,
      restingHr: num(r.resting_hr),
      hrv: num(r.hrv),
      respRate: num(r.resp_rate),
      avgHr: num(r.avg_hr),
      maxHr: num(r.max_hr),
      steps: Number(r.steps),
      activeKcal: Number(r.active_kcal),
      zoneMin: zones(r),
      sleep:
        r.sleep_in_bed_min == null
          ? null
          : {
              inBedMin: Number(r.sleep_in_bed_min),
              deepMin: Number(r.sleep_deep_min),
              remMin: Number(r.sleep_rem_min),
              coreMin: Number(r.sleep_core_min),
              awakeMin: Number(r.sleep_awake_min),
              bedtimeMin: Number(r.sleep_bedtime_min),
            },
    }),
  },
  {
    name: 'workout_sessions',
    key: 'id',
    order: 'position',
    positioned: 'append',
    pick: (d) => d.sessions,
    id: (x: WorkoutSession) => x.id,
    toRow: (x: WorkoutSession) => ({ id: x.id, date: x.date, name: x.name, exercises: JSON.stringify(x.exercises) }),
    fromRow: (r): WorkoutSession => ({ id: r.id, date: r.date, name: r.name, exercises: JSON.parse(r.exercises) }),
  },
  {
    name: 'routines',
    key: 'id',
    order: 'position',
    positioned: 'append',
    pick: (d) => d.routines,
    id: (x: Routine) => x.id,
    toRow: (x: Routine) => ({ id: x.id, name: x.name, exercise_ids: JSON.stringify(x.exerciseIds) }),
    fromRow: (r): Routine => ({ id: r.id, name: r.name, exerciseIds: JSON.parse(r.exercise_ids) }),
  },
  {
    name: 'food_entries',
    key: 'id',
    order: 'position',
    positioned: 'append',
    pick: (d) => d.foods,
    id: (x: FoodEntry) => x.id,
    toRow: (x: FoodEntry) => ({ id: x.id, date: x.date, meal: x.meal, grams: x.grams, food: JSON.stringify(x.food) }),
    fromRow: (r): FoodEntry => ({ id: r.id, date: r.date, meal: r.meal, grams: Number(r.grams), food: JSON.parse(r.food) }),
  },
  {
    name: 'custom_foods',
    key: 'id',
    order: 'position',
    positioned: 'prepend',
    pick: (d) => d.customFoods,
    id: (x: FoodItem) => x.id,
    toRow: (x: FoodItem) => ({ id: x.id, name: x.name, barcode: x.barcode ?? null, food: JSON.stringify(x) }),
    fromRow: (r): FoodItem => JSON.parse(r.food),
  },
  {
    name: 'live_sessions',
    key: 'id',
    order: 'start DESC',
    pick: (d) => d.liveSessions ?? [],
    id: (x: LiveSession) => x.id,
    toRow: (x: LiveSession) => ({ id: x.id, start: x.start, end: x.end, source: x.source, via: x.via, avg_hr: x.avgHr, max_hr: x.maxHr, ...zoneCols(x.zoneMin) }),
    fromRow: (r): LiveSession => ({ id: r.id, start: r.start, end: r.end, source: r.source, via: r.via, avgHr: Number(r.avg_hr), maxHr: Number(r.max_hr), zoneMin: zones(r) }),
  },
];

/** Single values kept in the `meta` table (as JSON). */
const META_KEYS = ['profile', 'subscription', 'lastSync', 'autoSync', 'healthKitConnected', 'watch', 'onboarded'] as const;

export class HealthDatabase {
  /** What's on disk, per table: id → serialized row (+ its position). Used to write only changes. */
  private written = new Map<string, Map<string, { s: string; pos: number }>>();
  private meta = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: SqlDriver) {}

  async open(): Promise<void> {
    await this.db.exec('PRAGMA journal_mode = WAL;');
    const [{ user_version }] = await this.db.all<{ user_version: number }>('PRAGMA user_version');
    for (let v = user_version; v < MIGRATIONS.length; v++) {
      await this.db.transaction(async () => {
        await this.db.exec(MIGRATIONS[v]);
        await this.db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  /** Reads everything. Returns null when the database has never been saved to. */
  async load(): Promise<AppData | null> {
    const meta = new Map((await this.db.all<{ key: string; value: string }>('SELECT key, value FROM meta')).map((r) => [r.key, JSON.parse(r.value)] as const));
    if (!meta.has('profile')) return null;
    const out: any = { version: 1 };
    for (const k of META_KEYS) if (meta.has(k)) out[k] = meta.get(k);
    this.meta = new Map(Array.from(meta.entries()).map(([k, v]) => [k, JSON.stringify(v)]));
    for (const t of TABLES) {
      const rows = await this.db.all<any>(`SELECT * FROM ${t.name} ORDER BY ${t.order}`);
      const seen = new Map<string, { s: string; pos: number }>();
      const items = rows.map((r) => {
        const x = t.fromRow(r);
        seen.set(t.id(x), { s: JSON.stringify(t.toRow(x)), pos: Number(r.position ?? 0) });
        return x;
      });
      this.written.set(t.name, seen);
      out[TABLE_FIELD[t.name]] = items;
    }
    const data = out as AppData;
    data.lastSync = data.lastSync ?? null;
    data.autoSync = data.autoSync ?? true;
    return data;
  }

  /** Writes what changed since the last load/save, in one transaction. Calls are queued. */
  save(data: AppData): Promise<number> {
    const job = this.queue.then(() => this.write(data));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async write(data: AppData): Promise<number> {
    const plan: (() => Promise<void>)[] = [];
    const nextMeta = new Map<string, string>();
    for (const k of META_KEYS) {
      const v = (data as any)[k];
      if (v === undefined) continue;
      const s = JSON.stringify(v);
      nextMeta.set(k, s);
      if (this.meta.get(k) !== s) plan.push(() => this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [k, s]));
    }
    for (const k of this.meta.keys()) if (!nextMeta.has(k)) plan.push(() => this.db.run('DELETE FROM meta WHERE key = ?', [k]));

    const nextTables = new Map<string, Map<string, { s: string; pos: number }>>();
    for (const t of TABLES) {
      const prev = this.written.get(t.name) ?? new Map<string, { s: string; pos: number }>();
      const next = new Map<string, { s: string; pos: number }>();
      const items = t.pick(data);
      const positions = Array.from(prev.values()).map((v) => v.pos);
      let hi = positions.length ? Math.max(...positions) : -1;
      let lo = positions.length ? Math.min(...positions) : 0;
      const fresh = prev.size === 0;
      // Prepend tables list newest first, so walk them from the end to hand out decreasing positions.
      const order = t.positioned === 'prepend' && !fresh ? items.map((_, i) => items.length - 1 - i) : items.map((_, i) => i);
      for (const i of order) {
        const x = items[i];
        const id = t.id(x);
        const row = t.toRow(x);
        const s = JSON.stringify(row);
        const old = prev.get(id);
        const pos = old ? old.pos : fresh ? i : t.positioned === 'prepend' ? --lo : ++hi;
        next.set(id, { s, pos });
        if (!old || old.s !== s) {
          const full: Row = t.positioned ? { ...row, position: pos } : row;
          const cols = Object.keys(full);
          plan.push(() => this.db.run(`INSERT OR REPLACE INTO ${t.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => full[c])));
        }
      }
      for (const id of prev.keys()) if (!next.has(id)) plan.push(() => this.db.run(`DELETE FROM ${t.name} WHERE ${t.key} = ?`, [id]));
      nextTables.set(t.name, next);
    }
    if (!plan.length) return 0;
    await this.db.transaction(async () => {
      for (const step of plan) await step();
    });
    this.meta = nextMeta;
    for (const [k, v] of nextTables) this.written.set(k, v);
    return plan.length;
  }

  /** Row counts per table (shown in Profile → Your data). */
  async counts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const t of TABLES) out[t.name] = (await this.db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t.name}`))[0].n;
    return out;
  }
}

const TABLE_FIELD: Record<string, keyof AppData> = {
  daily_health: 'health',
  workout_sessions: 'sessions',
  routines: 'routines',
  food_entries: 'foods',
  custom_foods: 'customFoods',
  live_sessions: 'liveSessions',
};
