process.env.EXPO_ROUTER_APP_ROOT = "./app";
process.env.EXPO_ROUTER_IMPORT_MODE = "lazy";

module.exports = function (api) {
  api.cache(true);

  // Hardcode router root for EAS/CI environments to avoid relying on
  // process.env at build time which can cause SyntaxError during bundling.
  process.env.EXPO_ROUTER_APP_ROOT = './app';

  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [["transform-inline-environment-variables", { include: ["EXPO_ROUTER_APP_ROOT", "EXPO_ROUTER_IMPORT_MODE"] }]],
  };
};
