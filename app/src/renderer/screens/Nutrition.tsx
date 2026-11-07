import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { useNav } from '../App';
import { Body, Button, Card, Field, H1, Label, PremiumLock, Progress, Row, Segmented, Columns } from '../ui';
import { Ring } from '../charts';
import { C } from '../theme';
import { addDays, longLabel, todayISO } from '../../core/dates';
import { MEALS, dayTotals, entryTotals, fromOpenFoodFacts, isValidBarcode, macroGoals, searchLocalFoods } from '../../core/nutrition';
import { FoodItem, Meal } from '../../core/types';
import { newId } from '../../core/workouts';
import { bridge } from '../bridge';
import { BarcodeScanner, CAMERA_SCAN_AVAILABLE } from '../BarcodeScanner';

type AddTab = 'search' | 'barcode' | 'custom';

export function NutritionScreen() {
  const { data, update } = useStore();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState<Meal>(defaultMeal());
  const goals = macroGoals(data.profile);
  const t = dayTotals(data.foods, date);
  const left = goals.kcal - t.kcal;

  const add = (food: FoodItem, grams: number) => {
    update((d) => ({
      ...d,
      foods: [...d.foods, { id: newId('f'), date, meal, food, grams }],
      customFoods: food.source === 'openfoodfacts' && !d.customFoods.some((c) => c.id === food.id) ? [food, ...d.customFoods].slice(0, 50) : d.customFoods,
    }));
  };

  return (
    <View>
      <Columns style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1 sub={`${longLabel(date)}${date === today ? ' · Today' : ''}`}>Nutrition</H1>
        <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          <Button title="‹" kind="ghost" small onPress={() => setDate(addDays(date, -1))} />
          <Button title="Today" kind="ghost" small disabled={date === today} onPress={() => setDate(today)} />
          <Button title="›" kind="ghost" small disabled={date >= today} onPress={() => setDate(addDays(date, 1))} />
        </Row>
      </Columns>

      <Columns style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1.3, gap: 16 } as any}>
          <Card>
            <Columns style={{ alignItems: 'center' }} gap={28}>
              <Ring value={t.kcal} max={goals.kcal} color={left >= 0 ? C.accent : C.recovery.red} center={String(Math.round(Math.abs(left)))} sub={left >= 0 ? 'kcal left' : 'kcal over'} size={140} />
              <View style={{ flex: 1, gap: 12 } as any}>
                <MacroBar label="Protein" v={t.protein} goal={goals.protein} color={C.protein} />
                <MacroBar label="Carbohydrates" v={t.carbs} goal={goals.carbs} color={C.carbs} />
                <MacroBar label="Fat" v={t.fat} goal={goals.fat} color={C.fat} />
              </View>
            </Columns>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 14 }}>
              Goal {goals.kcal} kcal = BMR {goals.bmr} × activity ({goals.tdee} kcal){data.profile.goal === 'lose' ? ' − 500 to lose weight' : data.profile.goal === 'gain' ? ' + 300 to gain' : ''}. Eaten {Math.round(t.kcal)} kcal.
            </Text>
          </Card>

          {MEALS.map((m) => {
            const entries = data.foods.filter((f) => f.date === date && f.meal === m.id);
            const mt = dayTotals(data.foods, date, m.id);
            return (
              <Card
                key={m.id}
                title={m.label}
                right={
                  <Row gap={10} style={{ alignItems: 'center' }}>
                    <Text style={{ color: C.sub, fontSize: 13 }}>{Math.round(mt.kcal)} kcal</Text>
                    <Button title={meal === m.id ? 'Adding here' : '+ Add'} small kind={meal === m.id ? 'primary' : 'ghost'} onPress={() => setMeal(m.id)} />
                  </Row>
                }
              >
                {entries.length ? (
                  entries.map((e) => {
                    const x = entryTotals(e);
                    return (
                      <Row key={e.id} style={{ justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 14 }}>
                            {e.food.name}
                            {e.food.brand ? <Text style={{ color: C.faint }}> · {e.food.brand}</Text> : null}
                          </Text>
                          <Text style={{ color: C.faint, fontSize: 12 }}>
                            {e.grams} g · P {x.protein.toFixed(0)} g · C {x.carbs.toFixed(0)} g · F {x.fat.toFixed(0)} g
                          </Text>
                        </View>
                        <Text style={{ color: C.text, fontWeight: '600', marginRight: 10 }}>{Math.round(x.kcal)}</Text>
                        <Pressable onPress={() => update((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== e.id) }))}>
                          <Text style={{ color: C.faint, fontSize: 18, paddingHorizontal: 6 }}>×</Text>
                        </Pressable>
                      </Row>
                    );
                  })
                ) : (
                  <Text style={{ color: C.faint, fontSize: 13 }}>Nothing logged.</Text>
                )}
              </Card>
            );
          })}
        </View>
        <View style={{ flex: 1 }}>
          <AddFood meal={meal} setMeal={setMeal} onAdd={add} />
        </View>
      </Columns>
    </View>
  );
}

