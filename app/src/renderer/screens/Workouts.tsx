import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Body, Button, Card, Field, H1, Label, Progress, Row, Segmented, Stat, s as ui, Columns } from '../ui';
import { BarChart } from '../charts';
import { C } from '../theme';
import { longLabel, shortLabel, todayISO, weekStart } from '../../core/dates';
import {
  EXERCISES,
  Exercise,
  FREE_ROUTINE_LIMIT,
  MUSCLES,
  Muscle,
  effectiveLoad,
  estimated1RM,
  exerciseById,
  muscleFatigue,
  muscleVolume,
  newId,
  personalBests,
  sessionVolume,
  weeklyVolume,
} from '../../core/workouts';
import { ExerciseLog, Routine, WorkoutSession } from '../../core/types';

type Tab = 'log' | 'routines' | 'progress' | 'history';

// Keeps an unfinished workout while switching screens.
let draftCache: WorkoutSession | null = null;

export function WorkoutsScreen() {
  const [tab, setTab] = useState<Tab>('log');
  return (
    <View>
      <Columns style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1 sub="Log sets, reps and weights; volume and muscle fatigue are calculated from your history">Workouts</H1>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'log', label: 'Log workout' },
            { value: 'routines', label: 'Routines' },
            { value: 'progress', label: 'Volume & fatigue' },
            { value: 'history', label: 'History' },
          ]}
        />
      </Columns>
      {tab === 'log' ? <LogTab onSaved={() => setTab('history')} /> : tab === 'routines' ? <RoutinesTab /> : tab === 'progress' ? <ProgressTab /> : <HistoryTab />}
    </View>
  );
}

// ------------------------------------------------------------------ Exercise picker

function ExercisePicker({ onPick, picked = [] }: { onPick: (e: Exercise) => void; picked?: string[] }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const list = EXERCISES.filter(
    (e) => (muscle === 'all' || e.primary.includes(muscle) || e.secondary.includes(muscle)) && e.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <View>
      <Field value={q} onChange={setQ} placeholder="Search exercises…" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 } as any}>
        {[{ id: 'all' as const, label: 'All' }, ...MUSCLES].map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMuscle(m.id)}
            style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: muscle === m.id ? C.accent + '33' : C.cardAlt }}
          >
            <Text style={{ color: muscle === m.id ? C.text : C.sub, fontSize: 12 }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={{ marginTop: 10, maxHeight: 340 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {list.map((e) => {
          const on = picked.includes(e.id);
          return (
            <Pressable
              key={e.id}
              onPress={() => onPick(e)}
              style={({ hovered }: any) => ({ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: hovered ? C.cardAlt : 'transparent', flexDirection: 'row', justifyContent: 'space-between' })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14 }}>{e.name}</Text>
                <Text style={{ color: C.faint, fontSize: 12 }}>
                  {e.equipment} · {e.primary.map(cap).join(', ')}
                  {e.secondary.length ? ` (+ ${e.secondary.map(cap).join(', ')})` : ''}
                </Text>
              </View>
              <Text style={{ color: on ? C.accent : C.sub, fontSize: 18, fontWeight: '700' }}>{on ? '✓' : '+'}</Text>
            </Pressable>
          );
        })}
        {!list.length ? <Body>No exercises match.</Body> : null}
      </ScrollView>
    </View>
  );
}

const cap = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);

// ------------------------------------------------------------------ Log a workout

function emptyDraft(): WorkoutSession {
  return { id: newId('w'), date: todayISO(), name: 'Workout', exercises: [] };
}

function lastSetsFor(sessions: WorkoutSession[], exerciseId: string): ExerciseLog['sets'] | null {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) return e.sets.map((x) => ({ ...x }));
  }
  return null;
}

