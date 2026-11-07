// Packages the bundled app into a stand-alone folder with BeHeart.exe (dist/BeHeart-<platform>-<arch>).
import { packager } from '@electron/packager';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const paths = await packager({
  dir: root,
  out: join(root, 'dist'),
  name: 'BeHeart',
  overwrite: true,
  asar: true,
  prune: true,
  // Only the bundled build/ folder and package.json are needed at run time.
  ignore: [/^\/(src|scripts|static|shots|dist|mobile|tsconfig\.json|README\.md)(\/|$)/, /^\/node_modules(\/|$)/],
});
console.log('Packaged into', paths.join(', '));
