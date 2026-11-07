// Quick self-test of the deterministic formulas and the Apple Health parser (run with `npm test`).
import { AppleHealthAggregator, mergeHealth } from './appleHealth';
import { createEmptyData, hasSampleData, purgeSampleData } from './defaults';
import { syncDemoWearable } from './sampleData';
import { sampleRoutines, sampleSessions } from './workouts';
import { recoveryFor, sleepScoreFor, strainFor, vo2maxEstimate } from './scoring';
import { macroGoals, isValidBarcode } from './nutrition';
import { estimated1RM, muscleFatigue, weeklyVolume } from './workouts';
import { todayISO } from './dates';
import { HealthDatabase, SqlDriver } from './database';
import { applySessionToDay, identifyBrand, parseHeartRateMeasurement, SessionRecorder, zoneIndex } from './heartRate';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

// Test fixture: 120 generated days + sample workouts (the app itself starts empty).
const empty = createEmptyData();
const profile = { ...empty.profile, name: 'Test' };
const data = { ...empty, profile, health: syncDemoWearable([], profile).health, routines: sampleRoutines(), sessions: sampleSessions(todayISO(), profile), onboarded: true };
const today = todayISO();
const rec = recoveryFor(data.health, data.profile, today);
check('recovery is 1..99', !!rec && rec.score >= 1 && rec.score <= 99, String(rec?.score));
const rec2 = recoveryFor(data.health, data.profile, today);
check('recovery is deterministic', rec?.score === rec2?.score);
const st = strainFor(data.health.find((d) => d.date === today));
check('strain is 0..21', st.score >= 0 && st.score <= 21, String(st.score));
const sl = sleepScoreFor(data.health, data.profile, today);
check('sleep score is 0..100', !!sl && sl.score >= 0 && sl.score <= 100, String(sl?.score));
check('VO2max estimate (age 32, RHR 56)', Math.abs(vo2maxEstimate(32, 56) - 50.8) < 0.2, String(vo2maxEstimate(32, 56)));
const g = macroGoals(data.profile);
check('macro goals add up', Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.kcal) < 10, JSON.stringify(g));
check('Epley 1RM 100kg x 5', Math.abs(estimated1RM(100, 5) - 116.67) < 0.01);
check('barcode check digit valid', isValidBarcode('4006381333931'));
check('barcode check digit invalid', !isValidBarcode('4006381333932'));
const weeks = weeklyVolume(data.sessions, data.profile.weightKg, today, 6);
check('weekly volume has data', weeks.some((w) => w.volume > 0));
const fat = muscleFatigue(data.sessions, data.profile.weightKg, today);
check('fatigue within 0..100', fat.every((m) => m.fatigue >= 0 && m.fatigue <= 100));

// Apple Health parser on a tiny synthetic export.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Watch" unit="count/min" startDate="2026-03-02 07:00:00 +0000" endDate="2026-03-02 07:00:00 +0000" value="52"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Watch" unit="ms" startDate="2026-03-02 03:00:00 +0000" endDate="2026-03-02 03:01:00 +0000" value="61">
  <HeartRateVariabilityMetadataList/>
 </Record>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-03-02 10:00:00 +0000" endDate="2026-03-02 10:10:00 +0000" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-03-02 12:00:00 +0000" endDate="2026-03-02 12:10:00 +0000" value="800"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-03-02 18:00:00 +0000" endDate="2026-03-02 18:00:00 +0000" value="150"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-03-02 18:05:00 +0000" endDate="2026-03-02 18:05:00 +0000" value="160"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-03-01 23:30:00 +0000" endDate="2026-03-02 01:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-03-02 01:00:00 +0000" endDate="2026-03-02 02:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-03-02 02:00:00 +0000" endDate="2026-03-02 03:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
