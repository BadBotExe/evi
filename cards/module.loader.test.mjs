import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./module.js', import.meta.url), 'utf8');

assert.match(
    source,
    /import \{\s*loadCardsData\s*\} from '\.\/app\/cardsDataLoader\.js\?v=[0-9a-f]+';/,
    'cards module should import the cards data loader adapter'
);

assert.match(
    source,
    /import \{ runWithGlobalShellLoader \} from '\.\.\/shell\/loading\/shellLoader\.js\?v=[0-9a-f]+';/,
    'cards module should import the shared shell loader helper'
);

assert.match(
    source,
    /await runWithGlobalShellLoader\(async \(\) => \{\s*const \[atlasManifest, cardsData\] = await Promise\.all\(\[[\s\S]*?loadCardsData\(\{\s*fetchImpl: fetch,\s*moduleUrl: import\.meta\.url\s*\}\)[\s\S]*?\]\);\s*DATA = cardsData;\s*normalizeCardsAssetPaths\(DATA, import\.meta\.url, atlasManifest\);[\s\S]*?\}\);/,
    'cards module should wrap atlas and merged cards data loading in the shared loader'
);

console.log('cards/module.loader.test.mjs passed');