function LogTab({ onSaved }: { onSaved: () => void }) {
  const { data, update } = useStore();
  const [draft, setDraftState] = useState<WorkoutSession>(() => draftCache ?? emptyDraft());
  const [picking, setPicking] = useState(false);
  const setDraft = (d: WorkoutSession | null) => {
    draftCache = d;
    setDraftState(d ?? emptyDraft());
  };
  const bodyKg = data.profile.weightKg;

  const addExercise = (e: Exercise) => {
    if (draft.exercises.some((x) => x.exerciseId === e.id)) return;
    const prev = lastSetsFor(data.sessions, e.id);
    setDraft({ ...draft, exercises: [...draft.exercises, { exerciseId: e.id, sets: prev ?? [{ reps: 10, weightKg: 0 }] }] });
  };

  const startRoutine = (r: Routine) => {
    setDraft({
      id: newId('w'),
      date: todayISO(),
      name: r.name,
      exercises: r.exerciseIds.map((id) => ({ exerciseId: id, sets: lastSetsFor(data.sessions, id) ?? [{ reps: 10, weightKg: 0 }, { reps: 10, weightKg: 0 }, { reps: 10, weightKg: 0 }] })),
    });
  };

  const setEx = (i: number, ex: ExerciseLog | null) => {
    const list = [...draft.exercises];
    if (ex) list[i] = ex;
    else list.splice(i, 1);
    setDraft({ ...draft, exercises: list });
  };

  const save = () => {
    const cleaned = { ...draft, exercises: draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.reps > 0) })).filter((e) => e.sets.length) };
    if (!cleaned.exercises.length) return;
    update((d) => ({ ...d, sessions: [...d.sessions, cleaned] }));
    setDraft(null);
    onSaved();
  };

  const volume = sessionVolume(draft, bodyKg);
  const sets = draft.exercises.reduce((a, e) => a + e.sets.length, 0);

  return (
    <Columns style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1.6, gap: 16 } as any}>
        <Card>
          <Row style={{ alignItems: 'flex-end' }} gap={12}>
            <Field label="Workout name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
            <Field label="Date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} width={140} />
          </Row>
          <Row style={{ marginTop: 14 }}>
            <Stat label="Exercises" value={String(draft.exercises.length)} />
            <Stat label="Sets" value={String(sets)} />
            <Stat label="Volume" value={volume.toLocaleString()} unit="kg" color={C.accent} />
          </Row>
        </Card>

        {draft.exercises.map((e, i) => (
          <ExerciseCard key={e.exerciseId} log={e} bodyKg={bodyKg} onChange={(x) => setEx(i, x)} />
        ))}

        {!draft.exercises.length ? (
          <Card>
            <Body>Start from one of your routines on the right, or add exercises one by one.</Body>
          </Card>
        ) : null}

        <Row>
          <Button title={picking ? 'Close exercise list' : '+ Add exercise'} kind="ghost" onPress={() => setPicking(!picking)} />
          <View style={{ flex: 1 }} />
          {draft.exercises.length ? <Button title="Discard" kind="danger" onPress={() => setDraft(null)} /> : null}
          <Button title="Finish & save workout" disabled={!draft.exercises.length || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)} onPress={save} />
        </Row>
        {picking ? (
          <Card title="Exercise database">
            <ExercisePicker onPick={addExercise} picked={draft.exercises.map((e) => e.exerciseId)} />
          </Card>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 16 } as any}>
        <Card title="Start from a routine">
          {data.routines.length ? (
            data.routines.map((r) => (
              <Pressable key={r.id} onPress={() => startRoutine(r)} style={({ hovered }: any) => ({ padding: 10, borderRadius: 10, backgroundColor: hovered ? C.cardAlt : 'transparent', marginBottom: 4 })}>
                <Text style={{ color: C.text, fontWeight: '600' }}>{r.name}</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{r.exerciseIds.map((id) => exerciseById(id)?.name ?? id).join(' · ')}</Text>
              </Pressable>
            ))
          ) : (
            <Body>No routines yet. Create one in the Routines tab.</Body>
          )}
        </Card>
        <FatigueCard />
      </View>
    </Columns>
  );
}

function NumBox({ value, onChange, width = 70 }: { value: number; onChange: (n: number) => void; width?: number }) {
  const [text, setText] = useState(String(value));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(/[^0-9.]/g, '');
        setText(clean);
        const n = Number(clean);
        if (!isNaN(n)) onChange(n);
      }}
      style={[ui.input as any, { width, textAlign: 'center', paddingVertical: 6 }]}
    />
  );
}

