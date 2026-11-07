// Builds the iPhone JavaScript bundle exactly the way Xcode's "Bundle React Native code and images"
// phase does (expo export:embed), so bundling problems show up here before a 15-minute cloud build.
// Output: build-ios/main.jsbundle
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'build-ios');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'main.jsbundle');
const r = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['expo', 'export:embed', '--platform', 'ios', '--dev', 'false', '--entry-file', 'index.ts', '--bundle-output', out, '--assets-dest', outDir, '--reset-cache'],
  { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } },
);
if (r.status !== 0 || !fs.existsSync(out)) {
  console.error('iOS bundle FAILED');
  process.exit(r.status || 1);
}
console.log(`iOS bundle written: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
