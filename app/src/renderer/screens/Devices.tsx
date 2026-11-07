// Watch & sensors: live heart rate, Apple Watch via Apple Health, Bluetooth heart-rate devices,
// and how to bring Garmin / Huawei / Amazfit / Xiaomi / Polar / COROS data in through Apple Health.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { useStore } from '../store';
import { useDevices } from '../devices';
import { Body, Button, Card, Columns, H1, Label, Pill, Progress, Row, Stat } from '../ui';
import { LineChart } from '../charts';
import { C, ZONE_COLORS } from '../theme';
import { BRAND_LABEL, identifyBrand, zoneIndex, WatchBrand } from '../../core/heartRate';
import { maxHeartRate, ZONE_LABELS } from '../../core/scoring';
import { durationLabel, shortLabel } from '../../core/dates';

const BROADCAST_TIPS: { brand: string; how: string }[] = [
  { brand: 'Garmin', how: 'On the watch: hold UP/Menu → Sensors & Accessories → Wrist Heart Rate → Broadcast Heart Rate (or Broadcast During Activity).' },
  { brand: 'COROS', how: 'On the watch: Settings → Heart Rate Broadcast → On.' },
  { brand: 'Polar', how: 'On the watch: Settings → General settings → Share HR with other devices. Polar straps (H9/H10/Verity) work straight away.' },
  { brand: 'Amazfit / Zepp', how: 'In the watch: Settings → Heart rate → Share heart rate / Heart-rate push → On.' },
  { brand: 'Huawei / Honor', how: 'In the watch: Settings → Workout settings → HR data broadcast → On (watches with this option).' },
  { brand: 'Xiaomi / Mi Band', how: 'In Mi Fitness / Zepp Life: device → Heart rate sharing → On, and make the band discoverable.' },
  { brand: 'Chest straps & arm bands', how: 'Wahoo TICKR, Garmin HRM, Polar, Scosche, Suunto and others — just wear them so they wake up.' },
];

const HEALTH_SYNC: { brand: string; how: string }[] = [
  { brand: 'Garmin', how: 'Garmin Connect → More → Settings → Connected Apps → Apple Health → turn on all.' },
  { brand: 'Huawei', how: 'Huawei Health → Me → Privacy management / Data sharing → Health app → turn on.' },
  { brand: 'Amazfit / Zepp', how: 'Zepp → Profile → Add accounts → Apple Health.' },
  { brand: 'Xiaomi', how: 'Mi Fitness → Profile → Third-party data → Apple Health.' },
  { brand: 'Polar · COROS · Suunto · Oura · WHOOP · Withings', how: 'In each brand’s app, look for Connected services / Partners → Apple Health.' },
  { brand: 'Fitbit', how: 'Fitbit doesn’t send data to Apple Health itself; a third-party bridge app is needed — or use HR broadcast where your model supports it.' },
  { brand: 'Samsung Galaxy Watch', how: 'Galaxy Watch models don’t pair with iPhone, so their data can’t reach Apple Health.' },
];

