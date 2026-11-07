import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppData } from '../core/types';
import { createInitialData } from '../core/defaults';
import { syncDemoWearable } from '../core/sampleData';
import { mergeHealth } from '../core/appleHealth';
import { reapplyBluetoothSessions } from '../core/heartRate';
import { bridge } from './bridge';

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  /** Demo wearable sync, or a live Apple Health read on iPhone when connected. */
  syncNow: () => Promise<string>;
  resetAll: () => void;
  /** iPhone only: true when this build can read Apple Health. */
  canUseHealthKit: boolean;
  connectHealthKit: () => Promise<string>;
  disconnectHealthKit: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store not ready');
  return s;
}

const SYNC_EVERY_MS = 15 * 60 * 1000;

export function StoreProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;

  /** Reads recent Apple Health days and merges them in. Returns how many days changed. */
  const pullHealthKit = useCallback(async (days: number): Promise<number> => {
    const d = dataRef.current;
    if (!bridge.healthKit || !d) return 0;
    const incoming = await bridge.healthKit.read(days, d.profile.age);
    let changed = 0;
    setData((cur) => {
      if (!cur) return cur;
      const m = mergeHealth(cur.health, incoming);
      changed = m.changed;
      const replaced = new Set(incoming.map((d) => d.date).filter((date) => m.health.find((h) => h.date === date)?.source !== 'manual'));
      const health = reapplyBluetoothSessions(m.health, cur.liveSessions, replaced);
      return { ...cur, health, lastSync: new Date().toISOString() };
    });
    return changed;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let d = await bridge.load().catch(() => null);
      if (!d || d.version !== 1) d = createInitialData();
      else if (d.autoSync && !d.healthKitConnected) {
        // "Background" sync on start-up: bring the demo wearable up to today.
        const { health } = syncDemoWearable(d.health, d.profile);
        d = { ...d, health, lastSync: new Date().toISOString() };
      }
      if (!alive) return;
      setData(d);
      if (d.healthKitConnected && d.autoSync) {
        dataRef.current = d;
        pullHealthKit(14).catch(() => undefined);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pullHealthKit]);

  useEffect(() => {
    if (!data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      bridge.save(data).catch(() => undefined);
    }, 400);
  }, [data]);

  // Periodic sync while the app is open.
  useEffect(() => {
    const t = setInterval(() => {
      const d = dataRef.current;
      if (!d || !d.autoSync) return;
      if (d.healthKitConnected) pullHealthKit(3).catch(() => undefined);
      else setData((cur) => (cur ? { ...cur, health: syncDemoWearable(cur.health, cur.profile).health, lastSync: new Date().toISOString() } : cur));
    }, SYNC_EVERY_MS);
    return () => clearInterval(t);
  }, [pullHealthKit]);

  // When the watch syncs new heart, HRV or sleep data into Apple Health, read it straight away.
  const hkOn = !!data?.healthKitConnected && !!data?.autoSync;
  useEffect(() => {
    if (!hkOn || !bridge.healthKit) return;
    bridge.healthKit.enableBackgroundSync().catch(() => undefined);
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = bridge.healthKit.onChange('any', () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => pullHealthKit(2).catch(() => undefined), 3000);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [hkOn, pullHealthKit]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);

  const syncNow = useCallback(async () => {
    const d = dataRef.current;
    if (d?.healthKitConnected && bridge.healthKit) {
      const n = await pullHealthKit(30);
      return `Read Apple Health: ${n} days updated.`;
    }
    setData((cur) => {
      if (!cur) return cur;
      const r = syncDemoWearable(cur.health, cur.profile);
      return { ...cur, health: r.health, lastSync: new Date().toISOString() };
    });
    return 'Up to date.';
  }, [pullHealthKit]);

  const connectHealthKit = useCallback(async () => {
    if (!bridge.healthKit) return 'Apple Health is only available in the iPhone app.';
    const ok = await bridge.healthKit.connect();
    if (!ok) return 'Apple Health is not available in this build. Install the full iPhone build (not Expo Go) to connect it.';
    // Replace sample days with real ones.
    setData((cur) => (cur ? { ...cur, healthKitConnected: true, health: cur.health.filter((h) => h.source !== 'demo-wearable') } : cur));
    if (dataRef.current) dataRef.current = { ...dataRef.current, healthKitConnected: true };
    const n = await pullHealthKit(120);
    return n ? `Connected. Read ${n} days from Apple Health.` : 'Connected, but Apple Health returned no data yet. Check permissions in the Health app.';
  }, [pullHealthKit]);

  const disconnectHealthKit = useCallback(() => {
    setData((cur) => (cur ? { ...cur, healthKitConnected: false, health: syncDemoWearable(cur.health, cur.profile).health } : cur));
  }, []);

  const resetAll = useCallback(() => setData(createInitialData()), []);

  if (!data) return <>{fallback}</>;
  return (
    <Ctx.Provider value={{ data, update, syncNow, resetAll, canUseHealthKit: !!bridge.healthKit, connectHealthKit, disconnectHealthKit }}>
      {children}
    </Ctx.Provider>
  );
}
