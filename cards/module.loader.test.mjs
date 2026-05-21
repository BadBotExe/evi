import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./module.js', import.meta.url), 'utf8');

assert.match(
    source,
    /import \{ runWithGlobalShellLoader \} from '\.\.\/shell\/loading\/shellLoader\.js\?v=[0-9a-f]+';/,
    'cards module should import the shared shell loader helper'
);

assert.match(
    source,
    /await runWithGlobalShellLoader\(async \(\) => \{\s*const \[atlasManifest, response\] = await Promise\.all\(\[[\s\S]*?fetch\(resolveCardsDataUrl\(import\.meta\.url\)\)[\s\S]*?\]\);\s*DATA = await response\.json\(\);\s*normalizeCardsAssetPaths\(DATA, import\.meta\.url, atlasManifest\);[\s\S]*?\}\);/,
    'cards module should wrap heavy cards data loading in the shared loader'
);

console.log('cards/module.loader.test.mjs passed');
