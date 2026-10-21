const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, '../../shared') + path.sep;
// Shared NodeNext contracts refer to their emitted .js names; Metro consumes TS source.
config.resolver.resolveRequest = (context, name, platform) =>
  context.resolveRequest(
    context,
    context.originModulePath.startsWith(sharedRoot) &&
      name.startsWith('.') &&
      name.endsWith('.js')
      ? name.slice(0, -3)
      : name,
    platform,
  );
module.exports = config;
