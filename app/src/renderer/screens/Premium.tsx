import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../store';
import { Body, Button, Card, H1, Row, Columns } from '../ui';
import { C } from '../theme';
import { longLabel, todayISO } from '../../core/dates';
import { FREE_ROUTINE_LIMIT } from '../../core/workouts';

const FEATURES: [string, boolean | string, boolean | string][] = [
  ['Daily health data sync & import', true, true],
  ["Today's Recovery, Strain and Sleep scores", true, true],
  ['Trends history', '7 days', '30 & 90 days'],
  ['Basic workout logging & fatigue', true, true],
  ['Custom workout routines', `${FREE_ROUTINE_LIMIT}`, 'Unlimited'],
  ['Food search & macro tracking', true, true],
  ['Barcode lookup for packaged food', false, true],
  ['Deep sleep analytics', false, true],
  ['Cardiovascular fitness reports (VO₂max, zones, load)', false, true],
];

export function PremiumScreen() {
  const { data, update } = useStore();
  const sub = data.subscription;
  const [plan, setPlan] = useState<'monthly' | 'yearly'>(sub.plan ?? 'yearly');

  return (
    <View>
      <H1 sub="Long-term trends, deeper analysis and convenience features">BeHeart Premium</H1>
      <Columns style={{ alignItems: 'flex-start' }}>
        <Card style={{ flex: 1.3 }} title="What you get">
          <Row style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ flex: 2.4, color: C.faint, fontSize: 12, fontWeight: '700' }}>FEATURE</Text>
            <Text style={{ flex: 1, color: C.faint, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>FREE</Text>
            <Text style={{ flex: 1, color: C.premium, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>PREMIUM</Text>
          </Row>
          {FEATURES.map(([name, free, pro]) => (
            <Row key={name} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center' }}>
              <Text style={{ flex: 2.4, color: C.text, fontSize: 14 }}>{name}</Text>
              <Cell v={free} />
              <Cell v={pro} premium />
            </Row>
          ))}
        </Card>
        <View style={{ flex: 1, gap: 16 } as any}>
          {sub.premium ? (
            <Card title="Your subscription">
              <Text style={{ color: C.premium, fontSize: 20, fontWeight: '800' }}>★ Premium active</Text>
              <Body style={{ marginTop: 6 }}>
                {sub.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan{sub.since ? ` since ${longLabel(sub.since)}` : ''}.
              </Body>
              <Button title="Cancel subscription" kind="danger" style={{ marginTop: 14, alignSelf: 'flex-start' }} onPress={() => update((d) => ({ ...d, subscription: { premium: false, plan: null, since: null } }))} />
            </Card>
          ) : (
            <Card title="Choose a plan">
              <PlanBox on={plan === 'yearly'} onPress={() => setPlan('yearly')} title="Yearly" price="$39.99 / year" note="About $3.33 a month · save 33%" />
              <PlanBox on={plan === 'monthly'} onPress={() => setPlan('monthly')} title="Monthly" price="$4.99 / month" note="Cancel any time" />
              <Button
                title="Start Premium"
                kind="premium"
                style={{ marginTop: 6 }}
                onPress={() => update((d) => ({ ...d, subscription: { premium: true, plan, since: todayISO() } }))}
              />
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>Demo purchase: no payment is taken in this desktop version. Prices are placeholders.</Text>
            </Card>
          )}
          <Card title="No AI, just maths">
            <Body>Every score comes from fixed, published-style formulas (baselines, standard deviations, heart-rate zones), so the same data always gives the same answer.</Body>
          </Card>
        </View>
      </Columns>
    </View>
  );
}

function Cell({ v, premium }: { v: boolean | string; premium?: boolean }) {
  const color = premium ? C.premium : C.sub;
  return (
    <Text style={{ flex: 1, textAlign: 'center', color: v === false ? C.faint : color, fontSize: 14, fontWeight: '600' }}>
      {v === true ? '✓' : v === false ? '—' : v}
    </Text>
  );
}

function PlanBox({ on, onPress, title, price, note }: { on: boolean; onPress: () => void; title: string; price: string; note: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderWidth: 2, borderColor: on ? C.premium : C.border, borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: on ? C.premium + '12' : 'transparent' }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: on ? C.premium : C.text, fontSize: 15, fontWeight: '700' }}>{price}</Text>
      </Row>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>{note}</Text>
    </Pressable>
  );
}
