const path = require("path");

module.exports = function (api) {
  const platform = process.env.EXPO_OS ?? process.env.EXPO_PLATFORM;
  const isWeb = platform === "web";

  api.cache.using(() => platform ?? "native");

  process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, "app");
  process.env.EXPO_ROUTER_IMPORT_MODE = isWeb ? "lazy" : "eager";

  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        "transform-inline-environment-variables",
        { include: ["EXPO_ROUTER_APP_ROOT", "EXPO_ROUTER_IMPORT_MODE"] },
      ],
    ],
  };
};
