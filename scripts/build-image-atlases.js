#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const atlas = require('./lib/image-atlas.js');

const repoRoot = process.cwd();
const bonusesDir = path.join(repoRoot, 'bonuses');
const itemsDir = path.join(repoRoot, 'items');
const bonusesImagesDir = path.join(bonusesDir, 'images');
const itemsImagesDir = path.join(itemsDir, 'images');
const generatedDir = path.join(bonusesDir, 'generated');
const manifestPath = path.join(generatedDir, 'image-atlas-manifest.json');

async function main() {
  if (!fs.existsSync(bonusesImagesDir) || !fs.existsSync(itemsImagesDir)) {
    console.error('Missing bonuses/images or items/images directory.');
    process.exit(1);
  }

  fs.mkdirSync(generatedDir, { recursive: true });

  const bonusResult = await atlas.buildAtlasArtifacts('bonuses', bonusesImagesDir, generatedDir);
  const itemResult = await atlas.buildAtlasArtifacts('items', itemsImagesDir, generatedDir);

  const mergedManifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    atlases: {
      ...(bonusResult.manifest.atlases ?? {}),
      ...(itemResult.manifest.atlases ?? {}),
    },
    entries: {
      ...(bonusResult.manifest.entries ?? {}),
      ...(itemResult.manifest.entries ?? {}),
    },
  };

  atlas.writeJsonFile(manifestPath, mergedManifest);

  console.log(`Generated ${Object.keys(mergedManifest.atlases).length} atlases.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
