const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders || []).filter(
  (folder) => !/@clerk.*_tmp_/.test(folder),
);

const originalBlockList = config.resolver?.blockList;
const clerkTmpPattern = /@clerk.*_tmp_/;

if (Array.isArray(originalBlockList)) {
  config.resolver = {
    ...config.resolver,
    blockList: [...originalBlockList, clerkTmpPattern],
  };
} else if (originalBlockList) {
  config.resolver = {
    ...config.resolver,
    blockList: [originalBlockList, clerkTmpPattern],
  };
} else {
  config.resolver = {
    ...config.resolver,
    blockList: clerkTmpPattern,
  };
}

module.exports = config;
