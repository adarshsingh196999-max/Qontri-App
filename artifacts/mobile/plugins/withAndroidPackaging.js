const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withAndroidPackaging(config) {
  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;

    const packagingBlock = `
    packaging {
        resources {
            pickFirsts += [
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/INDEX.LIST"
            ]
            excludes += [
                "META-INF/*.kotlin_module",
                "META-INF/AL2.0",
                "META-INF/LGPL2.1"
            ]
        }
    }
`;

    if (gradle.includes("packaging {")) {
      return mod;
    }

    mod.modResults.contents = gradle.replace(
      /^android\s*\{/m,
      `android {\n${packagingBlock}`
    );

    return mod;
  });
};
