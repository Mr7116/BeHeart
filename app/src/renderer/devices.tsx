// Smartwatch & heart-rate sensor state shared by the Devices screen and the live-HR card on Today.
// Sources: Apple Watch (through Apple Health) and any standard Bluetooth heart-rate device.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { bridge } from './bridge';
import type { BleDevice, BleState, HealthSource, LiveReading } from './bridgeTypes';
import { useStore } from './store';
import { applySessionToDay, LIVE_STALE_MS, SessionRecorder, sessionDate } from '../core/heartRate';
import { maxHeartRate } from '../core/scoring';
import type { LiveSession } from '../core/types';

export interface ConnectedSensor {
  id: string;
  name: string;
  battery: number | null;
}

interface Devices {
  /** True on iPhone builds that include Bluetooth. */
  bleAvailable: boolean;
  bleState: BleState;
  scanning: boolean;
  found: BleDevice[];
  sensor: ConnectedSensor | null;
  connectingId: string | null;
  error: string | null;
  /** Latest heart rate from any source (null when nothing recent). */
  live: LiveReading | null;
  /** Readings from the last 10 minutes, oldest first. */
  history: { at: number; bpm: number }[];
  recording: { startedAt: number; avg: number; max: number; zoneMin: number[] } | null;
  sources: HealthSource[];
  scan: () => Promise<void>;
  stopScan: () => void;
  connect: (d: BleDevice) => Promise<void>;
  disconnect: (forget?: boolean) => Promise<void>;
  startRecording: () => void;
  stopRecording: () => LiveSession | null;
  refreshSources: () => Promise<void>;
}

const Ctx = createContext<Devices | null>(null);
export function useDevices(): Devices {
  const d = useContext(Ctx);
  if (!d) throw new Error('Devices not ready');
  return d;
}

const HISTORY_MS = 10 * 60 * 1000;

