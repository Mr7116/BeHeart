import React from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Body, Card, H1, PremiumLock, Row, Stat, Columns } from '../ui';
import { BarChart, LineChart, SplitBar } from '../charts';
import { C, ZONE_COLORS } from '../theme';
import { addDays, dateRange, shortLabel, todayISO, weekStart } from '../../core/dates';
import { maxHeartRate, strainFor, vo2Category, vo2maxEstimate, ZONE_LABELS } from '../../core/scoring';
import { mean, rollingAverage } from '../../core/stats';

export function CardioScreen() {
  const { data } = useStore();
  const go = useNav();
  const premium = data.subscription.premium;
  const today = todayISO();

  if (!premium) {
    return (
      <View>
        <H1 sub="Estimated VO₂max, resting heart-rate trend, zone distribution and weekly cardio load">Cardio Fitness</H1>
        <Card>
          <PremiumLock
            height={380}
            title="Detailed cardiovascular fitness reports"
            text="Premium estimates your VO₂max from resting and maximum heart rate, tracks it over time, and shows how your training is spread across heart-rate zones."
            onUpgrade={() => go('premium')}
          />
        </Card>
      </View>
    );
  }

  const byDate = new Map(data.health.map((d) => [d.date, d] as const));
  const age = data.profile.age;
  const hrMax = maxHeartRate(age);
  const last7 = dateRange(today, 7).map((d) => byDate.get(d)?.restingHr).filter((v): v is number => v != null);
  const rhrNow = last7.length ? mean(last7) : null;
  const vo2 = rhrNow ? vo2maxEstimate(age, rhrNow) : null;

  const d90 = dateRange(today, 90);
  const rhr90 = d90.map((d) => byDate.get(d)?.restingHr ?? null);
  const rhrRoll = rollingAverage(rhr90, 7);
  const vo2Trend = rhrRoll.map((r) => (r ? vo2maxEstimate(age, r) : null));
  const vo2Then = vo2Trend.find((v) => v != null) ?? null;

  const d30 = dateRange(today, 30);
  const zones30: number[] = [0, 0, 0, 0, 0];
  for (const d of d30) byDate.get(d)?.zoneMin.forEach((m, i) => (zones30[i] += m));
  const zoneTotal = zones30.reduce((a, b) => a + b, 0) || 1;

  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) weeks.push(addDays(weekStart(today), -7 * i));
  const weekLoad = weeks.map((w) => {
    let t = 0;
    for (let i = 0; i < 7; i++) t += strainFor(byDate.get(addDays(w, i))).trimp;
    return t;
  });
  const acute = weekLoad[weekLoad.length - 1];
  const chronic = mean(weekLoad.slice(-5, -1).filter((v) => v > 0)) || 0;
  const acwr = chronic ? acute / chronic : null;

  return (
    <View>
      <H1 sub="Estimated VO₂max, resting heart-rate trend, zone distribution and weekly cardio load">Cardio Fitness</H1>
      <Card>
        <Row style={{ flexWrap: 'wrap' }}>
          <Stat label="Estimated VO₂max" value={vo2 ? vo2.toFixed(1) : '—'} unit="ml/kg/min" color={C.accent} hint={vo2 ? vo2Category(vo2, age, data.profile.sex) : undefined} />
          <Stat label="90-day change" value={vo2 && vo2Then ? `${vo2 - vo2Then >= 0 ? '+' : ''}${(vo2 - vo2Then).toFixed(1)}` : '—'} unit="ml/kg/min" />
          <Stat label="Resting HR (7-day)" value={rhrNow ? rhrNow.toFixed(0) : '—'} unit="bpm" color={C.rhr} />
          <Stat label="Max HR (age based)" value={String(hrMax)} unit="bpm" hint="208 − 0.7 × age" />
          <Stat
            label="Acute : chronic load"
            value={acwr ? acwr.toFixed(2) : '—'}
            color={acwr == null ? undefined : acwr > 1.5 ? C.recovery.red : acwr < 0.8 ? C.recovery.yellow : C.recovery.green}
            hint={acwr == null ? undefined : acwr > 1.5 ? 'Load rising fast' : acwr < 0.8 ? 'Detraining' : 'Productive range 0.8–1.5'}
          />
        </Row>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 12 }}>VO₂max ≈ 15.3 × max HR ÷ resting HR. This is an estimate from heart-rate data, not a lab test.</Text>
      </Card>

      <Columns style={{ marginTop: 16 }}>
        <Card style={{ flex: 1 }} title="Estimated VO₂max · 90 days">
          <LineChart height={200} labels={d90.map(shortLabel)} series={[{ values: vo2Trend, color: C.accent, width: 2.5 }]} format={(v) => v.toFixed(0)} />
        </Card>
        <Card style={{ flex: 1 }} title="Resting heart rate · 90 days">
          <LineChart
            height={200}
            labels={d90.map(shortLabel)}
            series={[
              { values: rhr90, color: C.rhr + '88', width: 1.2 },
              { values: rhrRoll, color: C.rhr, width: 2.5 },
            ]}
          />
        </Card>
      </Columns>

      <Columns style={{ marginTop: 16 }}>
        <Card style={{ flex: 1 }} title="Heart-rate zones · last 30 days">
          <SplitBar height={16} parts={zones30.map((m, i) => ({ value: m, color: ZONE_COLORS[i] }))} />
          <View style={{ marginTop: 12, gap: 8 } as any}>
            {zones30.map((m, i) => {
              const lo = Math.round(hrMax * (0.5 + i * 0.1));
              const hi = Math.round(hrMax * (0.6 + i * 0.1));
              return (
                <Row key={i} style={{ justifyContent: 'space-between' }}>
                  <Row gap={8} style={{ alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ZONE_COLORS[i] }} />
                    <Text style={{ color: C.sub, fontSize: 13 }}>
                      {ZONE_LABELS[i]} ({lo}–{hi} bpm)
                    </Text>
                  </Row>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                    {Math.round(m / 60)} h {Math.round(m % 60)} m · {Math.round((m / zoneTotal) * 100)}%
                  </Text>
                </Row>
              );
            })}
          </View>
          <Body style={{ marginTop: 12, fontSize: 12 }}>
            {zones30[1] / zoneTotal >= 0.25 ? 'Good aerobic base: plenty of Zone 2 time.' : 'Consider more easy Zone 2 sessions to build your aerobic base.'}
          </Body>
        </Card>
        <Card style={{ flex: 1 }} title="Weekly cardio load (TRIMP) · 12 weeks">
          <BarChart values={weekLoad} labels={weeks.map(shortLabel)} colors={weekLoad.map((_, i) => (i === weekLoad.length - 1 ? C.strain : C.strain + '88'))} height={240} />
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Zone minutes × zone number, summed per week. The current week is still in progress.</Text>
        </Card>
      </Columns>
    </View>
  );
}