export function DevicesScreen() {
  const { data, update, canUseHealthKit, connectHealthKit } = useStore();
  const dev = useDevices();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const maxHr = maxHeartRate(data.profile.age);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!canUseHealthKit && !dev.bleAvailable) {
    return (
      <View>
        <H1 sub="Apple Watch and Bluetooth heart-rate devices">Watch & Sensors</H1>
        <Card>
          <Body>
            Watches and heart-rate sensors connect to the BeHeart iPhone app. On this computer you can import an Apple Health export from Health Data instead.
          </Body>
        </Card>
      </View>
    );
  }

  const z = dev.live ? zoneIndex(dev.live.bpm, maxHr) : -1;
  const zColor = z >= 0 ? ZONE_COLORS[z] : C.sub;
  const age = dev.live ? Math.max(0, Math.round((now - dev.live.at) / 1000)) : 0;

  return (
    <View>
      <H1 sub="Apple Watch, Garmin, Polar, COROS, Amazfit, Huawei and chest straps">Watch & Sensors</H1>

      {/* ------------------------------------------------------------ Live heart rate */}
      <Card title="Live heart rate" right={dev.live ? <Text style={{ color: C.faint, fontSize: 12 }}>{dev.live.source}</Text> : undefined}>
        {dev.live ? (
          <View>
            <Row style={{ alignItems: 'flex-end' }} gap={10}>
              <Text style={{ color: zColor, fontSize: 64, fontWeight: '800', lineHeight: 70 }}>{dev.live.bpm}</Text>
              <View style={{ paddingBottom: 10 }}>
                <Text style={{ color: C.sub, fontSize: 15 }}>bpm ♥</Text>
                <Text style={{ color: C.faint, fontSize: 11 }}>{age < 5 ? 'just now' : age < 120 ? `${age}s ago` : `${Math.round(age / 60)} min ago`}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ paddingBottom: 12 }}>{z >= 0 ? <Pill text={ZONE_LABELS[z]} color={zColor} /> : <Pill text="Resting" color={C.sub} />}</View>
            </Row>
            {dev.history.length > 2 ? (
              <View style={{ marginTop: 8 }}>
                <LineChart height={110} series={[{ values: dev.history.map((h) => h.bpm), color: C.rhr, width: 2 }]} labels={dev.history.map(() => '')} />
              </View>
            ) : null}
          </View>
        ) : (
          <Body>
            {dev.sensor
              ? 'Connected — waiting for the first reading…'
              : data.healthKitConnected
                ? 'No recent heart rate yet. Start a workout on your Apple Watch for second-by-second readings, or connect a Bluetooth sensor below.'
                : 'Connect Apple Health or a Bluetooth heart-rate device below to see your heart rate here.'}
          </Body>
        )}

        <View style={{ marginTop: 14 }}>
          {dev.recording ? (
            <View>
              <Row style={{ flexWrap: 'wrap' }}>
                <Stat label="Time" value={clock(Math.max(0, Math.floor((now - dev.recording.startedAt) / 1000)))} />
                <Stat label="Average" value={dev.recording.avg ? String(dev.recording.avg) : '—'} unit="bpm" />
                <Stat label="Max" value={dev.recording.max ? String(dev.recording.max) : '—'} unit="bpm" color={C.rhr} />
              </Row>
              <View style={{ marginTop: 10, gap: 6 }}>
                {dev.recording.zoneMin.map((m, i) => (
                  <Row key={i} gap={8} style={{ alignItems: 'center' }}>
                    <Text style={{ color: C.sub, fontSize: 11, width: 52 }}>Zone {i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Progress value={m} max={Math.max(1, ...dev.recording!.zoneMin)} color={ZONE_COLORS[i]} />
                    </View>
                    <Text style={{ color: C.text, fontSize: 11, width: 46, textAlign: 'right' }}>{m.toFixed(1)}m</Text>
                  </Row>
                ))}
              </View>
              <Button
                title="Stop & save workout"
                kind="danger"
                style={{ marginTop: 12 }}
                onPress={() => {
                  const s = dev.stopRecording();
                  setMsg(s ? `Saved: avg ${s.avgHr} bpm, max ${s.maxHr} bpm. ${s.via === 'bluetooth' ? 'Zone minutes were added to today’s Strain.' : 'Apple Health adds it to today’s Strain on the next sync.'}` : 'Nothing recorded — no heart-rate readings arrived.');
                }}
              />
            </View>
          ) : (
            <Row gap={10} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Button title="● Record workout" disabled={!dev.sensor && !data.healthKitConnected} onPress={() => { setMsg(null); dev.startRecording(); }} />
              {msg ? <Text style={{ color: C.accent, fontSize: 13, flex: 1 }}>{msg}</Text> : null}
            </Row>
          )}
        </View>
      </Card>

      <Columns style={{ alignItems: 'stretch', marginTop: 16 }}>
        {/* ---------------------------------------------------------- Apple Watch */}
        <Card style={{ flex: 1 }} title="Apple Watch">
          {!canUseHealthKit ? (
            <Body>Apple Watch data comes through Apple Health, which needs the full iPhone build (not Expo Go).</Body>
          ) : data.healthKitConnected ? (
            <View>
              <Body>
                Connected through Apple Health. Heart rate, resting HR, HRV, respiratory rate, sleep stages, steps and active energy are read automatically whenever the watch syncs — even when BeHeart is closed (iOS wakes the app in the background).
              </Body>
              <Label style={{ marginTop: 14, marginBottom: 6 }}>Devices & apps writing to Apple Health</Label>
              {dev.sources.length ? (
                dev.sources.map((s) => <SourceRow key={`${s.bundleId}|${s.name}`} name={s.name} kinds={s.kinds} brand={identifyBrand(s.name, s.bundleId, s.productType)} />)
              ) : (
                <Text style={{ color: C.faint, fontSize: 13 }}>No heart or sleep data found yet. Wear your watch, then tap Refresh.</Text>
              )}
              <Row gap={10} style={{ marginTop: 10 }}>
                <Button title="Refresh" kind="ghost" small onPress={() => dev.refreshSources()} />
              </Row>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>
                Tip: start a Workout on the watch for heart rate every few seconds. If something is missing, open the Health app → Sharing → Apps → BeHeart and allow all categories.
              </Text>
            </View>
          ) : (
            <View>
              <Body>Your Apple Watch saves heart rate, HRV, sleep stages and activity into Apple Health. Connect it once and BeHeart reads it automatically.</Body>
              <Row style={{ marginTop: 12 }} gap={10}>
                <Button
                  title={busy ? 'Connecting…' : 'Connect Apple Watch (Apple Health)'}
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    setMsg(await connectHealthKit().catch((e) => `Could not connect: ${e?.message ?? e}`));
                    setBusy(false);
                    dev.refreshSources();
                  }}
                />
              </Row>
            </View>
          )}
        </Card>

        {/* ---------------------------------------------------------- Bluetooth */}
        <Card style={{ flex: 1 }} title="Bluetooth heart-rate devices" right={dev.bleAvailable ? <Text style={{ color: dev.bleState === 'on' ? C.accent : C.faint, fontSize: 12 }}>Bluetooth {dev.bleState}</Text> : undefined}>
          {!dev.bleAvailable ? (
            <Body>Bluetooth sensors connect in the iPhone app.</Body>
          ) : (
            <View>
              {dev.sensor ? (
                <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.cardAlt, marginBottom: 12 }}>
                  <Row style={{ alignItems: 'center' }} gap={10}>
                    <Text style={{ color: C.accent, fontSize: 18 }}>●</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{dev.sensor.name}</Text>
                      <Text style={{ color: C.faint, fontSize: 12 }}>
                        Connected{dev.sensor.battery != null ? ` · battery ${dev.sensor.battery}%` : ''} · reconnects automatically
                      </Text>
                    </View>
                  </Row>
                  <Row gap={8} style={{ marginTop: 10 }}>
                    <Button title="Disconnect" kind="ghost" small onPress={() => dev.disconnect(false)} />
                    <Button title="Forget device" kind="danger" small onPress={() => dev.disconnect(true)} />
                  </Row>
                </View>
              ) : data.watch?.bleDeviceId && data.watch.autoConnect ? (
                <Text style={{ color: C.sub, fontSize: 13, marginBottom: 10 }}>Looking for {data.watch.bleDeviceName}… (wake the device or turn on HR broadcast)</Text>
              ) : null}

              <Row gap={10} style={{ alignItems: 'center' }}>
                <Button title={dev.scanning ? 'Scanning…' : 'Scan for devices'} disabled={dev.scanning} onPress={() => dev.scan()} />
                {dev.scanning ? (
                  <>
                    <ActivityIndicator color={C.accent} />
                    <Button title="Stop" kind="ghost" small onPress={dev.stopScan} />
                  </>
                ) : null}
              </Row>
              {dev.error ? <Text style={{ color: C.recovery.yellow, fontSize: 13, marginTop: 10 }}>{dev.error}</Text> : null}

              {dev.found.filter((d) => d.id !== dev.sensor?.id).map((d) => (
                <Pressable key={d.id} onPress={() => dev.connect(d)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{d.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 12 }}>
                      {BRAND_LABEL[identifyBrand(d.name)] !== 'Other app' ? `${BRAND_LABEL[identifyBrand(d.name)]} · ` : ''}signal {signalBars(d.rssi)}
                    </Text>
                  </View>
                  {dev.connectingId === d.id ? <ActivityIndicator color={C.accent} /> : <Text style={{ color: C.accent, fontWeight: '700' }}>Connect</Text>}
                </Pressable>
              ))}
              {!dev.scanning && !dev.found.length && !dev.sensor ? (
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>Turn on heart-rate broadcast on your watch first (see below), then scan.</Text>
              ) : null}

              <Row style={{ alignItems: 'center', marginTop: 14, justifyContent: 'space-between' }}>
                <Text style={{ color: C.text, fontSize: 14 }}>Reconnect automatically</Text>
                <Switch
                  value={!!data.watch?.autoConnect}
                  onValueChange={(v) => update((d) => ({ ...d, watch: { ...(d.watch ?? {}), autoConnect: v } }))}
                  thumbColor={C.text}
                  trackColor={{ false: C.border, true: C.accent }}
                />
              </Row>
            </View>
          )}
        </Card>
      </Columns>

      <Columns style={{ alignItems: 'stretch', marginTop: 16 }}>
        <Card style={{ flex: 1 }} title="Live HR from Garmin, COROS, Polar, Amazfit, Huawei">
          {BROADCAST_TIPS.map((t) => (
            <Tip key={t.brand} brand={t.brand} how={t.how} />
          ))}
        </Card>
        <Card style={{ flex: 1 }} title="Daily data from other watches (via Apple Health)">
          <Body style={{ marginBottom: 8 }}>Sleep, HRV, resting HR and steps from other brands reach BeHeart when their app shares with Apple Health:</Body>
          {HEALTH_SYNC.map((t) => (
            <Tip key={t.brand} brand={t.brand} how={t.how} />
          ))}
        </Card>
      </Columns>

      {data.liveSessions?.length ? (
        <Card style={{ marginTop: 16 }} title="Recorded workouts">
          {data.liveSessions.slice(0, 15).map((s) => {
            const mins = Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000);
            return (
              <Row key={s.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center' }} gap={10}>
                <Text style={{ color: C.text, fontSize: 13, width: 70 }}>{shortLabel(s.start.slice(0, 10))}</Text>
                <Text style={{ color: C.sub, fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {s.source} · {durationLabel(mins)}
                </Text>
                <Text style={{ color: C.text, fontSize: 13 }}>
                  {s.avgHr} / <Text style={{ color: C.rhr }}>{s.maxHr}</Text> bpm
                </Text>
              </Row>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}

function SourceRow({ name, kinds, brand }: { name: string; kinds: string[]; brand: WatchBrand }) {
  const icon = brand === 'apple-watch' ? '⌚' : brand === 'iphone' ? '📱' : '◎';
  return (
    <Row style={{ alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }} gap={10}>
      <Text style={{ fontSize: 16, width: 24 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{name}</Text>
        <Text style={{ color: C.faint, fontSize: 11 }}>{kinds.join(' · ')}</Text>
      </View>
      {brand !== 'other' && brand !== 'iphone' ? <Pill text={BRAND_LABEL[brand]} color={C.accent} /> : null}
    </Row>
  );
}

function Tip({ brand, how }: { brand: string; how: string }) {
  return (
    <View style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{brand}</Text>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{how}</Text>
    </View>
  );
}

function signalBars(rssi: number): string {
  return rssi > -60 ? '▂▄▆█' : rssi > -72 ? '▂▄▆' : rssi > -85 ? '▂▄' : '▂';
}

function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s2 = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s2}` : `${m}:${s2}`;
}