export function DevicesProvider({ children }: { children: React.ReactNode }) {
  const { data, update } = useStore();
  const [bleState, setBleState] = useState<BleState>('unknown');
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<BleDevice[]>([]);
  const [sensor, setSensor] = useState<ConnectedSensor | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveReading | null>(null);
  const [history, setHistory] = useState<{ at: number; bpm: number }[]>([]);
  const [recording, setRecording] = useState<Devices['recording']>(null);
  const [sources, setSources] = useState<HealthSource[]>([]);

  const recorder = useRef<SessionRecorder | null>(null);
  const sensorRef = useRef<ConnectedSensor | null>(null);
  sensorRef.current = sensor;
  const wantConnected = useRef<string | null>(null);
  const maxHr = maxHeartRate(data.profile.age);

  const onReading = useCallback((r: LiveReading) => {
    setLive(r);
    setHistory((h) => [...h.filter((x) => r.at - x.at < HISTORY_MS), { at: r.at, bpm: r.bpm }]);
    const rec = recorder.current;
    if (rec) {
      rec.add(r.bpm, r.at);
      setRecording({ startedAt: rec.startedAt, avg: rec.avg, max: rec.max, zoneMin: rec.zoneMin });
    }
  }, []);

  // ---------------------------------------------------------------- Bluetooth
  const ble = bridge.ble;

  const connectId = useCallback(
    async (id: string, label: string) => {
      if (!ble) return;
      setConnectingId(id);
      setError(null);
      wantConnected.current = id;
      try {
        const info = await ble.connect(id, onReading, () => {
          setSensor(null);
          // Reconnect automatically if the person didn't disconnect on purpose (out of range, watch screen off…).
          if (wantConnected.current === id) setTimeout(() => wantConnected.current === id && connectId(id, label).catch(() => undefined), 5000);
        });
        setSensor({ id, name: info.name || label, battery: info.battery });
        update((d) => ({ ...d, watch: { autoConnect: true, ...d.watch, bleDeviceId: id, bleDeviceName: info.name || label } }));
      } catch (e: any) {
        setError(`Could not connect to ${label}: ${e?.message ?? e}`);
        if (wantConnected.current === id) setTimeout(() => wantConnected.current === id && connectId(id, label).catch(() => undefined), 15000);
      } finally {
        setConnectingId(null);
      }
    },
    [ble, onReading, update],
  );

  // Bluetooth state, and reconnect the remembered sensor on start-up.
  const savedId = data.watch?.autoConnect ? data.watch?.bleDeviceId : undefined;
  const savedName = data.watch?.bleDeviceName ?? 'heart-rate sensor';
  useEffect(() => {
    if (!ble) return;
    let alive = true;
    ble.state().then((s) => {
      if (!alive) return;
      setBleState(s);
      if (s === 'on' && savedId && !sensorRef.current) connectId(savedId, savedName).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ble]);

  const scan = useCallback(async () => {
    if (!ble) return;
    setError(null);
    const s = await ble.state();
    setBleState(s);
    if (s !== 'on') {
      setError(s === 'off' ? 'Bluetooth is off. Turn it on in Control Centre.' : s === 'unauthorized' ? 'BeHeart is not allowed to use Bluetooth. Allow it in Settings → BeHeart.' : 'Bluetooth is not ready yet. Try again in a moment.');
      return;
    }
    setFound([]);
    setScanning(true);
    try {
      await ble.scan((d) => setFound((f) => (f.some((x) => x.id === d.id) ? f : [...f, d].sort((a, b) => b.rssi - a.rssi))), 12);
    } catch (e: any) {
      setError(`Scan failed: ${e?.message ?? e}`);
    } finally {
      setScanning(false);
    }
  }, [ble]);

  const stopScan = useCallback(() => {
    ble?.stopScan();
  }, [ble]);

  const connect = useCallback(async (d: BleDevice) => {
    ble?.stopScan();
    await connectId(d.id, d.name);
  }, [ble, connectId]);

  const disconnect = useCallback(
    async (forget = false) => {
      const cur = sensorRef.current?.id ?? wantConnected.current;
      wantConnected.current = null;
      if (cur && ble) await ble.disconnect(cur);
      setSensor(null);
      if (forget) update((d) => ({ ...d, watch: { autoConnect: false } }));
      else update((d) => ({ ...d, watch: { ...(d.watch ?? {}), autoConnect: false } }));
    },
    [ble, update],
  );

  // ---------------------------------------------------------------- Apple Watch via Apple Health
  const hk = data.healthKitConnected ? bridge.healthKit : undefined;
  useEffect(() => {
    if (!hk) return;
    let alive = true;
    const pull = () =>
      hk
        .latestHeartRate()
        .then((r) => {
          // A connected Bluetooth sensor is more immediate; only use Apple Health when there's none.
          if (alive && r && !sensorRef.current && Date.now() - r.at < LIVE_STALE_MS) onReading(r);
        })
        .catch(() => undefined);
    pull();
    const off = hk.onChange('heart', pull);
    return () => {
      alive = false;
      off();
    };
  }, [hk, onReading]);

  const refreshSources = useCallback(async () => {
    if (!hk) return setSources([]);
    setSources(await hk.sources().catch(() => []));
  }, [hk]);
  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  // Drop a stale reading so the UI doesn't show an old number as "live".
  useEffect(() => {
    const t = setInterval(() => setLive((l) => (l && Date.now() - l.at > LIVE_STALE_MS ? null : l)), 30000);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------------- Recording
  const startRecording = useCallback(() => {
    recorder.current = new SessionRecorder(maxHr);
    setRecording({ startedAt: recorder.current.startedAt, avg: 0, max: 0, zoneMin: [0, 0, 0, 0, 0] });
  }, [maxHr]);

  const stopRecording = useCallback(() => {
    const rec = recorder.current;
    recorder.current = null;
    setRecording(null);
    if (!rec || rec.max === 0) return null;
    const via = sensorRef.current ? 'bluetooth' : 'apple-health';
    const session = rec.finish(sensorRef.current?.name ?? live?.source ?? 'Apple Watch', via);
    update((d) => ({
      ...d,
      liveSessions: [session, ...(d.liveSessions ?? [])].slice(0, 200),
      // Apple Watch heart rate is already counted when Apple Health syncs; Bluetooth readings are not.
      health: via === 'bluetooth' ? applySessionToDay(d.health, session, sessionDate(session)) : d.health,
    }));
    return session;
  }, [live, update]);

  return (
    <Ctx.Provider
      value={{
        bleAvailable: !!ble,
        bleState,
        scanning,
        found,
        sensor,
        connectingId,
        error,
        live,
        history,
        recording,
        sources,
        scan,
        stopScan,
        connect,
        disconnect,
        startRecording,
        stopRecording,
        refreshSources,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
