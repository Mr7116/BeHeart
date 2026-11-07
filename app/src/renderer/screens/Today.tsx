import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Body, Button, Card, H1, Label, Pill, Progress, Row, Stat, Columns, useIsPhone } from '../ui';
import { BarChart, Legend, Ring, SplitBar } from '../charts';
import { C, ZONE_COLORS, recoveryColor } from '../theme';
import { addDays, dateRange, durationLabel, longLabel, todayISO, weekdayLabel } from '../../core/dates';
import { recoveryAdvice, recoveryFor, sleepScoreFor, strainFor, targetStrain, ZONE_LABELS, maxHeartRate } from '../../core/scoring';
import { dayTotals, macroGoals } from '../../core/nutrition';
import { muscleFatigue, sessionVolume } from '../../core/workouts';
import { useDevices } from '../devices';
import { zoneIndex } from '../../core/heartRate';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function TodayScreen() {
  const { data } = useStore();
  const go = useNav();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const premium = data.subscription.premium;
  const minFree = addDays(today, -6);
  const canGoBack = premium || addDays(date, -1) >= minFree;

  const day = data.health.find((d) => d.date === date);
  const rec = useMemo(() => recoveryFor(data.health, data.profile, date), [data.health, data.profile, date]);
  const strain = strainFor(day);
  const sleep = useMemo(() => sleepScoreFor(data.health, data.profile, date), [data.health, data.profile, date]);
  const [tLo, tHi] = targetStrain(rec);

  const week = dateRange(date, 7);
  const weekRec = week.map((d) => recoveryFor(data.health, data.profile, d)?.score ?? 0);
  const weekStrain = week.map((d) => strainFor(data.health.find((h) => h.date === d)).score);

  const goals = macroGoals(data.profile);
  const eaten = dayTotals(data.foods, date);
  const sessionsToday = data.sessions.filter((s) => s.date === date);
  const fatigue = muscleFatigue(data.sessions, data.profile.weightKg, date)
    .filter((m) => m.fatigue > 0)
    .sort((a, b) => b.fatigue - a.fatigue)
    .slice(0, 4);
  const zoneTotal = day ? day.zoneMin.reduce((a, b) => a + b, 0) : 0;
  const phone = useIsPhone();
  const ring = phone ? 96 : 150;

  return (
    <View>
      <Columns style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1 sub={`${longLabel(date)}${date === today ? ' · Today' : ''}`}>
          {date === today ? `${greeting()}, ${data.profile.name}` : 'Daily summary'}
        </H1>
        <Row gap={8} style={{ alignItems: 'center', marginBottom: 14 }}>
          <Button title="‹" kind="ghost" small disabled={!canGoBack} onPress={() => setDate(addDays(date, -1))} />
          <Button title="Today" kind="ghost" small disabled={date === today} onPress={() => setDate(today)} />
          <Button title="›" kind="ghost" small disabled={date >= today} onPress={() => setDate(addDays(date, 1))} />
        </Row>
      </Columns>
      {date === today ? <LiveHeart onOpen={() => go('devices')} maxHr={maxHeartRate(data.profile.age)} /> : null}
      {data.health.length === 0 ? (
        <Card style={{ marginBottom: 16 }} title="No health data yet">
          <Body>Recovery, Strain and Sleep scores appear once BeHeart has heart-rate, HRV and sleep data. Connect your Apple Watch or another watch, or enter a day by hand.</Body>
          <Row gap={10} style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Button title="Connect a watch" onPress={() => go('devices')} />
            <Button title="Enter data by hand" kind="ghost" onPress={() => go('health')} />
          </Row>
        </Card>
      ) : null}
      {!premium && !canGoBack ? (
        <Text style={{ color: C.premium, fontSize: 12, marginTop: -10, marginBottom: 12 }}>Free plan shows the last 7 days. Premium unlocks your full history.</Text>
      ) : null}

      <Columns>
        <Card style={{ flex: 1.35 }}>
          <Row gap={phone ? 6 : 16} style={{ justifyContent: phone ? 'space-between' : 'space-around', paddingVertical: 6 }}>
            <Ring size={ring} stroke={phone ? 9 : 12} value={rec?.score ?? null} max={100} color={recoveryColor(rec?.score)} center={rec ? `${rec.score}%` : '—'} label="Recovery" />
            <Ring size={ring} stroke={phone ? 9 : 12} value={strain.score} max={21} color={C.strain} center={strain.score.toFixed(1)} sub={strain.label} label="Strain" />
            <Ring size={ring} stroke={phone ? 9 : 12} value={sleep?.score ?? null} max={100} color={C.sleep} center={sleep ? String(sleep.score) : '—'} sub={sleep ? durationLabel(sleep.asleepMin) : undefined} label="Sleep" />
          </Row>
        </Card>
        <Card style={{ flex: 1 }} title="Today's guidance">
          <Pill text={rec ? (rec.zone === 'green' ? 'Ready to perform' : rec.zone === 'yellow' ? 'Maintain' : 'Restore') : 'No data'} color={recoveryColor(rec?.score)} />
          <Body style={{ marginTop: 10 }}>{recoveryAdvice(rec)}</Body>
          <View style={{ marginTop: 14 }}>
            <Label>Target strain</Label>
            <Text style={{ color: C.strain, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
              {tLo} – {tHi}
            </Text>
            <View style={{ marginTop: 8 }}>
              <Progress value={strain.score} max={21} color={C.strain} />
            </View>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>
              {strain.score >= tHi ? 'You have reached your target. Time to recover.' : strain.score >= tLo ? 'In your target range.' : `${(tLo - strain.score).toFixed(1)} more to reach your range.`}
            </Text>
          </View>
        </Card>
      </Columns>

      <Card style={{ marginTop: 16 }} title="Vitals" right={<Text style={{ color: C.faint, fontSize: 12 }}>{day ? sourceLabel(day.source) : 'No data for this day'}</Text>}>
        <Row style={{ flexWrap: 'wrap' }}>
          <Stat label="HRV" value={day?.hrv != null ? String(day.hrv) : '—'} unit="ms" color={C.hrv} hint={rec ? `Baseline ${Math.round(rec.baseline.hrvMean)} ms` : undefined} />
          <Stat label="Resting HR" value={day?.restingHr != null ? String(day.restingHr) : '—'} unit="bpm" color={C.rhr} hint={rec ? `Baseline ${Math.round(rec.baseline.rhrMean)} bpm` : undefined} />
          <Stat label="Respiratory" value={day?.respRate != null ? day.respRate.toFixed(1) : '—'} unit="br/min" hint={rec ? `Baseline ${rec.baseline.respMean.toFixed(1)}` : undefined} />
          <Stat label="Steps" value={day ? day.steps.toLocaleString() : '—'} />
          <Stat label="Active energy" value={day ? String(day.activeKcal) : '—'} unit="kcal" />
          <Stat label="Avg / Max HR" value={day?.avgHr != null ? `${day.avgHr} / ${day.maxHr ?? '—'}` : '—'} unit="bpm" hint={`Max HR ${maxHeartRate(data.profile.age)}`} />
        </Row>
      </Card>

      <Columns style={{ marginTop: 16 }}>
        <Card style={{ flex: 1 }} title="Recovery breakdown">
          {rec ? (
            <View style={{ gap: 12 } as any}>
              <Breakdown label="HRV vs. baseline (50%)" value={rec.hrvZ} />
              <Breakdown label="Resting HR vs. baseline (25%)" value={rec.rhrZ} />
              <View>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: C.sub, fontSize: 13 }}>Sleep performance (25%)</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{Math.round(rec.sleepPerformance * 100)}%</Text>
                </Row>
                <View style={{ marginTop: 6 }}>
                  <Progress value={rec.sleepPerformance} max={1} color={C.sleep} height={6} />
                </View>
              </View>
              {rec.respPenalty > 0 ? <Text style={{ color: C.recovery.yellow, fontSize: 12 }}>Respiratory rate is elevated: −{Math.round(rec.respPenalty)} points.</Text> : null}
              <Text style={{ color: C.faint, fontSize: 12 }}>
                Baseline from {rec.baseline.days ? `${rec.baseline.days} previous days` : 'typical adult values (not enough history yet)'}.
              </Text>
            </View>
          ) : (
            <Body>Overnight HRV and resting heart rate are needed to score recovery.</Body>
          )}
        </Card>
        <Card style={{ flex: 1 }} title="Heart-rate zones">
          {day && zoneTotal > 0 ? (
            <View>
              <SplitBar parts={day.zoneMin.map((m, i) => ({ value: m, color: ZONE_COLORS[i] }))} />
              <View style={{ marginTop: 12, gap: 6 } as any}>
                {day.zoneMin.map((m, i) => (
                  <Row key={i} style={{ justifyContent: 'space-between' }}>
                    <Row gap={8} style={{ alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ZONE_COLORS[i] }} />
                      <Text style={{ color: C.sub, fontSize: 13 }}>{ZONE_LABELS[i]}</Text>
                    </Row>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{m} min</Text>
                  </Row>
                ))}
              </View>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>Cardio load (TRIMP) {strain.trimp} · total load {strain.load}</Text>
            </View>
          ) : (
            <Body>No heart-rate data for this day.</Body>
          )}
        </Card>
        <Card style={{ flex: 1 }} title="Last 7 days">
          <BarChart values={weekRec} labels={week.map(weekdayLabel)} colors={weekRec.map((v) => recoveryColor(v))} height={120} />
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 4, marginBottom: 8 }}>Recovery %</Text>
          <BarChart values={weekStrain} labels={week.map(weekdayLabel)} colors={C.strain} height={100} format={(v) => v.toFixed(0)} />
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 4 }}>Strain</Text>
        </Card>
      </Columns>

      <Columns style={{ marginTop: 16 }}>
        <Card style={{ flex: 1 }} title="Nutrition" right={<Button title="Log food" small kind="ghost" onPress={() => go('nutrition')} />}>
          <Row style={{ alignItems: 'flex-end', marginBottom: 10 }} gap={8}>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>{Math.round(eaten.kcal)}</Text>
            <Text style={{ color: C.sub, fontSize: 13, marginBottom: 3 }}>/ {goals.kcal} kcal</Text>
          </Row>
          <Progress value={eaten.kcal} max={goals.kcal} color={C.accent} />
          <View style={{ marginTop: 12, gap: 8 } as any}>
            <MacroLine label="Protein" v={eaten.protein} goal={goals.protein} color={C.protein} />
            <MacroLine label="Carbs" v={eaten.carbs} goal={goals.carbs} color={C.carbs} />
            <MacroLine label="Fat" v={eaten.fat} goal={goals.fat} color={C.fat} />
          </View>
        </Card>
        <Card style={{ flex: 1 }} title="Training" right={<Button title="Log workout" small kind="ghost" onPress={() => go('workouts')} />}>
          {sessionsToday.length ? (
            sessionsToday.map((s) => (
              <Text key={s.id} style={{ color: C.text, fontSize: 14, marginBottom: 4 }}>
                {s.name} · {s.exercises.length} exercises · {sessionVolume(s, data.profile.weightKg).toLocaleString()} kg volume
              </Text>
            ))
          ) : (
            <Body>No strength session logged {date === today ? 'yet today' : 'on this day'}.</Body>
          )}
          <Label style={{ marginTop: 14, marginBottom: 8 }}>Most fatigued muscles</Label>
          {fatigue.length ? (
            fatigue.map((m) => (
              <View key={m.muscle} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: C.sub, fontSize: 13 }}>{m.label}</Text>
                  <Text style={{ color: C.text, fontSize: 13 }}>
                    {m.fatigue}% · {m.status}
                  </Text>
                </Row>
                <View style={{ marginTop: 4 }}>
                  <Progress value={m.fatigue} max={100} color={m.fatigue >= 70 ? C.recovery.red : m.fatigue >= 35 ? C.recovery.yellow : C.recovery.green} height={5} />
                </View>
              </View>
            ))
          ) : (
            <Body>All muscle groups are fresh.</Body>
          )}
        </Card>
        <Card style={{ flex: 1 }} title="Sleep" right={<Button title="Details" small kind="ghost" onPress={() => go('sleep')} />}>
          {sleep && day?.sleep ? (
            <View>
              <Row style={{ alignItems: 'flex-end' }} gap={8}>
                <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>{durationLabel(sleep.asleepMin)}</Text>
                <Text style={{ color: C.sub, fontSize: 13, marginBottom: 3 }}>of {durationLabel(sleep.needMin)} needed</Text>
              </Row>
              <View style={{ marginTop: 12 }}>
                <SplitBar
                  parts={[
                    { value: day.sleep.deepMin, color: C.deep },
                    { value: day.sleep.coreMin, color: C.core },
                    { value: day.sleep.remMin, color: C.rem },
                    { value: day.sleep.awakeMin, color: C.awake },
                  ]}
                />
              </View>
              <View style={{ marginTop: 10 }}>
                <Legend
                  items={[
                    { label: `Deep ${durationLabel(day.sleep.deepMin)}`, color: C.deep },
                    { label: `Core ${durationLabel(day.sleep.coreMin)}`, color: C.core },
                    { label: `REM ${durationLabel(day.sleep.remMin)}`, color: C.rem },
                    { label: `Awake ${day.sleep.awakeMin}m`, color: C.awake },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Body>No sleep recorded for this night.</Body>
          )}
        </Card>
      </Columns>
    </View>
  );
}

