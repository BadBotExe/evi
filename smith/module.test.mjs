import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./module.js', import.meta.url), 'utf8');

assert.match(
    source,
    /<div class="smith-page">[\s\S]*?<aside class="smith-sidebar-left">[\s\S]*?<div class="smith-detail-panel">[\s\S]*?<main class="smith-content-center smith-browser-panel">/s,
    'smith module should render the shared left-wrapper plus two-panel layout'
);

assert.match(
    source,
    /<div class="smith-section-label">Recipe<\/div>[\s\S]*?id="smith-recipe-empty">Recipe data has not been added yet\.<\/div>/s,
    'smith module should include a recipe empty-state message'
);

assert.match(
    source,
    /selectedActId = resolveSelectedSmithActId\(DATA, routeState\.act \|\| DATA\.default_act_id\);/,
    'smith module should normalize the selected act through the browser model'
);

assert.match(
    source,
    /selectedItemId = resolveSelectedSmithItemId\(DATA, routeState\.item, selectedActId\);/,
    'smith module should normalize the selected item through the browser model'
);

assert.match(
    source,
    /selectedItemId = resolveSelectedSmithItemId\(DATA, selectedItemId, selectedActId\);/,
    'smith module should preserve the selected item when switching tabs'
);

assert.match(
    source,
    /row\.style\.setProperty\('--smith-grid-columns', String\(Math\.max\(1, rowEntries\.length \|\| Number\(itemsPerRow\) \|\| 1\)\)\);/,
    'smith grid rows should size columns to the actual row entry count to avoid empty tracks'
);

assert.match(
    source,
    /import \{ isAtlasImageAsset \} from '\.\.\/shell\/lib\/imageAtlas\.js\?v=[0-9a-f]+';/,
    'smith module should import atlas image detection helper'
);

assert.match(
    source,
    /function createAssetNode\(asset, alt, className\) \{[\s\S]*?if \(isAtlasImageAsset\(asset\)\) \{[\s\S]*?return createAtlasSprite\(asset, alt, className\);[\s\S]*?\}[\s\S]*?return createImage\(asset, alt, className\);[\s\S]*?\}/,
    'smith module should render atlas-backed icons through the atlas sprite path'
);

assert.match(
    source,
    /function createAtlasSprite\(asset, alt, className\) \{[\s\S]*?clipPathId = `smith-atlas-sprite-clip-\$\{atlasSpriteClipPathSequence\+\+\}`[\s\S]*?image\.setAttribute\('x', String\(-asset\.x\)\);[\s\S]*?image\.setAttribute\('y', String\(-asset\.y\)\);[\s\S]*?image\.setAttribute\('image-rendering', 'pixelated'\);/,
    'smith atlas sprite renderer should clip and offset the atlas sheet to the target icon'
);

assert.match(
    source,
    /const nextState = \{\s*act: selectedActId,\s*item: selectedItemId\s*\};/,
    'smith module should persist act and item in route state'
);

assert.match(
    source,
    /return \{\s*updateRouteState\(nextState\) \{[\s\S]*?restoreRoute\(\) \{[\s\S]*?refresh\(\) \{/,
    'smith mount API should expose route updates, route restore, and refresh'
);

console.log('smith/module.test.mjs passed');
