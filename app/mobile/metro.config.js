// Metro bundler config for the iPhone build. The shared TypeScript sources live in ../src,
// next to the desktop app's own node_modules; packages imported from there must resolve from
// this folder's node_modules (React Native, not the desktop's react-native-web).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'src');
const entry = path.join(projectRoot, 'index.ts');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];

const isBare = (name) => !name.startsWith('.') && !path.isAbsolute(name);
const inShared = (file) => path.resolve(file).toLowerCase().startsWith(sharedRoot.toLowerCase());

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isBare(moduleName) && inShared(context.originModulePath)) {
    return context.resolveRequest({ ...context, originModulePath: entry }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