function defaultMeal(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
}

function MacroBar({ label, v, goal, color }: { label: string; v: number; goal: number; color: string }) {
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
          {Math.round(v)} / {goal} g
        </Text>
      </Row>
      <View style={{ marginTop: 5 }}>
        <Progress value={v} max={goal} color={color} />
      </View>
    </View>
  );
}

function AddFood({ meal, setMeal, onAdd }: { meal: Meal; setMeal: (m: Meal) => void; onAdd: (f: FoodItem, g: number) => void }) {
  const { data, update } = useStore();
  const go = useNav();
  const premium = data.subscription.premium;
  const [tab, setTab] = useState<AddTab>('search');
  const [q, setQ] = useState('');
  const [online, setOnline] = useState<FoodItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });

  const local = searchLocalFoods(q, data.customFoods);

  const searchOnline = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const products = await bridge.searchFood(q.trim());
      const items = products.map(fromOpenFoodFacts).filter((x): x is FoodItem => !!x);
      setOnline(items);
      if (!items.length) setMsg('No products with nutrition facts found.');
    } catch {
      setMsg('Could not reach the OpenFoodFacts database. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  };

  const lookup = async (scanned?: string) => {
    const c = (scanned ?? code).replace(/\s/g, '');
    if (scanned) setCode(scanned);
    if (!isValidBarcode(c)) {
      setMsg('That does not look like a valid EAN/UPC barcode (8, 12, 13 or 14 digits with a correct check digit).');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const p = await bridge.lookupBarcode(c);
      const item = fromOpenFoodFacts(p);
      if (item) setPicked(item);
      else setMsg('Product not found in OpenFoodFacts, or it has no nutrition facts. Try a search or add it as a custom food.');
    } catch {
      setMsg('Could not reach the OpenFoodFacts database. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  };

  const saveCustom = () => {
    const n = (s: string) => Number(s) || 0;
    if (!custom.name.trim()) return;
    const item: FoodItem = { id: newId('custom'), name: custom.name.trim(), kcal: n(custom.kcal), protein: n(custom.protein), carbs: n(custom.carbs), fat: n(custom.fat), source: 'custom' };
    update((d) => ({ ...d, customFoods: [item, ...d.customFoods] }));
    setPicked(item);
    setCustom({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  };

  const g = Number(grams) || 0;

  return (
    <Card title="Add food">
      <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.id, label: m.label }))} />
      <View style={{ height: 12 }} />
      <Segmented<AddTab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMsg(null);
        }}
        options={[
          { value: 'search', label: 'Search' },
          { value: 'barcode', label: 'Barcode', locked: !premium },
          { value: 'custom', label: 'Custom food' },
        ]}
      />
      <View style={{ marginTop: 14 }}>
        {tab === 'search' ? (
          <View>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Field value={q} onChange={(v) => { setQ(v); setOnline(null); }} placeholder="Search foods, e.g. chicken, oats…" onSubmit={searchOnline} />
              <Button title="Search online" kind="ghost" disabled={!q.trim() || busy} onPress={searchOnline} />
            </Row>
            <Label style={{ marginTop: 12, marginBottom: 4 }}>{online ? 'OpenFoodFacts results' : q ? 'Matches' : 'Common foods'}</Label>
            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {(online ?? local).map((f) => (
                <FoodRow key={f.id} f={f} on={picked?.id === f.id} onPress={() => setPicked(f)} />
              ))}
              {!online && q && !local.length ? <Text style={{ color: C.faint, fontSize: 13 }}>Nothing in the built-in list. Try “Search online”.</Text> : null}
            </ScrollView>
          </View>
        ) : tab === 'barcode' ? (
          premium ? (
            <View>
              <Body>
                {CAMERA_SCAN_AVAILABLE
                  ? 'Scan the product barcode with your camera, or type the digits. The product is looked up in OpenFoodFacts.'
                  : 'Type the barcode digits, or use a USB barcode scanner (it types into this box). The product is looked up in OpenFoodFacts.'}
              </Body>
              {CAMERA_SCAN_AVAILABLE ? (
                <View style={{ marginTop: 10 }}>
                  {scanning ? (
                    <BarcodeScanner
                      onClose={() => setScanning(false)}
                      onScanned={(c) => {
                        setScanning(false);
                        lookup(c);
                      }}
                    />
                  ) : (
                    <Button title="📷  Scan barcode" onPress={() => { setMsg(null); setScanning(true); }} />
                  )}
                </View>
              ) : null}
              <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <Field value={code} onChange={(v) => setCode(v.replace(/[^0-9]/g, ''))} placeholder="e.g. 13-digit EAN" onSubmit={() => lookup()} numeric />
                <Button title="Look up" kind={CAMERA_SCAN_AVAILABLE ? 'ghost' : 'primary'} disabled={!code || busy} onPress={() => lookup()} />
              </Row>
            </View>
          ) : (
            <PremiumLock title="Barcode lookup" text="Premium lets you scan or type a product barcode to fill in its nutrition facts automatically." onUpgrade={() => go('premium')} />
          )
        ) : (
          <View style={{ gap: 10 } as any}>
            <Field label="Name" value={custom.name} onChange={(v) => setCustom({ ...custom, name: v })} placeholder="e.g. Homemade granola" />
            <Text style={{ color: C.faint, fontSize: 12 }}>Nutrition per 100 g</Text>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Field label="kcal" numeric value={custom.kcal} onChange={(v) => setCustom({ ...custom, kcal: v })} />
              <Field label="Protein g" numeric value={custom.protein} onChange={(v) => setCustom({ ...custom, protein: v })} />
              <Field label="Carbs g" numeric value={custom.carbs} onChange={(v) => setCustom({ ...custom, carbs: v })} />
              <Field label="Fat g" numeric value={custom.fat} onChange={(v) => setCustom({ ...custom, fat: v })} />
            </Row>
            <Button title="Save custom food" kind="ghost" disabled={!custom.name.trim()} onPress={saveCustom} />
          </View>
        )}
        {busy ? <ActivityIndicator color={C.accent} style={{ marginTop: 10 }} /> : null}
        {msg ? <Text style={{ color: C.recovery.yellow, fontSize: 13, marginTop: 10 }}>{msg}</Text> : null}
      </View>

      {picked ? (
        <View style={{ marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: C.cardAlt }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{picked.name}</Text>
          {picked.brand ? <Text style={{ color: C.faint, fontSize: 12 }}>{picked.brand}</Text> : null}
          <Row gap={10} style={{ alignItems: 'flex-end', marginTop: 10 }}>
            <Field label="Amount (g)" numeric value={grams} onChange={setGrams} width={110} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{Math.round((picked.kcal * g) / 100)} kcal</Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>
                P {((picked.protein * g) / 100).toFixed(1)} · C {((picked.carbs * g) / 100).toFixed(1)} · F {((picked.fat * g) / 100).toFixed(1)} g
              </Text>
            </View>
          </Row>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button title={`Add to ${MEALS.find((m) => m.id === meal)!.label}`} disabled={g <= 0} onPress={() => { onAdd(picked, g); setPicked(null); setGrams('100'); }} />
            <Button title="Cancel" kind="ghost" onPress={() => setPicked(null)} />
          </Row>
        </View>
      ) : null}
      <Text style={{ color: C.faint, fontSize: 11, marginTop: 14 }}>Online data from OpenFoodFacts (open database). Built-in values are approximate generic values per 100 g.</Text>
    </Card>
  );
}

function FoodRow({ f, on, onPress }: { f: FoodItem; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => ({ paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: on ? C.accent + '22' : hovered ? C.cardAlt : 'transparent' })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 14 }} numberOfLines={1}>
            {f.name}
          </Text>
          <Text style={{ color: C.faint, fontSize: 12 }} numberOfLines={1}>
            {f.brand ? `${f.brand} · ` : ''}per 100 g · P {f.protein} · C {f.carbs} · F {f.fat}
            {f.source === 'custom' ? ' · custom' : f.source === 'openfoodfacts' ? ' · OpenFoodFacts' : ''}
          </Text>
        </View>
        <Text style={{ color: C.sub, fontSize: 13 }}>{f.kcal} kcal</Text>
      </Row>
    </Pressable>
  );
}
