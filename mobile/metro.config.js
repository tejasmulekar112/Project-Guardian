const { getDefaultConfig } = require('expo/metro-config');

// Prevent Expo from using the monorepo root as Metro's server root.
// Without this, the workspace root becomes the server root and Gradle's
// --entry-file index.js (relative to mobile/) fails to resolve.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const config = getDefaultConfig(__dirname);

module.exports = config;
