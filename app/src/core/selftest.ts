// Quick self-test of the deterministic formulas and the Apple Health parser (run with `npm test`).
import { AppleHealthAggregator, mergeHealth } from './appleHealth';
import { createInitialData } from './defaults';
import { recoveryFor, sleepScoreFor, strainFor, vo2maxEstimate } from './scoring';
import { macroGoals, isValidBarcode } from './nutrition';
import { estimated1RM, muscleFatigue, weeklyVolume } from './workouts';
import { todayISO } from './dates';
import { applySessionToDay, identifyBrand, parseHeartRateMeasurement, SessionRecorder, zoneIndex } from './heartRate';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

const data = createInitialData();
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

if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
