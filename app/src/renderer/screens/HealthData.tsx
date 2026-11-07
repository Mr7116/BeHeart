import React, { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { useStore } from '../store';
import { Body, Button, Card, Field, H1, Label, Row, Columns } from '../ui';
import { C } from '../theme';
import { addDays, durationLabel, shortLabel, todayISO } from '../../core/dates';
import { mergeHealth } from '../../core/appleHealth';
import { asleepMinutes, recoveryFor, strainFor } from '../../core/scoring';
import { DailyHealth } from '../../core/types';
import { bridge } from '../bridge';
import { sourceLabel } from './Today';

export function HealthDataScreen() {
  const { data, update, syncNow, canUseHealthKit, connectHealthKit, disconnectHealthKit } = useStore();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const doImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await bridge.importAppleHealth(data.profile.age);
      if (!r) {
        setImportMsg(null);
      } else if (!r.days.length) {
        setImportMsg(`Read ${r.records.toLocaleString()} records from ${r.file} but found no heart, sleep or activity data.`);
      } else {
        let changed = 0;
        update((d) => {
          const m = mergeHealth(d.health, r.days);
          changed = m.changed;
          return { ...d, health: m.health };
        });
        setImportMsg(`Imported ${r.days.length} days (${r.used.toLocaleString()} of ${r.records.toLocaleString()} records used) from ${r.file}. ${changed ? '' : 'Days you entered by hand were kept.'}`);
      }
    } catch (e: any) {
      setImportMsg(`Import failed: ${e?.message ?? e}`);
    } finally {
      setImporting(false);
    }
  };

  const recent = [...data.health].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 21);
  const counts = data.health.reduce(
    (acc, d) => {
      acc[d.source] = (acc[d.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <View>
      <H1 sub="Where your heart, sleep and activity numbers come from">Health Data</H1>
      <Columns style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} title={canUseHealthKit ? 'Apple Health' : 'Wearable sync'}>
          {canUseHealthKit ? (
            <View>
              <Body>
                {data.healthKitConnected
                  ? 'Connected. Heart rate, resting heart rate, HRV, respiratory rate, steps, active energy and sleep stages are read from Apple Health whenever the app opens and every 15 minutes while it is open.'
                  : 'Connect Apple Health to use your real iPhone and Apple Watch data instead of the sample data.'}
              </Body>
              <Row style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }} gap={10}>
                {data.healthKitConnected ? (
                  <Button title="Use sample data instead" kind="ghost" small onPress={() => { disconnectHealthKit(); setSyncMsg(null); }} />
                ) : (
                  <Button
                    title={busy ? 'Connecting…' : 'Connect Apple Health'}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      setSyncMsg(await connectHealthKit().catch((e) => `Could not connect: ${e?.message ?? e}`));
                      setBusy(false);
                    }}
                  />
                )}
              </Row>
            </View>
          ) : (
            <Body>
              Live Apple Health sync works in the iPhone app. On the desktop, a demo wearable fills in realistic sample days so every score works, and it
              keeps itself up to date while the app is open.
            </Body>
          )}
          <Row style={{ alignItems: 'center', marginTop: 14, justifyContent: 'space-between' }}>
            <Text style={{ color: C.text, fontSize: 14 }}>Automatic sync</Text>
            <Switch value={data.autoSync} onValueChange={(v) => update((d) => ({ ...d, autoSync: v }))} thumbColor={C.text} trackColor={{ false: C.border, true: C.accent }} />
          </Row>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>Last sync: {data.lastSync ? new Date(data.lastSync).toLocaleString() : 'never'}</Text>
          <Row style={{ marginTop: 12, alignItems: 'center' }} gap={10}>
            <Button
              title="Sync now"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                setSyncMsg(await syncNow().catch((e) => `Sync failed: ${e?.message ?? e}`));
                setBusy(false);
              }}
            />
            {syncMsg ? <Text style={{ color: C.accent, fontSize: 13 }}>{syncMsg}</Text> : null}
          </Row>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 12 }}>
            {counts['demo-wearable'] ?? 0} demo days · {counts['apple-health-import'] ?? 0} from Apple Health · {counts['manual'] ?? 0} entered by hand
          </Text>
        </Card>
        {canUseHealthKit ? null : (
        <Card style={{ flex: 1 }} title="Import from Apple Health">
          <Body>On your iPhone open Health → your picture → Export All Health Data, unzip the file on this computer, then choose the export.xml inside.</Body>
          <Body style={{ marginTop: 6 }}>Heart rate, resting heart rate, HRV, respiratory rate, steps, active energy and sleep stages are read. Days you entered by hand are never overwritten.</Body>
          <Row style={{ marginTop: 14, alignItems: 'center' }} gap={10}>
            <Button title="Choose export.xml…" onPress={doImport} disabled={importing} />
            {importing ? <ActivityIndicator color={C.accent} /> : null}
          </Row>
          {importMsg ? <Text style={{ color: C.sub, fontSize: 13, marginTop: 10 }}>{importMsg}</Text> : null}
        </Card>
        )}
      </Columns>

      <ManualEntry />

      <Card style={{ marginTop: 16 }} title="Recent days">
        <Row style={{ paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {['Date', 'Recovery', 'Strain', 'HRV', 'RHR', 'Resp', 'Asleep', 'Steps', 'Source'].map((h, i) => (
            <Text key={h} style={[{ color: C.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }, i === 8 ? { flex: 1.8 } : { flex: 1 }]}>
              {h}
            </Text>
          ))}
        </Row>
        {recent.map((d) => {
          const r = recoveryFor(data.health, data.profile, d.date);
          return (
            <Row key={d.date} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Cell>{shortLabel(d.date)}</Cell>
              <Cell>{r ? `${r.score}%` : '—'}</Cell>
              <Cell>{strainFor(d).score.toFixed(1)}</Cell>
              <Cell>{d.hrv ?? '—'}</Cell>
              <Cell>{d.restingHr ?? '—'}</Cell>
              <Cell>{d.respRate ?? '—'}</Cell>
              <Cell>{d.sleep ? durationLabel(asleepMinutes(d.sleep)) : '—'}</Cell>
              <Cell>{d.steps.toLocaleString()}</Cell>
              <Text style={{ flex: 1.8, color: C.sub, fontSize: 12 }}>{sourceLabel(d.source)}</Text>
            </Row>
          );
        })}
      </Card>
    </View>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <Text style={{ flex: 1, color: C.text, fontSize: 13 }}>{children}</Text>;
}

function ManualEntry() {
  const { data, update } = useStore();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const existing = data.health.find((d) => d.date === date);
  const init = (d?: DailyHealth) => ({
    rhr: d?.restingHr != null ? String(d.restingHr) : '',
    hrv: d?.hrv != null ? String(d.hrv) : '',
    resp: d?.respRate != null ? String(d.respRate) : '',
    steps: d ? String(d.steps) : '',
    kcal: d ? String(d.activeKcal) : '',
    z: d ? d.zoneMin.map(String) : ['', '', '', '', ''],
    deep: d?.sleep ? String(d.sleep.deepMin) : '',
    rem: d?.sleep ? String(d.sleep.remMin) : '',
    core: d?.sleep ? String(d.sleep.coreMin) : '',
    awake: d?.sleep ? String(d.sleep.awakeMin) : '',
    bed: d?.sleep ? toClock(d.sleep.bedtimeMin) : '23:00',
  });
  const [f, setF] = useState(() => init(existing));
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof ReturnType<typeof init>, v: any) => setF({ ...f, [k]: v });
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;

  const save = () => {
    const n = (s: string) => (s.trim() === '' ? null : Number(s));
    const deep = n(f.deep) ?? 0;
    const rem = n(f.rem) ?? 0;
    const core = n(f.core) ?? 0;
    const awake = n(f.awake) ?? 0;
    const hasSleep = deep + rem + core > 0;
    const day: DailyHealth = {
      date,
      restingHr: n(f.rhr),
      hrv: n(f.hrv),
      respRate: n(f.resp),
      avgHr: existing?.avgHr ?? null,
      maxHr: existing?.maxHr ?? null,
      steps: n(f.steps) ?? 0,
      activeKcal: n(f.kcal) ?? 0,
      zoneMin: f.z.map((x) => n(x) ?? 0) as DailyHealth['zoneMin'],
      sleep: hasSleep ? { deepMin: deep, remMin: rem, coreMin: core, awakeMin: awake, inBedMin: deep + rem + core + awake, bedtimeMin: fromClock(f.bed) } : null,
      source: 'manual',
    };
    update((d) => ({ ...d, health: [...d.health.filter((x) => x.date !== date), day].sort((a, b) => a.date.localeCompare(b.date)) }));
    setMsg(`Saved ${shortLabel(date)}. Scores are recalculated straight away.`);
  };

  return (
    <Card style={{ marginTop: 16 }} title="Enter or correct a day by hand">
      <Row gap={12} style={{ alignItems: 'flex-end' }}>
        <Field label="Date (YYYY-MM-DD)" value={date} onChange={(v) => { setDate(v); setMsg(null); const e = data.health.find((d) => d.date === v); if (e) setF(init(e)); }} width={170} />
        <Button title="Previous day" kind="ghost" small onPress={() => { const v = addDays(date, -1); setDate(v); setF(init(data.health.find((d) => d.date === v))); }} />
        <Text style={{ color: C.faint, fontSize: 12, marginBottom: 8 }}>{existing ? `Currently: ${sourceLabel(existing.source)}` : 'No data for this day yet'}</Text>
      </Row>
      <Label style={{ marginTop: 16, marginBottom: 8 }}>Overnight vitals & activity</Label>
      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <Field label="Resting HR (bpm)" numeric value={f.rhr} onChange={(v) => set('rhr', v)} />
        <Field label="HRV (ms)" numeric value={f.hrv} onChange={(v) => set('hrv', v)} />
        <Field label="Respiratory (br/min)" numeric value={f.resp} onChange={(v) => set('resp', v)} />
        <Field label="Steps" numeric value={f.steps} onChange={(v) => set('steps', v)} />
        <Field label="Active energy (kcal)" numeric value={f.kcal} onChange={(v) => set('kcal', v)} />
      </Row>
      <Label style={{ marginTop: 16, marginBottom: 8 }}>Minutes in heart-rate zones 1–5</Label>
      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        {f.z.map((z, i) => (
          <Field key={i} label={`Zone ${i + 1}`} numeric value={z} onChange={(v) => set('z', f.z.map((x, j) => (j === i ? v : x)))} />
        ))}
      </Row>
      <Label style={{ marginTop: 16, marginBottom: 8 }}>Sleep (minutes)</Label>
      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <Field label="Deep" numeric value={f.deep} onChange={(v) => set('deep', v)} />
        <Field label="Core" numeric value={f.core} onChange={(v) => set('core', v)} />
        <Field label="REM" numeric value={f.rem} onChange={(v) => set('rem', v)} />
        <Field label="Awake" numeric value={f.awake} onChange={(v) => set('awake', v)} />
        <Field label="Bedtime (HH:MM)" value={f.bed} onChange={(v) => set('bed', v)} />
      </Row>
      <Row style={{ marginTop: 16, alignItems: 'center' }} gap={12}>
        <Button title="Save day" disabled={!validDate} onPress={save} />
        {msg ? <Text style={{ color: C.accent, fontSize: 13 }}>{msg}</Text> : null}
        {!validDate ? <Text style={{ color: C.recovery.yellow, fontSize: 13 }}>Enter a past date as YYYY-MM-DD.</Text> : null}
      </Row>
    </Card>
  );
}

function toClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function fromClock(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return -60;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 12 * 60 ? v - 1440 : v; // evening times are before midnight
}
