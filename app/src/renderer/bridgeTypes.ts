// The shape every platform bridge (desktop/Electron, iPhone) provides to the screens.
import type { AppData, DailyHealth } from '../core/types';

export interface ImportResult {
  file: string;
  records: number;
  used: number;
  days: DailyHealth[];
}

/** Live Apple Health access — only present in the iPhone build. */
export interface HealthKitAccess {
  /** Asks iOS for read permission. Resolves false when HealthKit isn't available (e.g. Expo Go). */
  connect(): Promise<boolean>;
  /** Reads the last `days` days and turns them into daily summaries. */
  read(days: number, age: number): Promise<DailyHealth[]>;
  /** Apps and devices (Apple Watch, Garmin Connect, Fitbit…) that have written heart or sleep data. */
  sources(): Promise<HealthSource[]>;
  /** Latest heart-rate sample in Apple Health (Apple Watch writes one every few minutes, every few seconds during a workout). */
  latestHeartRate(): Promise<LiveReading | null>;
  /** Calls back whenever new samples of the watched types land in Apple Health. Returns an unsubscribe function. */
  onChange(kind: 'heart' | 'any', cb: () => void): () => void;
  /** Lets iOS wake the app when the watch syncs new data. */
  enableBackgroundSync(): Promise<boolean>;
}

export interface HealthSource {
  name: string;
  bundleId: string;
  /** e.g. "Watch7,1" — set when Apple Health knows the hardware. */
  productType?: string;
  /** Which kinds of data this source has written. */
  kinds: string[];
}

export interface LiveReading {
  bpm: number;
  /** Epoch ms of the reading. */
  at: number;
  /** Device or app name. */
  source: string;
  rrMs?: number[];
}

export type BleState = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown';

export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
}

/** Standard Bluetooth heart-rate sensors (Garmin/COROS/Polar/Amazfit in HR-broadcast mode, chest straps, arm bands). */
export interface BleHeartRateAccess {
  state(): Promise<BleState>;
  /** Scans for devices that advertise the Heart Rate service. Resolves when scanning stops. */
  scan(onFound: (d: BleDevice) => void, seconds: number): Promise<void>;
  stopScan(): Promise<void>;
  connect(id: string, onReading: (r: LiveReading) => void, onDisconnect: () => void): Promise<{ name: string; battery: number | null }>;
  disconnect(id: string): Promise<void>;
}

export interface Bridge {
  /** Present on iPhone only. */
  healthKit?: HealthKitAccess;
  /** Bluetooth heart-rate sensors — present on iPhone only. */
  ble?: BleHeartRateAccess;
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<boolean>;
  dataLocation(): Promise<string>;
  exportData(data: AppData): Promise<string | null>;
  importAppleHealth(age: number): Promise<ImportResult | null>;
  searchFood(query: string): Promise<any[]>;
  lookupBarcode(code: string): Promise<any | null>;
  isScreenshot(): Promise<boolean>;
  /** Optional start-up flags: --screen <id> opens a screen, --premium previews Premium. */
  startOptions(): Promise<{ screen: string | null; premium: boolean }>;
}