</HealthData>`;
const agg = new AppleHealthAggregator();
xml.split('\n').forEach((l) => agg.line(l));
const days = agg.result(32);
check('import found records', agg.used === 9, `${agg.used} used of ${agg.records}`);
const steps = days.reduce((a, d) => a + d.steps, 0);
check('import sums steps', steps === 2000, String(steps));
const sleepDay = days.find((d) => d.sleep);
check('import builds sleep stages', !!sleepDay && sleepDay.sleep!.deepMin === 60 && sleepDay.sleep!.remMin === 90 && sleepDay.sleep!.coreMin === 90);
const merged = mergeHealth(data.health, days);
check('merge adds imported days', merged.health.length >= data.health.length);

// Live heart rate (Bluetooth Heart Rate Measurement + zones).
const hr8 = parseHeartRateMeasurement([0x06, 72]);
check('BLE HR uint8 with contact', !!hr8 && hr8.bpm === 72 && hr8.contact === true);
const hr16 = parseHeartRateMeasurement([0x01, 0xb4, 0x00]);
check('BLE HR uint16', hr16?.bpm === 180 && hr16.contact === null, JSON.stringify(hr16));
const hrRR = parseHeartRateMeasurement([0x10, 150, 0x00, 0x04]);
check('BLE RR interval 1024 -> 1000 ms', !!hrRR && hrRR.bpm === 150 && hrRR.rrMs[0] === 1000, JSON.stringify(hrRR));
check('BLE no contact flagged', parseHeartRateMeasurement([0x04, 80])?.contact === false);
check('zone index', zoneIndex(100, 200) === 0 && zoneIndex(170, 200) === 3 && zoneIndex(120, 200) === 1 && zoneIndex(199, 200) === 4 && zoneIndex(90, 200) === -1);
const recd = new SessionRecorder(200, 0);
for (let t = 0; t <= 600; t += 1) recd.add(t < 300 ? 130 : 170, t * 1000);
const sess = recd.finish('Test strap', 'bluetooth', 600000);
check('session zone minutes', sess.zoneMin[1] === 5 && sess.zoneMin[3] === 5, JSON.stringify(sess.zoneMin));
const withS = applySessionToDay(data.health, sess, today);
const before = data.health.find((d) => d.date === today)!.zoneMin[1];
check('session adds to today', withS.find((d) => d.date === today)!.zoneMin[1] === Math.round((before + 5) * 10) / 10);
check('brand detection', identifyBrand('Forerunner 265', 'com.garmin.connect.mobile') === 'garmin' && identifyBrand('Apple Watch ของ Nat', 'com.apple.health.ABC', 'Watch7,1') === 'apple-watch' && identifyBrand('Polar H10 1234') === 'polar');

check('empty data has no samples', !hasSampleData(createEmptyData()) && createEmptyData().health.length === 0);
const purged = purgeSampleData({ ...data, health: [...data.health, { ...data.health[0], date: '2020-01-01', source: 'manual' }] });
check('purge removes demo days, keeps manual', purged.health.length === 1 && purged.health[0].source === 'manual' && purged.sessions.length === 0 && purged.routines.length === 0);


// SQLite storage (same SQL as expo-sqlite on iPhone), using Node's built-in sqlite when available (Node 22.5+).
async function databaseChecks() {
  let sqlite: any;
  try {
    sqlite = require('node:sqlite');
  } catch {
    console.log('SKIP  SQLite checks — this Node has no built-in sqlite');
    return;
  }
  const raw = new sqlite.DatabaseSync(':memory:');
  const driver: SqlDriver = {
    exec: async (sql) => raw.exec(sql),
    run: async (sql, params) => void raw.prepare(sql).run(...params),
    all: async (sql, params = []) => raw.prepare(sql).all(...params),
    transaction: async (fn) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const db = new HealthDatabase(driver);
  await db.open();
  await db.open(); // migrations are idempotent
  check('db: empty database loads as null', (await db.load()) === null);
  const full = { ...data, foods: [{ id: 'f1', date: today, meal: 'lunch' as const, grams: 150, food: { id: 'x', name: 'Rice', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, source: 'built-in' as const } }], liveSessions: [sess] };
  const n1 = await db.save(full);
  const back = await db.load();
  check('db: round-trips every table', deepSame(back, full), `${n1} writes`);
  const n2 = await db.save(back!);
  check('db: unchanged save writes nothing', n2 === 0, String(n2));
  const day = back!.health[back!.health.length - 1];
  const edited = { ...back!, health: back!.health.map((h) => (h.date === day.date ? { ...h, steps: h.steps + 1 } : h)), foods: [] };
  const n3 = await db.save(edited);
  check('db: one edit + one delete = 2 writes', n3 === 2, String(n3));
  const again = await new HealthDatabase(driver).load();
  check('db: edits persisted', again!.health.find((h) => h.date === day.date)!.steps === day.steps + 1 && again!.foods.length === 0);
  const cf = (id: string) => ({ id, name: id, kcal: 1, protein: 0, carbs: 0, fat: 0, source: 'custom' as const });
  await db.save({ ...again!, customFoods: [cf('b'), cf('a')], foods: [] });
  const r1 = await new HealthDatabase(driver).load();
  await db.save({ ...r1!, customFoods: [cf('c'), ...r1!.customFoods] });
  const r2 = await new HealthDatabase(driver).load();
  check('db: list order kept (newest custom food first)', r2!.customFoods.map((f) => f.id).join('') === 'cba', r2!.customFoods.map((f) => f.id).join(''));
  const purgedDb = purgeSampleData(again!);
  await db.save(purgedDb);
  const counts = await db.counts();
  check('db: sample data purged from tables', counts.daily_health === 0 && counts.workout_sessions === 0 && counts.routines === 0, JSON.stringify(counts));
}

/** Compares two values ignoring object key order. */
function deepSame(a: any, b: any): boolean {
  const canon = (x: any): any => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
  const { version: _a, ...ra } = a ?? {};
  const { version: _b, ...rb } = b ?? {};
  return JSON.stringify(canon(ra)) === JSON.stringify(canon(rb));
}

databaseChecks().then(() => {
  if (failed) {
    console.log(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('All checks passed');
  
});
