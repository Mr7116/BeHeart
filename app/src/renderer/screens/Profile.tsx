import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useStore } from '../store';
import { Body, Button, Card, Field, H1, Label, Row, Segmented, Stat, Columns } from '../ui';
import { C } from '../theme';
import { macroGoals } from '../../core/nutrition';
import { maxHeartRate } from '../../core/scoring';
import { ActivityLevel, BodyGoal, Profile, Sex } from '../../core/types';
import { bridge } from '../bridge';

export function ProfileScreen() {
  const { data, update, resetAll } = useStore();
  const p = data.profile;
  const [form, setForm] = useState({ name: p.name, age: String(p.age), weight: String(p.weightKg), height: String(p.heightCm), sleep: String(p.sleepNeedH) });
  const [where, setWhere] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    bridge.dataLocation().then(setWhere).catch(() => undefined);
  }, []);

  const setP = (patch: Partial<Profile>) => update((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const saveNumbers = () => {
    const age = Math.round(Number(form.age));
    const weightKg = Number(form.weight);
    const heightCm = Number(form.height);
    const sleepNeedH = Number(form.sleep);
    if (!(age >= 13 && age <= 100) || !(weightKg >= 30 && weightKg <= 300) || !(heightCm >= 120 && heightCm <= 230) || !(sleepNeedH >= 5 && sleepNeedH <= 11)) {
      setMsg('Please check the values: age 13–100, weight 30–300 kg, height 120–230 cm, sleep need 5–11 h.');
      return;
    }
    setP({ name: form.name.trim() || 'You', age, weightKg, heightCm, sleepNeedH });
    setMsg('Saved.');
  };

  const g = macroGoals(p);

  return (
    <View>
      <H1 sub="Used by the scoring formulas and nutrition goals">Profile & settings</H1>
      <Columns style={{ alignItems: 'flex-start' }}>
        <Card style={{ flex: 1.3 }} title="About you">
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Age" numeric value={form.age} onChange={(v) => setForm({ ...form, age: v })} width={90} />
          </Row>
          <Row gap={10} style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Field label="Weight (kg)" numeric value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
            <Field label="Height (cm)" numeric value={form.height} onChange={(v) => setForm({ ...form, height: v })} />
            <Field label="Sleep need (h)" numeric value={form.sleep} onChange={(v) => setForm({ ...form, sleep: v })} />
          </Row>
          <Row style={{ marginTop: 12, alignItems: 'center' }} gap={12}>
            <Button title="Save" onPress={saveNumbers} />
            {msg ? <Text style={{ color: msg === 'Saved.' ? C.accent : C.recovery.yellow, fontSize: 13 }}>{msg}</Text> : null}
          </Row>
          <Label style={{ marginTop: 18, marginBottom: 8 }}>Sex (for BMR formula)</Label>
          <Segmented<Sex> value={p.sex} onChange={(v) => setP({ sex: v })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          <Label style={{ marginTop: 16, marginBottom: 8 }}>Activity level</Label>
          <Segmented<ActivityLevel>
            value={p.activity}
            onChange={(v) => setP({ activity: v })}
            options={[
              { value: 'sedentary', label: 'Sedentary' },
              { value: 'light', label: 'Light' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'active', label: 'Active' },
              { value: 'very-active', label: 'Very active' },
            ]}
          />
          <Label style={{ marginTop: 16, marginBottom: 8 }}>Goal</Label>
          <Segmented<BodyGoal> value={p.goal} onChange={(v) => setP({ goal: v })} options={[{ value: 'lose', label: 'Lose fat' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Build muscle' }]} />
        </Card>
        <View style={{ flex: 1, gap: 16 } as any}>
          <Card title="Your daily targets">
            <Row style={{ flexWrap: 'wrap', rowGap: 14 } as any}>
              <Stat label="Calories" value={String(g.kcal)} unit="kcal" color={C.accent} />
              <Stat label="Protein" value={String(g.protein)} unit="g" color={C.protein} />
              <Stat label="Carbs" value={String(g.carbs)} unit="g" color={C.carbs} />
              <Stat label="Fat" value={String(g.fat)} unit="g" color={C.fat} />
              <Stat label="BMR" value={String(g.bmr)} unit="kcal" hint="Mifflin–St Jeor" />
              <Stat label="Max heart rate" value={String(maxHeartRate(p.age))} unit="bpm" hint="208 − 0.7 × age" />
            </Row>
          </Card>
          <Card title="Your data">
            <Body>Everything is stored on this device only.</Body>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }} selectable>
              {where}
            </Text>
            <Row gap={10} style={{ marginTop: 14, flexWrap: 'wrap' }}>
              {Platform.OS === 'web' ? <Button
                title="Export as JSON…"
                kind="ghost"
                onPress={async () => {
                  const f = await bridge.exportData(data).catch(() => null);
                  if (f) setMsg(`Exported to ${f}`);
                }}
              /> : null}
              {confirmReset ? (
                <>
                  <Button title="Yes, erase everything" kind="danger" onPress={() => { resetAll(); setConfirmReset(false); }} />
                  <Button title="Keep my data" kind="ghost" onPress={() => setConfirmReset(false)} />
                </>
              ) : (
                <Button title="Reset to sample data" kind="danger" onPress={() => setConfirmReset(true)} />
              )}
            </Row>
          </Card>
        </View>
      </Columns>
    </View>
  );
}
