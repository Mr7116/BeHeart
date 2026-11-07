// iPhone bridge: data kept on the phone in a SQLite database (beheart.db), food lookups straight to OpenFoodFacts,
// and live Apple Health reads through HealthKit. Metro picks this file over bridge.ts on iOS.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  CategoryValueSleepAnalysis,
  configureBackgroundTypes,
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  querySources,
  requestAuthorization,
  subscribeToChanges,
} from '@kingstinct/react-native-healthkit';
import type { UpdateFrequency } from '@kingstinct/react-native-healthkit';
import BleManager from 'react-native-ble-manager';
import * as SQLite from 'expo-sqlite';
import { HealthDatabase, SqlDriver } from '../core/database';
import type { AppData } from '../core/types';
import { AppleHealthAggregator } from '../core/appleHealth';
import { BATTERY_LEVEL, BATTERY_SERVICE, HR_MEASUREMENT, HR_SERVICE, parseHeartRateMeasurement, sameUuid } from '../core/heartRate';
import type { BleHeartRateAccess, BleState, Bridge, HealthKitAccess, HealthSource } from './bridgeTypes';

export type { Bridge, HealthKitAccess, ImportResult } from './bridgeTypes';

const LEGACY_KEY = 'beheart-data'; // AsyncStorage JSON used before the SQLite database
const DB_NAME = 'beheart.db';

// ------------------------------------------------------------ SQLite storage
let dbPromise: Promise<HealthDatabase> | null = null;
function database(): Promise<HealthDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const native = await SQLite.openDatabaseAsync(DB_NAME);
      const driver: SqlDriver = {
        exec: (sql) => native.execAsync(sql),
        run: async (sql, params) => {
          await native.runAsync(sql, params);
        },
        all: (sql, params = []) => native.getAllAsync(sql, params),
        transaction: (fn) => native.withTransactionAsync(fn),
      };
      const db = new HealthDatabase(driver);
      await db.open();
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
const UA = { 'User-Agent': 'BeHeart/0.1 (iOS health tracker)', Accept: 'application/json' };
const FIELDS = 'code,product_name,generic_name,brands,nutriments';

const QUANTITIES = [
  ['HKQuantityTypeIdentifierHeartRate', 'count/min'],
  ['HKQuantityTypeIdentifierRestingHeartRate', 'count/min'],
  ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'],
  ['HKQuantityTypeIdentifierRespiratoryRate', 'count/min'],
  ['HKQuantityTypeIdentifierStepCount', 'count'],
  ['HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'],
] as const;

const SLEEP_NAMES: Record<number, string> = {
  [CategoryValueSleepAnalysis.inBed]: 'InBed',
  [CategoryValueSleepAnalysis.asleepUnspecified]: 'AsleepUnspecified',
  [CategoryValueSleepAnalysis.awake]: 'Awake',
  [CategoryValueSleepAnalysis.asleepCore]: 'AsleepCore',
  [CategoryValueSleepAnalysis.asleepDeep]: 'AsleepDeep',
  [CategoryValueSleepAnalysis.asleepREM]: 'AsleepREM',
};

function healthKitUsable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false; // native module missing (e.g. running inside Expo Go)
  }
}

