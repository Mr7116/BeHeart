import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Card, H1, PremiumLock, Row, Segmented, Stat } from '../ui';
import { LineChart, Legend } from '../charts';
import { C } from '../theme';
import { addDays, shortLabel, todayISO } from '../../core/dates';
import { METRICS, MetricId, metricSeries, seriesStats } from '../../core/series';
import { rollingAverage } from '../../core/stats';

const COLORS: Record<MetricId, string> = {
  recovery: C.recovery.green,
  strain: C.strain,
  sleep: C.sleep,
  sleepHours: C.rem,
  hrv: C.hrv,
  rhr: C.rhr,
  resp: '#C8D3E0',
  steps: C.accent,
  activeKcal: C.protein,
};

export function TrendsScreen() {
  const { data } = useStore();
  const go = useNav();
  const premium = data.subscription.premium;
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [metric, setMetric] = useState<MetricId>('recovery');
  const today = todayISO();
  const locked = days > 7 && !premium;
  const meta = METRICS.find((m) => m.id === metric)!;

  const { cur, prev, avg7, avg30 } = useMemo(() => {
    // Fetch extra history so rolling averages are full from the first visible day.
    const long = metricSeries(data, metric, today, days + 30);
    const r7 = rollingAverage(long.values, 7).slice(30);
    const r30 = rollingAverage(long.values, 30).slice(30);
    const cur = { dates: long.dates.slice(30), values: long.values.slice(30) };
    const prev = metricSeries(data, metric, addDays(today, -days), days);
    return { cur, prev, avg7: r7, avg30: r30 };
  }, [data, metric, days, today]);

  const stats = seriesStats(cur.values);
  const prevStats = seriesStats(prev.values);
  const change = stats.avg != null && prevStats.avg != null && prevStats.avg !== 0 ? ((stats.avg - prevStats.avg) / Math.abs(prevStats.avg)) * 100 : null;
  const fmt = (v: number | null) => (v == null ? '—' : meta.digits ? v.toFixed(meta.digits) : Math.round(v).toLocaleString());

  return (
    <View>
      <H1 sub="Daily values with 7-day and 30-day rolling averages">Trends</H1>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as any}>
          {METRICS.map((m) => {
            const on = m.id === metric;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMetric(m.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: on ? COLORS[m.id] : C.border, backgroundColor: on ? COLORS[m.id] + '22' : 'transparent' }}
              >
                <Text style={{ color: on ? C.text : C.sub, fontSize: 13, fontWeight: '600' }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Segmented
          value={days}
          onChange={(v) => setDays(v)}
          options={[
            { value: 7, label: '7 days' },
            { value: 30, label: '30 days', locked: !premium },
            { value: 90, label: '90 days', locked: !premium },
          ]}
        />
      </Row>

      {locked ? (
        <Card>
          <PremiumLock
            height={320}
            title="Long-term trends are a Premium feature"
            text="The free plan shows the last 7 days. Premium unlocks 30- and 90-day history with rolling averages and period comparisons."
            onUpgrade={() => go('premium')}
          />
        </Card>
      ) : (
        <>
          <Card title={`${meta.label}${meta.unit ? ` (${meta.unit.replace('/', 'out of ')})` : ''}`} right={<Legend items={[{ label: 'Daily', color: COLORS[metric] }, { label: '7-day avg', color: C.text }, ...(days > 7 ? [{ label: '30-day avg', color: C.premium }] : [])]} />}>
            <LineChart
              height={300}
              labels={cur.dates.map(shortLabel)}
              series={[
                { values: cur.values, color: COLORS[metric] + 'AA', width: 1.5, dots: days <= 30 },
                { values: avg7, color: C.text, width: 2.5 },
                ...(days > 7 ? [{ values: avg30, color: C.premium, width: 2, dashed: true }] : []),
              ]}
              format={(v) => (meta.digits ? v.toFixed(meta.digits === 1 && Math.abs(v) < 10 ? 1 : 0) : Math.round(v).toLocaleString())}
              yMin={metric === 'recovery' || metric === 'sleep' ? 0 : metric === 'strain' ? 0 : undefined}
              yMax={metric === 'recovery' || metric === 'sleep' ? 100 : metric === 'strain' ? 21 : undefined}
            />
          </Card>
          <Card style={{ marginTop: 16 }} title={`Last ${days} days`}>
            <Row style={{ flexWrap: 'wrap' }}>
              <Stat label="Average" value={fmt(stats.avg)} unit={meta.unit} />
              <Stat label="Lowest" value={fmt(stats.min)} unit={meta.unit} />
              <Stat label="Highest" value={fmt(stats.max)} unit={meta.unit} />
              <Stat label="Std. deviation" value={fmt(stats.sd)} hint="Day-to-day variability" />
              <Stat
                label={`vs. previous ${days} days`}
                value={change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                color={change == null ? undefined : (change >= 0) === (metric !== 'rhr' && metric !== 'resp') ? C.recovery.green : C.recovery.red}
                hint={prevStats.avg != null ? `Previous avg ${fmt(prevStats.avg)}` : 'No earlier data'}
              />
              <Stat label="Days with data" value={`${stats.count}/${days}`} />
            </Row>
          </Card>
        </>
      )}
    </View>
  );
}
