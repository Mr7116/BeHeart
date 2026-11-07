// First launch: the app starts empty, so ask for the details the formulas need and offer to connect a watch.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { Body, Button, Card, Field, H1, Label, Row, Segmented } from '../ui';
import { C } from '../theme';
import { ActivityLevel, BodyGoal, Sex } from '../../core/types';

export function WelcomeScreen() {
  const { data, update, canUseHealthKit, connectHealthKit } = useStore();
  const p = data.profile;
  const [form, setForm] = useState({ name: p.name, age: '', weight: '', height: '', sleep: String(p.sleepNeedH) });
  const [sex, setSex] = useState<Sex>(p.sex);
  const [activity, setActivity] = useState<ActivityLevel>(p.activity);
  const [goal, setGoal] = useState<BodyGoal>(p.goal);
  const [err, setErr] = useState<string | null>(null);
  const [hkMsg, setHkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    const age = Math.round(Number(form.age));
    const weightKg = Number(form.weight);
    const heightCm = Number(form.height);
    const sleepNeedH = Number(form.sleep);
    if (!form.name.trim()) return setErr('Please enter your name.');
    if (!(age >= 13 && age <= 100)) return setErr('Age must be 13–100.');
    if (!(weightKg >= 30 && weightKg <= 300)) return setErr('Weight must be 30–300 kg.');
    if (!(heightCm >= 120 && heightCm <= 230)) return setErr('Height must be 120–230 cm.');
    if (!(sleepNeedH >= 5 && sleepNeedH <= 11)) return setErr('Sleep need must be 5–11 hours.');
    update((d) => ({ ...d, onboarded: true, profile: { ...d.profile, name: form.name.trim(), age, weightKg, heightCm, sleepNeedH, sex, activity, goal } }));
  };

  return (
    <View style={{ maxWidth: 640, width: '100%' as any, alignSelf: 'center' }}>
      <H1 sub="Recovery, Strain, Sleep, workouts and nutrition — calculated from your own data">Welcome to BeHeart</H1>
      <Card title="About you">
        <Body style={{ marginBottom: 12 }}>These numbers drive your calorie targets, heart-rate zones and scores. You can change them later in Profile.</Body>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Age" numeric value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
        </Row>
        <Row gap={10} style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Field label="Weight (kg)" numeric value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
          <Field label="Height (cm)" numeric value={form.height} onChange={(v) => setForm({ ...form, height: v })} />
          <Field label="Sleep need (h)" numeric value={form.sleep} onChange={(v) => setForm({ ...form, sleep: v })} />
        </Row>
        <Label style={{ marginTop: 16, marginBottom: 8 }}>Sex (for the BMR formula)</Label>
        <Segmented<Sex> value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        <Label style={{ marginTop: 16, marginBottom: 8 }}>Activity level</Label>
        <Segmented<ActivityLevel>
          value={activity}
          onChange={setActivity}
          options={[
            { value: 'sedentary', label: 'Sedentary' },
            { value: 'light', label: 'Light' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'active', label: 'Active' },
            { value: 'very-active', label: 'Very active' },
          ]}
        />
        <Label style={{ marginTop: 16, marginBottom: 8 }}>Goal</Label>
        <Segmented<BodyGoal> value={goal} onChange={setGoal} options={[{ value: 'lose', label: 'Lose fat' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Build muscle' }]} />
      </Card>

      {canUseHealthKit ? (
        <Card style={{ marginTop: 16 }} title="Connect your Apple Watch">
          <Body>BeHeart reads heart rate, HRV, resting HR, sleep stages and activity from Apple Health. Garmin, Huawei, Zepp and others work too once their app shares with Apple Health.</Body>
          <Row style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }} gap={10}>
            <Button
              title={data.healthKitConnected ? '✓ Apple Health connected' : busy ? 'Connecting…' : 'Connect Apple Health'}
              kind={data.healthKitConnected ? 'ghost' : 'primary'}
              disabled={busy || !!data.healthKitConnected}
              onPress={async () => {
                setBusy(true);
                setHkMsg(await connectHealthKit().catch((e) => `Could not connect: ${e?.message ?? e}`));
                setBusy(false);
              }}
            />
          </Row>
          {hkMsg ? <Text style={{ color: C.sub, fontSize: 13, marginTop: 8 }}>{hkMsg}</Text> : null}
        </Card>
      ) : (
        <Card style={{ marginTop: 16 }} title="Your health data">
          <Body>After setup, import an Apple Health export or enter days by hand in Health Data. Live watch sync works in the iPhone app.</Body>
        </Card>
      )}

      <Row style={{ marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }} gap={12}>
        <Button title="Start using BeHeart" onPress={start} />
        {err ? <Text style={{ color: C.recovery.yellow, fontSize: 13 }}>{err}</Text> : null}
      </Row>
    </View>
  );
}
