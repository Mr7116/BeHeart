// Bundles the Electron main/preload scripts and the React Native (web) renderer with esbuild.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build');
mkdirSync(out, { recursive: true });

const prod = process.env.NODE_ENV !== 'development';

await build({
  entryPoints: [join(root, 'src/main/main.ts')],
  outfile: join(out, 'main.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'warning',
});

await build({
  entryPoints: [join(root, 'src/main/preload.ts')],
  outfile: join(out, 'preload.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'warning',
});

await build({
  entryPoints: [join(root, 'src/renderer/index.tsx')],
  outfile: join(out, 'renderer.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  minify: prod,
  // React Native components are rendered on the desktop through react-native-web.
  alias: {
    'react-native': 'react-native-web',
    '@react-native/assets-registry/registry': join(root, 'src/shims/assetRegistry.ts'),
    buffer: join(root, 'src/shims/buffer.ts'),
  },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  mainFields: ['browser', 'module', 'main'],
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
    __DEV__: JSON.stringify(!prod),
    global: 'globalThis',
  },
  logLevel: 'warning',
});

copyFileSync(join(root, 'static/index.html'), join(out, 'index.html'));
console.log('Bundled into build/');
