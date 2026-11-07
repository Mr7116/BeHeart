# BeHeart — สร้างไฟล์ .ipa สำหรับ iPhone (ใช้ Windows ได้ ไม่ต้องมี Mac)

แอปเขียนด้วย **TypeScript + React Native (Expo SDK 58)** ใช้โค้ดหน้าจอและสูตรคำนวณชุดเดียวกับแอปเดสก์ท็อปใน `../src`

## สิ่งที่แอป iPhone เชื่อมต่อได้

| อุปกรณ์ | วิธีเชื่อม | ได้ข้อมูลอะไร |
| --- | --- | --- |
| **Apple Watch** | ผ่าน Apple Health (HealthKit) — กด *Connect Apple Watch* ครั้งเดียว | HR, Resting HR, HRV, การหายใจ, Sleep stages, ก้าว, แคลอรี่ — อ่านอัตโนมัติทุกครั้งที่นาฬิกาซิงก์ (แม้แอปปิดอยู่ iOS จะปลุกแอปมาอ่าน) + **HR สด** ระหว่างออกกำลังกาย |
| **Garmin, COROS, Polar, Amazfit, Huawei, Xiaomi, สายคาดอก (Polar H10, Wahoo TICKR, Garmin HRM…)** | **Bluetooth** มาตรฐาน Heart Rate Service (0x180D) — เปิด *HR broadcast* บนนาฬิกา แล้วกด *Scan* ในแอป | **HR สดทุกวินาที**, RR interval, แบตเตอรี่, บันทึก workout → นับ zone minutes เข้า Strain ของวัน, ต่อใหม่อัตโนมัติ |
| **Garmin / Huawei / Zepp / Mi Fitness / Polar / COROS / Oura / WHOOP** | ให้แอปของแบรนด์ซิงก์เข้า Apple Health | การนอน, HRV, RHR, ก้าว — แอปแสดงรายชื่อแหล่งข้อมูลที่ตรวจพบในหน้า *Watch & Sensors* |

หน้าใหม่: **More → Watch & Sensors** และการ์ด ♥ HR สดบนหน้า Today

## ทางที่ 1 — GitHub Actions (ฟรี, ได้ไฟล์ .ipa, ไม่ต้องมี Mac)

1. อัปโหลดโฟลเดอร์ `BeHeart` ขึ้น GitHub repo (มีไฟล์ `.github/workflows/ios-ipa.yml` ให้แล้ว)
2. GitHub → แท็บ **Actions** → **Build iOS app (.ipa)** → **Run workflow** (ใช้เวลา ~20–30 นาที)
3. ดาวน์โหลด **BeHeart-unsigned-ipa** จาก Artifacts
4. ติดตั้งลง iPhone บน Windows ด้วย **Sideloadly** (หรือ AltStore) → ลงชื่อด้วย Apple ID ของคุณ
   - iPhone: Settings → Privacy & Security → **Developer Mode** → On
   - Settings → General → VPN & Device Management → Trust Apple ID ของคุณ
   - Apple ID ฟรี: ต้องติดตั้งซ้ำทุก **7 วัน**, และบางบัญชีฟรีอาจไม่รองรับ entitlement *HealthKit background delivery* (แอปยังอ่าน Apple Health ได้ตอนเปิดแอป)

**อยากได้ .ipa ที่เซ็นแล้ว (ติดตั้งตรง / TestFlight)** — ต้องมี Apple Developer Program (99 USD/ปี) แล้วใส่ Secrets ใน repo:
`IOS_P12_BASE64`, `IOS_P12_PASSWORD`, `IOS_PROFILE_BASE64`, `IOS_TEAM_ID`, (`IOS_EXPORT_METHOD` = `release-testing` หรือ `app-store-connect`)
workflow จะสร้าง **BeHeart-signed-ipa** ให้เพิ่มอัตโนมัติ

## ทางที่ 2 — EAS Build (คลาวด์ของ Expo, ง่ายสุดถ้ามี Apple Developer)

```bash
cd app/mobile
npm install
npx eas-cli login
npx eas-cli build -p ios --profile preview      # .ipa แบบ Ad Hoc ติดตั้งผ่านลิงก์/QR
npx eas-cli build -p ios --profile production   # .ipa สำหรับ TestFlight / App Store
npx eas-cli submit -p ios                       # ส่งขึ้น TestFlight
```
EAS จะสร้าง certificate / provisioning profile ให้เอง (ต้องลงทะเบียน UDID ของ iPhone สำหรับ preview: `npx eas-cli device:create`)

## ทางที่ 3 — มี Mac + Xcode

```bash
cd app/mobile && npm install
npx expo run:ios --device --configuration Release
```

## ตรวจสอบบน Windows ก่อน build

```bash
cd app/mobile
npm install
npm run typecheck          # ตรวจ type ทั้งหมด
node scripts/bundle-ios.js # สร้าง iOS JS bundle (ต้องผ่านก่อนส่ง build)
cd .. && npm test          # self-test สูตรคำนวณ + ตัวแปลง Bluetooth HR
```

> Expo Go ใช้ทดลอง UI ได้ แต่ **ไม่มี** HealthKit และ Bluetooth — การเชื่อมนาฬิกาต้องใช้ .ipa จริง
