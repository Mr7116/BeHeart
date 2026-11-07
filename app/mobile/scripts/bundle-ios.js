// Builds the iPhone JavaScript bundle with Metro (same bundler Xcode/EAS use) to prove that
// every screen and library resolves for iOS. Output: build-ios/main.jsbundle
const path = require('path');
const fs = require('fs');
const Metro = require('metro');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  process.env.NODE_ENV = 'production';
  process.env.EXPO_NO_TELEMETRY = '1';
  const config = await Metro.loadConfig({ cwd: projectRoot, config: path.join(projectRoot, 'metro.config.js') });
  const outDir = path.join(projectRoot, 'build-ios');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'main.jsbundle');
  const result = await Metro.runBuild(config, {
    entry: path.join(projectRoot, 'index.ts'),
    out,
    platform: 'ios',
    dev: false,
    minify: false,
    sourceMap: false,
  });
  if (!fs.existsSync(out) && result && typeof result.code === 'string') fs.writeFileSync(out, result.code);
  console.log(`iOS bundle written: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