const healthKit: HealthKitAccess = {
  async connect() {
    if (Platform.OS !== 'ios') return false;
    let available = false;
    try {
      available = isHealthDataAvailable();
    } catch (e: any) {
      throw new Error(`HealthKit module is missing from this build (${e?.message ?? e}).`);
    }
    if (!available) throw new Error('This device does not support Apple Health.');
    // Throws with the real reason, e.g. a missing com.apple.developer.healthkit entitlement after re-signing.
    await requestAuthorization({
      toRead: [...QUANTITIES.map(([id]) => id), 'HKCategoryTypeIdentifierSleepAnalysis'],
    });
    return true;
  },
  async read(days, age) {
    if (!healthKitUsable()) return [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    // Sleep for the first morning starts the evening before.
    const sleepStart = new Date(startDate.getTime() - 12 * 3600 * 1000);
    const agg = new AppleHealthAggregator();
    for (const [id, unit] of QUANTITIES) {
      const samples = await queryQuantitySamples(id, { limit: 0, unit, ascending: true, filter: { date: { startDate } } });
      for (const s of samples) agg.add(id, s.startDate, s.endDate, s.quantity, unit);
    }
    const sleep = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, ascending: true, filter: { date: { startDate: sleepStart } } });
    for (const s of sleep) {
      const name = SLEEP_NAMES[Number(s.value)];
      if (name) agg.add('HKCategoryTypeIdentifierSleepAnalysis', s.startDate, s.endDate, `HKCategoryValueSleepAnalysis${name}`);
    }
    return agg.result(age);
  },
  async sources() {
    if (!healthKitUsable()) return [];
    const kinds: [string, any][] = [
      ['Heart rate', 'HKQuantityTypeIdentifierHeartRate'],
      ['HRV', 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
      ['Sleep', 'HKCategoryTypeIdentifierSleepAnalysis'],
      ['Steps', 'HKQuantityTypeIdentifierStepCount'],
    ];
    const byId = new Map<string, HealthSource>();
    for (const [label, id] of kinds) {
      const list = await querySources(id).catch(() => []);
      for (const src of list) {
        const key = `${src.bundleIdentifier}|${src.name}`;
        const cur = byId.get(key) ?? { name: src.name, bundleId: src.bundleIdentifier, kinds: [] };
        cur.kinds.push(label);
        byId.set(key, cur);
      }
    }
    // Hardware model (e.g. "Watch7,1") is only on samples, so look at recent heart-rate readings.
    const recent = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { limit: 200, ascending: false, unit: 'count/min' }).catch(() => []);
    for (const s of recent) {
      const rev = s.sourceRevision;
      const key = `${rev?.source?.bundleIdentifier}|${rev?.source?.name}`;
      const cur = byId.get(key);
      if (cur && !cur.productType && rev?.productType) cur.productType = rev.productType;
    }
    return Array.from(byId.values());
  },
  async latestHeartRate() {
    if (!healthKitUsable()) return null;
    const [s] = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { limit: 1, ascending: false, unit: 'count/min' });
    if (!s) return null;
    return { bpm: Math.round(s.quantity), at: new Date(s.endDate).getTime(), source: s.device?.name || s.sourceRevision?.source?.name || 'Apple Health' };
  },
  onChange(kind, cb) {
    if (!healthKitUsable()) return () => undefined;
    const ids: any[] =
      kind === 'heart'
        ? ['HKQuantityTypeIdentifierHeartRate']
        : ['HKQuantityTypeIdentifierRestingHeartRate', 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierActiveEnergyBurned'];
    const subs = ids.map((id) => {
      try {
        return subscribeToChanges(id, () => cb());
      } catch {
        return null;
      }
    });
    return () => subs.forEach((x) => x?.remove());
  },
  async enableBackgroundSync() {
    if (!healthKitUsable()) return false;
    try {
      const HOURLY = 2 as UpdateFrequency;
      return await configureBackgroundTypes(
        [...QUANTITIES.map(([id]) => id), 'HKCategoryTypeIdentifierSleepAnalysis'],
        HOURLY,
      );
    } catch {
      return false;
    }
  },
};

// ------------------------------------------------------------ Bluetooth heart-rate sensors

let bleStarted: Promise<void> | null = null;
let bleState: BleState = 'unknown';
function startBle(): Promise<void> {
  if (!bleStarted) {
    bleStarted = (async () => {
      BleManager.onDidUpdateState((e) => {
        bleState = mapState(String(e.state));
      });
      await BleManager.start({ showAlert: false, restoreIdentifierKey: 'beheart-ble' });
      BleManager.checkState();
    })().catch((e) => {
      bleStarted = null;
      throw e;
    });
  }
  return bleStarted;
}
function mapState(s: string): BleState {
  return s === 'on' ? 'on' : s === 'off' || s === 'turning_off' ? 'off' : s === 'unauthorized' ? 'unauthorized' : s === 'unsupported' ? 'unsupported' : 'unknown';
}