function ExerciseCard({ log, bodyKg, onChange }: { log: ExerciseLog; bodyKg: number; onChange: (x: ExerciseLog | null) => void }) {
  const ex = exerciseById(log.exerciseId);
  const best = Math.max(0, ...log.sets.map((x) => estimated1RM(effectiveLoad(ex, x.weightKg, bodyKg), x.reps)));
  return (
    <Card
      title={ex?.name ?? log.exerciseId}
      right={
        <Row gap={10} style={{ alignItems: 'center' }}>
          <Text style={{ color: C.faint, fontSize: 12 }}>Est. 1RM {best.toFixed(1)} kg</Text>
          <Button title="Remove" small kind="danger" onPress={() => onChange(null)} />
        </Row>
      }
    >
      <Row gap={8} style={{ paddingHorizontal: 4, marginBottom: 6 }}>
        <Text style={[ui.label, { width: 40 }]}>Set</Text>
        <Text style={[ui.label, { width: 70, textAlign: 'center' }]}>Reps</Text>
        <Text style={[ui.label, { width: 90, textAlign: 'center' }]}>{ex?.bodyweightShare ? '+ kg' : 'kg'}</Text>
        <Text style={[ui.label, { flex: 1, textAlign: 'right' }]}>Volume</Text>
      </Row>
      {log.sets.map((set, i) => (
        <Row key={i} gap={8} style={{ alignItems: 'center', paddingHorizontal: 4, marginBottom: 6 }}>
          <Text style={{ color: C.sub, width: 40, fontWeight: '700' }}>{i + 1}</Text>
          <NumBox value={set.reps} onChange={(n) => onChange({ ...log, sets: log.sets.map((x, j) => (j === i ? { ...x, reps: Math.round(n) } : x)) })} />
          <NumBox width={90} value={set.weightKg} onChange={(n) => onChange({ ...log, sets: log.sets.map((x, j) => (j === i ? { ...x, weightKg: n } : x)) })} />
          <Text style={{ color: C.text, flex: 1, textAlign: 'right' }}>{Math.round(set.reps * effectiveLoad(ex, set.weightKg, bodyKg))} kg</Text>
          <Pressable onPress={() => onChange({ ...log, sets: log.sets.filter((_, j) => j !== i) })} style={{ paddingHorizontal: 8 }}>
            <Text style={{ color: C.faint, fontSize: 16 }}>×</Text>
          </Pressable>
        </Row>
      ))}
      <Button
        title="+ Add set"
        small
        kind="ghost"
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
        onPress={() => onChange({ ...log, sets: [...log.sets, log.sets.length ? { ...log.sets[log.sets.length - 1] } : { reps: 10, weightKg: 0 }] })}
      />
      {ex?.bodyweightShare ? <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>Bodyweight movement: {Math.round(ex.bodyweightShare * 100)}% of your body weight is counted plus any added kg.</Text> : null}
    </Card>
  );
}

// ------------------------------------------------------------------ Routines

function RoutinesTab() {
  const { data, update } = useStore();
  const go = useNav();
  const premium = data.subscription.premium;
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const atLimit = !premium && data.routines.length >= FREE_ROUTINE_LIMIT;

  const toggle = (e: Exercise) => setIds((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]));
  const create = () => {
    if (!name.trim() || !ids.length || atLimit) return;
    update((d) => ({ ...d, routines: [...d.routines, { id: newId('r'), name: name.trim(), exerciseIds: ids }] }));
    setName('');
    setIds([]);
  };

  return (
    <Columns style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 16 } as any}>
        <Card title={`Your routines (${data.routines.length}${premium ? '' : ` of ${FREE_ROUTINE_LIMIT} on the free plan`})`}>
          {data.routines.map((r) => (
            <View key={r.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }}>{r.name}</Text>
                <Button title="Delete" small kind="danger" onPress={() => update((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== r.id) }))} />
              </Row>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>{r.exerciseIds.map((id) => exerciseById(id)?.name ?? id).join(' · ')}</Text>
            </View>
          ))}
          {!data.routines.length ? <Body>No routines yet.</Body> : null}
        </Card>
      </View>
      <View style={{ flex: 1 }}>
        <Card title="Build a routine">
          {atLimit ? (
            <View style={{ padding: 14, borderRadius: 10, backgroundColor: C.premium + '14', borderWidth: 1, borderColor: C.premium + '55', marginBottom: 12 }}>
              <Text style={{ color: C.premium, fontWeight: '700' }}>Free plan limit reached</Text>
              <Body style={{ marginVertical: 6 }}>The free plan includes {FREE_ROUTINE_LIMIT} routines. Premium gives you unlimited custom routines.</Body>
              <Button title="See Premium" kind="premium" small style={{ alignSelf: 'flex-start' }} onPress={() => go('premium')} />
            </View>
          ) : null}
          <Field label="Routine name" value={name} onChange={setName} placeholder="e.g. Push Day" />
          <Label style={{ marginTop: 14, marginBottom: 6 }}>Selected ({ids.length})</Label>
          <Text style={{ color: C.text, fontSize: 13, marginBottom: 12 }}>{ids.length ? ids.map((id) => exerciseById(id)?.name).join(' → ') : 'Tap exercises below to add them in order.'}</Text>
          <ExercisePicker onPick={toggle} picked={ids} />
          <Button title="Save routine" style={{ marginTop: 12 }} disabled={!name.trim() || !ids.length || atLimit} onPress={create} />
        </Card>
      </View>
    </Columns>
  );
}

// ------------------------------------------------------------------ Volume & fatigue

