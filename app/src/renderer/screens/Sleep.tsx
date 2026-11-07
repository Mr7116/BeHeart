import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Body, Card, H1, Label, PremiumLock, Progress, Row, Stat, Columns } from '../ui';
import { Legend, LineChart, Ring, SplitBar, StackedBars } from '../charts';
import { C } from '../theme';
import { clockLabel, dateRange, durationLabel, shortLabel, todayISO, weekdayLabel } from '../../core/dates';
import { asleepMinutes, sleepNeedFor, sleepScoreFor } from '../../core/scoring';
import { mean } from '../../core/stats';

export function SleepScreen() {
  const { data } = useStore();
  const go = useNav();
  const premium = data.subscription.premium;
  const today = todayISO();
  const night = data.health.find((d) => d.date === today);
  const score = useMemo(() => sleepScoreFor(data.health, data.profile, today), [data, today]);
  const need = sleepNeedFor(data.health, data.profile, today);
  const byDate = new Map(data.health.map((d) => [d.date, d] as const));

  const week = dateRange(today, 7);
  const month = dateRange(today, 30);
  const stackFor = (dates: string[]) =>
    dates.map((d) => {
      const s = byDate.get(d)?.sleep;
      return s ? [s.deepMin / 60, s.coreMin / 60, s.remMin / 60, s.awakeMin / 60] : [0, 0, 0, 0];
    });

  const monthNights = month.map((d) => byDate.get(d)?.sleep).filter((s): s is NonNullable<typeof s> => !!s);
  const avgAsleep = monthNights.length ? mean(monthNights.map(asleepMinutes)) : 0;
  const avgDeepPct = monthNights.length ? mean(monthNights.map((s) => (s.deepMin / Math.max(1, asleepMinutes(s))) * 100)) : 0;
  const avgRemPct = monthNights.length ? mean(monthNights.map((s) => (s.remMin / Math.max(1, asleepMinutes(s))) * 100)) : 0;
  const avgEff = monthNights.length ? mean(monthNights.map((s) => asleepMinutes(s) / Math.max(1, s.inBedMin))) : 0;
  const debt7 = week.reduce((acc, d) => {
    const s = byDate.get(d)?.sleep;
    return acc + (s ? Math.max(0, data.profile.sleepNeedH * 60 - asleepMinutes(s)) : 0);
  }, 0);
  const scores30 = month.map((d) => sleepScoreFor(data.health, data.profile, d)?.score ?? null);
  const bedtimes30 = month.map((d) => byDate.get(d)?.sleep?.bedtimeMin ?? null);

  return (
    <View>
      <H1 sub="Scored against standard sleep-stage proportions, your sleep need and bedtime regularity">Sleep</H1>
      <Columns>
        <Card style={{ flex: 1 }} title="Last night">
          <Columns style={{ alignItems: 'center' }} gap={28}>
            <Ring value={score?.score ?? null} max={100} color={C.sleep} center={score ? String(score.score) : '—'} sub="Sleep score" size={160} />
            <View style={{ flex: 1, gap: 14 } as any}>
              <View>
                <Label>Time asleep</Label>
                <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{score ? durationLabel(score.asleepMin) : '—'}</Text>
                <Text style={{ color: C.sub, fontSize: 13 }}>
                  Need {durationLabel(need.totalMin)} (baseline {durationLabel(need.baselineMin)}
                  {need.strainMin > 0 ? ` + ${Math.round(need.strainMin)}m strain` : ''}
                  {need.debtMin > 0 ? ` + ${Math.round(need.debtMin)}m debt` : ''})
                </Text>
              </View>
              {night?.sleep ? (
                <View>
                  <SplitBar
                    height={16}
                    parts={[
                      { value: night.sleep.deepMin, color: C.deep },
                      { value: night.sleep.coreMin, color: C.core },
                      { value: night.sleep.remMin, color: C.rem },
                      { value: night.sleep.awakeMin, color: C.awake },
                    ]}
                  />
                  <View style={{ marginTop: 10 }}>
                    <Legend
                      items={[
                        { label: `Deep ${durationLabel(night.sleep.deepMin)}`, color: C.deep },
                        { label: `Core ${durationLabel(night.sleep.coreMin)}`, color: C.core },
                        { label: `REM ${durationLabel(night.sleep.remMin)}`, color: C.rem },
                        { label: `Awake ${night.sleep.awakeMin}m`, color: C.awake },
                      ]}
                    />
                  </View>
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>
                    In bed from {clockLabel(night.sleep.bedtimeMin)} to {clockLabel(night.sleep.bedtimeMin + night.sleep.inBedMin)}
                  </Text>
                </View>
              ) : (
                <Body>No sleep recorded last night.</Body>
              )}
            </View>
          </Columns>
        </Card>
        <Card style={{ flex: 0.8 }} title="Last 7 nights">
          <StackedBars stacks={stackFor(week)} labels={week.map(weekdayLabel)} colors={[C.deep, C.core, C.rem, C.awake]} height={190} target={data.profile.sleepNeedH} format={(v) => `${v.toFixed(0)}h`} />
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Dashed line: your baseline need of {data.profile.sleepNeedH} h</Text>
        </Card>
      </Columns>

      {premium ? (
        <>
          <Columns style={{ marginTop: 16 }}>
            <Card style={{ flex: 1 }} title="Score breakdown">
              {score ? (
                <View style={{ gap: 12 } as any}>
                  <Part label="Duration vs. need" pts={score.durationPts} max={50} detail={`${Math.round((score.asleepMin / score.needMin) * 100)}% of need`} />
                  <Part label="Deep sleep (target 13–23%)" pts={score.deepPts} max={15} detail={`${score.deepPct.toFixed(0)}%`} />
                  <Part label="REM sleep (target 20–25%)" pts={score.remPts} max={15} detail={`${score.remPct.toFixed(0)}%`} />
                  <Part label="Efficiency (asleep ÷ in bed)" pts={score.efficiencyPts} max={10} detail={`${Math.round(score.efficiency * 100)}%`} />
                  <Part label="Bedtime consistency (7 nights)" pts={score.consistencyPts} max={10} detail={`± ${Math.round(score.bedtimeSdMin)} min`} />
                </View>
              ) : (
                <Body>No sleep to score.</Body>
              )}
            </Card>
            <Card style={{ flex: 1 }} title="30-night averages">
              <Row style={{ flexWrap: 'wrap', rowGap: 18 } as any}>
                <Stat label="Avg asleep" value={durationLabel(avgAsleep)} />
                <Stat label="Avg efficiency" value={`${Math.round(avgEff * 100)}`} unit="%" />
                <Stat label="Deep share" value={avgDeepPct.toFixed(0)} unit="%" color="#8F79FF" hint="Target 13–23%" />
                <Stat label="REM share" value={avgRemPct.toFixed(0)} unit="%" color={C.rem} hint="Target 20–25%" />
                <Stat label="7-night sleep debt" value={durationLabel(debt7)} color={debt7 > 180 ? C.recovery.red : debt7 > 60 ? C.recovery.yellow : C.recovery.green} />
              </Row>
            </Card>
          </Columns>
          <Card style={{ marginTop: 16 }} title="Sleep stages · 30 nights" right={<Legend items={[{ label: 'Deep', color: C.deep }, { label: 'Core', color: C.core }, { label: 'REM', color: C.rem }, { label: 'Awake', color: C.awake }]} />}>
            <StackedBars stacks={stackFor(month)} labels={month.map(shortLabel)} colors={[C.deep, C.core, C.rem, C.awake]} height={220} target={data.profile.sleepNeedH} format={(v) => `${v.toFixed(0)}h`} />
          </Card>
          <Columns style={{ marginTop: 16 }}>
            <Card style={{ flex: 1 }} title="Sleep score · 30 nights">
              <LineChart height={180} labels={month.map(shortLabel)} series={[{ values: scores30, color: C.sleep, dots: true }]} yMin={0} yMax={100} />
            </Card>
            <Card style={{ flex: 1 }} title="Bedtime · 30 nights">
              <LineChart height={180} labels={month.map(shortLabel)} series={[{ values: bedtimes30, color: C.core, dots: true }]} format={(v) => clockLabel(v)} />
            </Card>
          </Columns>
        </>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <PremiumLock
            height={240}
            title="Deep sleep analytics"
            text="See how each part of your score is earned, your stage percentages against targets, 30-night stage history, bedtime consistency and sleep debt."
            onUpgrade={() => go('premium')}
          />
        </Card>
      )}
    </View>
  );
}

function Part({ label, pts, max, detail }: { label: string; pts: number; max: number; detail: string }) {
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
          {detail} · {pts.toFixed(0)}/{max}
        </Text>
      </Row>
      <View style={{ marginTop: 6 }}>
        <Progress value={pts} max={max} color={C.sleep} height={6} />
      </View>
    </View>
  );
}
