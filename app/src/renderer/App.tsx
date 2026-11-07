import React, { createContext, useContext, useEffect, useState } from 'react';
import { bridge } from './bridge';
import { todayISO } from '../core/dates';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useIsPhone } from './ui';
import { SafeArea, SafeAreaRoot } from './SafeArea';
import { C } from './theme';
import { StoreProvider, useStore } from './store';
import { TodayScreen } from './screens/Today';
import { TrendsScreen } from './screens/Trends';
import { SleepScreen } from './screens/Sleep';
import { CardioScreen } from './screens/Cardio';
import { WorkoutsScreen } from './screens/Workouts';
import { NutritionScreen } from './screens/Nutrition';
import { HealthDataScreen } from './screens/HealthData';
import { PremiumScreen } from './screens/Premium';
import { ProfileScreen } from './screens/Profile';
import { DevicesScreen } from './screens/Devices';
import { DevicesProvider } from './devices';

export type ScreenId = 'today' | 'trends' | 'sleep' | 'cardio' | 'workouts' | 'nutrition' | 'health' | 'premium' | 'profile' | 'devices' | 'more';

// Phone layout: five tabs at the bottom; the rest live under "More".
const PHONE_TABS: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'sleep', label: 'Sleep', icon: '🌙' },
  { id: 'workouts', label: 'Workouts', icon: '🏋' },
  { id: 'nutrition', label: 'Food', icon: '🍽' },
  { id: 'more', label: 'More', icon: '☰' },
];

function MoreScreen({ go, premium }: { go: (s: ScreenId) => void; premium: boolean }) {
  const items: { id: ScreenId; label: string; icon: string; sub: string; pro?: boolean }[] = [
    { id: 'devices', label: 'Watch & Sensors', icon: '⌚', sub: 'Apple Watch, Garmin, Polar, chest straps · live heart rate' },
    { id: 'trends', label: 'Trends', icon: '📈', sub: '7, 30 and 90-day charts' },
    { id: 'cardio', label: 'Cardio Fitness', icon: '❤', sub: 'VO₂max, zones and cardio load', pro: true },
    { id: 'health', label: 'Health Data', icon: '⟳', sub: 'Apple Health, sync and manual entry' },
    { id: 'premium', label: 'Premium', icon: '★', sub: premium ? 'Your subscription' : 'See what Premium unlocks' },
    { id: 'profile', label: 'Profile & settings', icon: '👤', sub: 'Body details, goals and data' },
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginBottom: 8 }}>More</Text>
      {items.map((it) => (
        <Pressable key={it.id} onPress={() => go(it.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ width: 32, fontSize: 18, color: C.accent }}>{it.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{it.label}</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{it.sub}</Text>
          </View>
          {it.pro && !premium ? <Text style={st.navBadge}>PRO</Text> : <Text style={{ color: C.faint, fontSize: 18 }}>›</Text>}
        </Pressable>
      ))}
    </View>
  );
}
const SCREENS: ScreenId[] = ['today', 'trends', 'sleep', 'cardio', 'workouts', 'nutrition', 'health', 'devices', 'premium', 'profile'];

const NAV: { id: ScreenId; label: string; icon: string; premium?: boolean }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'sleep', label: 'Sleep', icon: '🌙' },
  { id: 'cardio', label: 'Cardio Fitness', icon: '❤', premium: true },
  { id: 'workouts', label: 'Workouts', icon: '🏋' },
  { id: 'nutrition', label: 'Nutrition', icon: '🍽' },
  { id: 'health', label: 'Health Data', icon: '⟳' },
  { id: 'devices', label: 'Watch & Sensors', icon: '⌚' },
];

const NavCtx = createContext<(s: ScreenId) => void>(() => undefined);
export const useNav = () => useContext(NavCtx);

