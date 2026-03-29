const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = path.resolve(__dirname);
const monorepoRoot = path.resolve(__dirname, '..');

const config = getDefaultConfig(__dirname);

// projectRoot = mobile/ for module resolution (finds App.tsx, src/*, etc.)
config.projectRoot = projectRoot;

// serverRoot = monorepo root, because Expo Go requests /mobile/App.tsx.bundle
// (it prepends the app's subdirectory relative to the workspace root)
config.server.unstable_serverRoot = monorepoRoot;

module.exports = config;