function FatigueCard() {
  const { data } = useStore();
  const today = todayISO();
  const fatigue = useMemo(() => muscleFatigue(data.sessions, data.profile.weightKg, today), [data.sessions, data.profile.weightKg, today]);
  return (
    <Card title="Muscle fatigue today">
      {fatigue.map((m) => (
        <View key={m.muscle} style={{ marginBottom: 9 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: C.sub, fontSize: 13 }}>{m.label}</Text>
            <Text style={{ color: C.text, fontSize: 12 }}>
              {m.fatigue}% · {m.status}
              {m.lastTrained ? ` · last ${shortLabel(m.lastTrained)}` : ''}
            </Text>
          </Row>
          <View style={{ marginTop: 4 }}>
            <Progress value={m.fatigue} max={100} color={m.fatigue >= 70 ? C.recovery.red : m.fatigue >= 35 ? C.recovery.yellow : C.recovery.green} height={6} />
          </View>
        </View>
      ))}
      <Text style={{ color: C.faint, fontSize: 12, marginTop: 4 }}>Load from each session fades with a 1.5-day time constant and is compared with your 28-day average.</Text>
    </Card>
  );
}

function ProgressTab() {
  const { data } = useStore();
  const today = todayISO();
  const bodyKg = data.profile.weightKg;
  const weeks = weeklyVolume(data.sessions, bodyKg, today, 12);
  const pbs = personalBests(data.sessions, bodyKg).slice(0, 8);
  const thisWeek = weekStart(today);
  const weekMuscle = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  data.sessions
    .filter((s) => weekStart(s.date) === thisWeek)
    .forEach((s) => {
      const mv = muscleVolume(s, bodyKg);
      for (const m of MUSCLES) weekMuscle[m.id] += mv[m.id];
    });
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const avg4 = weeks.slice(-5, -1).reduce((a, w) => a + w.volume, 0) / 4;

  return (
    <View style={{ gap: 16 } as any}>
      <Card>
        <Row style={{ flexWrap: 'wrap' }}>
          <Stat label="This week" value={cur.volume.toLocaleString()} unit="kg" color={C.accent} hint={`${cur.sessions} sessions · ${cur.sets} sets`} />
          <Stat label="Last week" value={prev.volume.toLocaleString()} unit="kg" hint={`${prev.sessions} sessions · ${prev.sets} sets`} />
          <Stat label="4-week average" value={Math.round(avg4).toLocaleString()} unit="kg" />
          <Stat label="Total sessions" value={String(data.sessions.length)} />
        </Row>
      </Card>
      <Columns style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1.4, gap: 16 } as any}>
          <Card title="Weekly training volume · 12 weeks">
            <BarChart
              values={weeks.map((w) => w.volume)}
              labels={weeks.map((w) => shortLabel(w.week))}
              colors={weeks.map((_, i) => (i === weeks.length - 1 ? C.accent : C.accent + '88'))}
              height={230}
              target={avg4 || undefined}
              format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)))}
            />
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Volume = reps × weight. Dashed line: average of the previous 4 weeks.</Text>
          </Card>
          <Card title="Volume by muscle · this week">
            <BarChart values={MUSCLES.map((m) => Math.round(weekMuscle[m.id]))} labels={MUSCLES.map((m) => m.label.slice(0, 5))} colors={C.strain} height={190} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))} />
          </Card>
          <Card title="Personal bests (estimated 1-rep max)">
            {pbs.map((p) => (
              <Row key={p.exerciseId} style={{ justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.text, fontSize: 14 }}>{p.name}</Text>
                <Text style={{ color: C.sub, fontSize: 14 }}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{p.best1RM} kg</Text> · {shortLabel(p.date)}
                </Text>
              </Row>
            ))}
            {!pbs.length ? <Body>Log a workout to see your bests.</Body> : null}
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <FatigueCard />
        </View>
      </Columns>
    </View>
  );
}

// ------------------------------------------------------------------ History

function HistoryTab() {
  const { data, update } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const list = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card title={`${list.length} sessions`}>
      {list.map((s) => (
        <View key={s.id} style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 }}>
          <Pressable onPress={() => setOpen(open === s.id ? null : s.id)}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{s.name}</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
                  {longLabel(s.date)} · {s.exercises.length} exercises · {s.exercises.reduce((a, e) => a + e.sets.length, 0)} sets
                </Text>
              </View>
              <Text style={{ color: C.accent, fontWeight: '700' }}>{sessionVolume(s, data.profile.weightKg).toLocaleString()} kg</Text>
            </Row>
          </Pressable>
          {open === s.id ? (
            <View style={{ marginTop: 10, paddingLeft: 10 }}>
              {s.exercises.map((e) => (
                <Text key={e.exerciseId} style={{ color: C.sub, fontSize: 13, marginBottom: 4 }}>
                  <Text style={{ color: C.text }}>{exerciseById(e.exerciseId)?.name}</Text> — {e.sets.map((x) => `${x.reps}×${x.weightKg}kg`).join(', ')}
                </Text>
              ))}
              <Button title="Delete session" small kind="danger" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => update((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }))} />
            </View>
          ) : null}
        </View>
      ))}
      {!list.length ? <Body>No workouts logged yet.</Body> : null}
    </Card>
  );
}