function Shell() {
  const [screen, setScreen] = useState<ScreenId>('today');
  const { data, update } = useStore();
  const phone = useIsPhone();
  const premium = data.subscription.premium;

  useEffect(() => {
    bridge
      .startOptions()
      .then((o) => {
        if (o.screen && SCREENS.includes(o.screen as ScreenId)) setScreen(o.screen as ScreenId);
        if (o.premium) update((d) => ({ ...d, subscription: { premium: true, plan: 'yearly', since: d.subscription.since ?? todayISO() } }));
      })
      .catch(() => undefined);
  }, [update]);

  const body = (() => {
    switch (screen) {
      case 'today':
        return <TodayScreen />;
      case 'trends':
        return <TrendsScreen />;
      case 'sleep':
        return <SleepScreen />;
      case 'cardio':
        return <CardioScreen />;
      case 'workouts':
        return <WorkoutsScreen />;
      case 'nutrition':
        return <NutritionScreen />;
      case 'health':
        return <HealthDataScreen />;
      case 'devices':
        return <DevicesScreen />;
      case 'premium':
        return <PremiumScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'more':
        return <MoreScreen go={setScreen} premium={premium} />;
    }
  })();

  if (phone) {
    const tabOf = (s: ScreenId): ScreenId => (PHONE_TABS.some((t) => t.id === s) ? s : 'more');
    return (
      <NavCtx.Provider value={setScreen}>
        <SafeArea style={[st.root, { flexDirection: 'column' }]}>
          <StatusBar barStyle="light-content" />
          <View style={st.phoneTop}>
            <View style={[st.logo, { width: 26, height: 26, borderRadius: 8 }]}>
              <Text style={{ color: '#06110B', fontWeight: '900', fontSize: 14 }}>♥</Text>
            </View>
            <Text style={[st.brandText, { fontSize: 17, flex: 1 }]}>BeHeart</Text>
            <Pressable onPress={() => setScreen('premium')}>
              <Text style={{ color: C.premium, fontWeight: '800', fontSize: 13 }}>{premium ? '★ Premium' : '★ Go Premium'}</Text>
            </Pressable>
          </View>
          <ScrollView key={screen} style={st.main} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
          <View style={st.tabBar}>
            {PHONE_TABS.map((t) => {
              const on = tabOf(screen) === t.id;
              return (
                <Pressable key={t.id} onPress={() => setScreen(t.id)} style={st.tab}>
                  <Text style={{ fontSize: 18, color: on ? C.accent : C.sub }}>{t.icon}</Text>
                  <Text style={{ fontSize: 11, marginTop: 2, fontWeight: '600', color: on ? C.text : C.sub }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SafeArea>
      </NavCtx.Provider>
    );
  }

  return (
    <NavCtx.Provider value={setScreen}>
      <View style={st.root}>
        <View style={st.sidebar}>
          <View style={st.brand}>
            <View style={st.logo}>
              <Text style={{ color: '#06110B', fontWeight: '900', fontSize: 16 }}>♥</Text>
            </View>
            <Text style={st.brandText}>BeHeart</Text>
          </View>
          {NAV.map((n) => {
            const on = n.id === screen;
            return (
              <Pressable key={n.id} onPress={() => setScreen(n.id)} style={({ hovered }: any) => [st.nav, on && st.navOn, !on && hovered && { backgroundColor: C.card }]}>
                <Text style={[st.navIcon, on && { color: C.accent }]}>{n.icon}</Text>
                <Text style={[st.navText, on && { color: C.text }]}>{n.label}</Text>
                {n.premium && !premium ? <Text style={st.navBadge}>PRO</Text> : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setScreen('premium')} style={[st.premiumBox, screen === 'premium' && { borderColor: C.premium }]}>
            <Text style={{ color: C.premium, fontWeight: '800', fontSize: 13 }}>{premium ? '★ Premium active' : '★ Go Premium'}</Text>
            <Text style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
              {premium ? `${data.subscription.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan` : 'Long-term trends, sleep & cardio reports'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setScreen('profile')} style={({ hovered }: any) => [st.profile, (screen === 'profile' || hovered) && { backgroundColor: C.card }]}>
            <View style={st.avatar}>
              <Text style={{ color: C.text, fontWeight: '700' }}>{data.profile.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{data.profile.name}</Text>
              <Text style={{ color: C.faint, fontSize: 11 }}>Profile & settings</Text>
            </View>
          </Pressable>
        </View>
        <ScrollView style={st.main} contentContainerStyle={st.mainInner}>
          {body}
        </ScrollView>
      </View>
    </NavCtx.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaRoot>
      <StoreProvider
        fallback={
          <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: C.sub }}>Loading your data…</Text>
          </View>
        }
      >
        <DevicesProvider>
          <Shell />
        </DevicesProvider>
      </StoreProvider>
    </SafeAreaRoot>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg, height: '100%' as any },
  sidebar: { width: 228, backgroundColor: C.sidebar, borderRightWidth: 1, borderRightColor: C.border, paddingVertical: 20, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 26 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandText: { color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4 },
  navOn: { backgroundColor: C.cardAlt },
  navIcon: { width: 24, color: C.sub, fontSize: 15, textAlign: 'center', marginRight: 10 },
  navText: { color: C.sub, fontSize: 14, fontWeight: '600', flex: 1 },
  navBadge: { color: C.premium, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: C.premium + '88', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  premiumBox: { borderWidth: 1, borderColor: C.premium + '55', backgroundColor: C.premium + '10', borderRadius: 12, padding: 12, marginBottom: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  main: { flex: 1 },
  phoneTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.sidebar, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  mainInner: { padding: 28, maxWidth: 1180, width: '100%' as any },
});
