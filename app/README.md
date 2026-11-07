# BeHeart — health & fitness analytics (desktop)

TypeScript + React Native. The React Native components are rendered on the desktop through
react-native-web inside an Electron window; charts use react-native-svg. No AI: every score is a fixed formula.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run build` | Type-check and bundle into `build/` |
| `npm test` | Self-test of the scoring formulas and the Apple Health parser |
| `npm start` | Open the app |
| `npx electron . --screenshot shots/now.png` | Start, render ~120 frames, save a PNG and exit |
| `npm run package` | Make a stand-alone `dist/BeHeart-win32-x64/BeHeart.exe` |

Extra start-up flags: `--screen <today|trends|sleep|cardio|workouts|nutrition|health|premium|profile>` opens a screen,
`--premium` previews Premium. Screenshot runs use a temporary data folder, so they never touch saved data.

## iPhone app (`mobile/`)

The same screens and formulas run on iPhone through Expo (React Native). The iPhone build adds what a
computer can't do: **live Apple Health reading** (HealthKit: heart rate, RHR, HRV, respiratory rate, steps,
active energy, sleep stages — on open and every 15 min) and **camera barcode scanning**. Phones get a bottom
tab bar and single-column layout; data stays on the phone.

| Command (inside `mobile/`) | What it does |
| --- | --- |
| `npm install` | Install the iPhone dependencies |
| `npm run typecheck` | Type-check the shared code against React Native / HealthKit / camera types |
| `node scripts/bundle-ios.js` | Build the iOS JavaScript bundle (works on Windows) |
| `npx expo start` | Try it on an iPhone with the Expo Go app (sample data + camera; Apple Health needs the full build) |
| `npx eas-cli build -p ios --profile preview` | Signed .ipa with Apple Health + Bluetooth — needs an Apple Developer account (no Mac required) |
| GitHub → Actions → *Build iOS app (.ipa)* | Unsigned .ipa built on a GitHub Mac (sideload with Sideloadly/AltStore); signed too when signing secrets are set |
| `npx expo run:ios` | Full build on a Mac with Xcode |

**Watch & Sensors** (More → Watch & Sensors, plus a live ♥ strip on Today):
- **Apple Watch** through HealthKit — daily data, HealthKit observer queries + background delivery so new watch data is read as soon as it syncs, and live heart rate (every few seconds during a watch workout).
- **Bluetooth heart-rate devices** (standard Heart Rate service 0x180D: Garmin/COROS/Polar/Amazfit/Huawei in HR-broadcast mode, chest straps) via `react-native-ble-manager` — second-by-second HR, RR intervals, battery, auto-reconnect, background (`bluetooth-central`), and workout recording whose zone minutes feed Strain.
- Other brands' daily data via their Apple Health sync; the screen lists every source found in Apple Health.

Step-by-step build guide (Thai): `mobile/BUILD-IOS.th.md`.

Platform-specific files use the `.native.ts(x)` suffix (`bridge.native.ts`, `BarcodeScanner.native.tsx`,
`SafeArea.native.tsx`); the desktop build ignores them. `npx electron . --window 390x844` previews the phone layout on the desktop.

## Layout

- `src/core/` — data model and deterministic formulas (recovery, strain, sleep, VO₂max, volume, fatigue, macros), sample "demo wearable" data, Apple Health `export.xml` parser.
- `src/main/` — Electron main process: window, local JSON storage, file import, OpenFoodFacts lookups, `--screenshot`.
- `src/renderer/` — React Native screens and components.

## Formulas

- **Recovery** = 50 % HRV z-score + 25 % resting-HR z-score (vs. your previous 30 days, mapped through the normal curve) + 25 % sleep performance, minus a penalty when respiratory rate is > 1 SD above normal.
- **Strain** (0–21) = 21 × (1 − e^(−load/220)), load = Σ zone minutes × zone number (TRIMP) + 5 % of active kcal.
- **Sleep score** (0–100) = duration vs. need (50) + deep 13–23 % (15) + REM 20–25 % (15) + efficiency (10) + bedtime consistency (10).
- **Muscle fatigue** = session volume decaying with a 1.5-day time constant ÷ 28-day average load.
- **Calories** = Mifflin–St Jeor BMR × activity factor ± goal; protein 1.8–2.2 g/kg, fat 27 %, carbs the rest.
