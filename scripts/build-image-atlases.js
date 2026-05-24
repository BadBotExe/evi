#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAtlasArtifacts, writeJsonFile } from './lib/image-atlas.js';
import { loadImageAtlasBuildConfig } from './lib/build-config.js';

export async function main() {
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
    results.push(await buildAtlasArtifacts(target.id, target.imagesDir, manifestDir));
  }

  const atlasMaps = results.map(result => result.manifest.atlases ?? {});
  const entryMaps = results.map(result => result.manifest.entries ?? {});
  const mergedManifest = {
    version: 1,
    atlases: Object.assign({}, ...atlasMaps),
    entries: Object.assign({}, ...entryMaps),
  };

  writeJsonFile(manifestPath, mergedManifest);

  console.log(`Generated ${Object.keys(mergedManifest.atlases).length} atlases.`);
}

function isDirectRun() {
  return Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectRun()) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