/** CoreBluetooth reports "unknown" for a moment after start-up (and while the permission prompt is open). */
async function settledState(timeoutMs = 4000): Promise<BleState> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    bleState = mapState(String(await BleManager.checkState()));
    if (bleState !== 'unknown' || Date.now() > until) return bleState;
    await new Promise((r) => setTimeout(r, 250));
  }
}

const ble: BleHeartRateAccess = {
  async state() {
    try {
      await startBle();
      return await settledState();
    } catch {
      return 'unsupported';
    }
  },
  async scan(onFound, seconds) {
    await startBle();
    const seen = new Set<string>();
    const found = BleManager.onDiscoverPeripheral((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      onFound({ id: p.id, name: p.name || p.advertising?.localName || 'Heart-rate sensor', rssi: p.rssi });
    });
    await new Promise<void>((resolve, reject) => {
      const stop = BleManager.onStopScan(() => {
        stop.remove();
        resolve();
      });
      BleManager.scan({ serviceUUIDs: [HR_SERVICE], seconds, allowDuplicates: false }).catch((e) => {
        stop.remove();
        reject(e);
      });
    }).finally(() => found.remove());
  },
  async stopScan() {
    await BleManager.stopScan().catch(() => undefined);
  },
  async connect(id, onReading, onDisconnect) {
    await startBle();
    await BleManager.connect(id);
    const info = await BleManager.retrieveServices(id);
    const name = info.name || info.advertising?.localName || 'Heart-rate sensor';
    let battery: number | null = null;
    if (info.services?.some((sv) => sameUuid(String(sv.uuid ?? sv), BATTERY_SERVICE))) {
      battery = await BleManager.read(id, BATTERY_SERVICE, BATTERY_LEVEL)
        .then((b) => (Array.isArray(b) && b.length ? b[0] : null))
        .catch(() => null);
    }
    const values = BleManager.onDidUpdateValueForCharacteristic((e) => {
      if (e.peripheral !== id || !sameUuid(e.characteristic, HR_MEASUREMENT)) return;
      const m = parseHeartRateMeasurement(e.value);
      if (m && m.contact !== false) onReading({ bpm: m.bpm, at: Date.now(), source: name, rrMs: m.rrMs });
    });
    const gone = BleManager.onDisconnectPeripheral((e) => {
      if (e.peripheral !== id) return;
      values.remove();
      gone.remove();
      onDisconnect();
    });
    await BleManager.startNotification(id, HR_SERVICE, HR_MEASUREMENT);
    return { name, battery };
  },
  async disconnect(id) {
    await BleManager.stopNotification(id, HR_SERVICE, HR_MEASUREMENT).catch(() => undefined);
    await BleManager.disconnect(id).catch(() => undefined);
  },
};

export const bridge: Bridge = {
  healthKit,
  ble,
  async load() {
    const db = await database();
    const stored = await db.load();
    if (stored) return stored;
    // First start after the update: move the old AsyncStorage JSON into SQLite once.
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as AppData;
    await db.save(legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return legacy;
  },
  async save(data) {
    await (await database()).save(data);
    return true;
  },
  async dataLocation() {
    const c = await (await database()).counts().catch(() => null);
    if (!c) return 'SQLite database on this iPhone';
    return `SQLite database on this iPhone (${DB_NAME}) · ${c.daily_health} days · ${c.workout_sessions} workouts · ${c.food_entries} meals logged · ${c.live_sessions} heart-rate recordings`;
  },
  async exportData() {
    return null;
  },
  async importAppleHealth() {
    throw new Error('On iPhone, connect Apple Health directly instead of importing a file.');
  },
  async searchFood(query) {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`,
      { headers: UA },
    );
    if (!res.ok) throw new Error(`Food database answered ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.products) ? json.products : [];
  },
  async lookupBarcode(code) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { headers: UA });
    if (!res.ok) throw new Error(`Food database answered ${res.status}`);
    const json = await res.json();
    return json.status === 1 ? json.product : null;
  },
  async isScreenshot() {
    return false;
  },
  async startOptions() {
    return { screen: null, premium: false };
  },
};
