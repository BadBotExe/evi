const fs = require('node:fs');
const path = require('node:path');

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function loadBuildConfig(repoRoot = process.cwd()) {
  const configPath = path.join(repoRoot, 'scripts', 'build-config.json');
  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content);
}

function loadCacheStampBuildConfig(repoRoot = process.cwd()) {
  const config = loadBuildConfig(repoRoot);
  const cacheStamp = config?.cacheStamp ?? {};

  return {
    repoRoot,
    managedRoots: (cacheStamp.roots ?? []).map(relativePath => path.join(repoRoot, relativePath)),
    managedFiles: (cacheStamp.files ?? []).map(relativePath => path.join(repoRoot, relativePath)),
    excludedFiles: new Set((cacheStamp.excludeFiles ?? []).map(relativePath => toPosix(relativePath))),
    excludedSuffixes: [...(cacheStamp.excludeSuffixes ?? [])],
  };
}

function loadImageAtlasBuildConfig(repoRoot = process.cwd()) {
  const config = loadBuildConfig(repoRoot);
  const imageAtlases = config?.imageAtlases ?? {};
  const manifestPath = path.join(repoRoot, imageAtlases.manifestPath ?? '');

  return {
    repoRoot,
    manifestPath,
    manifestDir: path.dirname(manifestPath),
    targets: (imageAtlases.targets ?? []).map(target => ({
      id: target.id,
      imagesDir: path.join(repoRoot, target.imagesDir),
    })),
  };
}

module.exports = {
  loadBuildConfig,
  loadCacheStampBuildConfig,
  loadImageAtlasBuildConfig,
};
