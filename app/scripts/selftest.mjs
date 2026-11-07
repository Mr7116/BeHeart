import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'build'), { recursive: true });
const out = join(root, 'build', 'selftest.cjs');
await build({ entryPoints: [join(root, 'src/core/selftest.ts')], outfile: out, bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning' });
execFileSync(process.execPath, [out], { stdio: 'inherit' });
