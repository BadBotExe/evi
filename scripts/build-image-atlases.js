#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const atlas = require('./lib/image-atlas.js');
const { loadImageAtlasBuildConfig } = require('./lib/build-config.js');

async function main() {
  const { manifestDir, manifestPath, targets } = loadImageAtlasBuildConfig(process.cwd());

  if (!targets.length) {
    console.error('No image atlas targets configured.');
    process.exit(1);
  }

  const missingTarget = targets.find(target => !fs.existsSync(target.imagesDir));
  if (missingTarget) {
    console.error(`Missing image atlas directory: ${path.relative(process.cwd(), missingTarget.imagesDir)}`);
    process.exit(1);
  }

  fs.mkdirSync(manifestDir, { recursive: true });

  const results = [];
  for (const target of targets) {
    results.push(await atlas.buildAtlasArtifacts(target.id, target.imagesDir, manifestDir));
  }

  const atlasMaps = results.map(result => result.manifest.atlases ?? {});
  const entryMaps = results.map(result => result.manifest.entries ?? {});
  const mergedManifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    atlases: Object.assign({}, ...atlasMaps),
    entries: Object.assign({}, ...entryMaps),
  };

  atlas.writeJsonFile(manifestPath, mergedManifest);

  console.log(`Generated ${Object.keys(mergedManifest.atlases).length} atlases.`);
}

module.exports = {
  main,
};

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
