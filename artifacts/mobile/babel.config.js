module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true }],
    ],
    plugins: [
      require.resolve("expo-router/babel"),
    ],
  };
};