/** Compact live heart-rate strip shown on Today while a watch or sensor is sending readings. */
function LiveHeart({ onOpen, maxHr }: { onOpen: () => void; maxHr: number }) {
  const dev = useDevices();
  if (!dev.live && !dev.recording) return null;
  const z = dev.live ? zoneIndex(dev.live.bpm, maxHr) : -1;
  const color = z >= 0 ? ZONE_COLORS[z] : C.rhr;
  return (
    <Pressable onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: color + '66', marginBottom: 16 }}>
      <Text style={{ color, fontSize: 22 }}>♥</Text>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>
        {dev.live ? dev.live.bpm : '—'}
        <Text style={{ color: C.sub, fontSize: 13, fontWeight: '600' }}> bpm</Text>
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>{dev.live ? dev.live.source : 'Waiting for heart rate…'}</Text>
        <Text style={{ color: dev.recording ? C.recovery.red : C.faint, fontSize: 11 }}>{dev.recording ? '● Recording workout' : z >= 0 ? `Zone ${z + 1}` : 'Live'}</Text>
      </View>
      <Text style={{ color: C.faint, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export function sourceLabel(s: string): string {
  return s === 'demo-wearable' ? 'Synced · demo wearable' : s === 'apple-health-import' ? 'Imported · Apple Health' : 'Entered manually';
}

function Breakdown({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, (value + 2.5) / 5));
  const color = value >= 0.4 ? C.recovery.green : value >= -0.6 ? C.recovery.yellow : C.recovery.red;
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
          {value >= 0 ? '+' : ''}
          {value.toFixed(1)} SD
        </Text>
      </Row>
      <View style={{ marginTop: 6 }}>
        <Progress value={pct} max={1} color={color} height={6} />
      </View>
    </View>
  );
}

function MacroLine({ label, v, goal, color }: { label: string; v: number; goal: number; color: string }) {
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 13 }}>
          {Math.round(v)} / {goal} g
        </Text>
      </Row>
      <View style={{ marginTop: 4 }}>
        <Progress value={v} max={goal} color={color} height={5} />
      </View>
    </View>
  );
}
