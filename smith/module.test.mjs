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
    /<div class="smith-mobile-root">[\s\S]*?<div class="smith-mobile-panel-wrap">[\s\S]*?data-panel="item"[\s\S]*?data-panel="browse"[\s\S]*?<nav class="smith-mobile-tab-bar">/s,
    'smith module should render the mobile swipe layout with item and browse panels plus a bottom tab bar'
);

assert.match(
    source,
    /<div class="smith-section-label">Recipe<\/div>[\s\S]*?id="smith-recipe-empty">Recipe data has not been added yet\.<\/div>/s,
    'smith module should include a recipe empty-state message'
);

assert.match(
    source,
    /id="smith-smeltery-calc-toggle"[\s\S]*?aria-label="Open smeltery speed calculator">🧮<\/button>[\s\S]*?id="m-smith-smeltery-calc-toggle"[\s\S]*?aria-label="Open smeltery speed calculator">🧮<\/button>/s,
    'smith smeltery controls should expose the calculator toggle on desktop and mobile'
);

assert.match(
    source,
    /id="smith-smeltery-calc-popover"[\s\S]*?id="smith-smeltery-calc-item-input"[\s\S]*?id="smith-smeltery-calc-hours-input"[\s\S]*?id="smith-smeltery-calc-minutes-input"[\s\S]*?id="smith-smeltery-calc-seconds-input"[\s\S]*?id="smith-smeltery-calc-apply">Calculate<\/button>/s,
    'smith module should render the desktop smeltery calculator popover with item selection and hh mm ss inputs'
);

assert.match(
    source,
    /id="smith-smeltery-calc-overlay"[\s\S]*?id="smith-smeltery-calc-sheet"[\s\S]*?id="m-smith-smeltery-calc-item-input"[\s\S]*?id="m-smith-smeltery-calc-hours-input"[\s\S]*?id="m-smith-smeltery-calc-minutes-input"[\s\S]*?id="m-smith-smeltery-calc-seconds-input"[\s\S]*?id="m-smith-smeltery-calc-apply">Calculate<\/button>/s,
    'smith module should render the mobile smeltery calculator sheet with the shared drawer pattern'
);

assert.match(
    source,
    /import \{ buildFlattenedSmithRecipeRows \} from '\.\/app\/recipeTree\.js\?v=[0-9a-f]+';/,
    'smith module should import the smith recipe tree helper'
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
    /let expandedRecipePaths = new Set\(\);[\s\S]*?function resetRecipeExpansion\(\) \{[\s\S]*?expandedRecipePaths = new Set\(\);[\s\S]*?\}/,
    'smith module should keep recipe expansion state separately from route state'
);

assert.match(
    source,
    /buildSmithMobileBrowseSections/,
    'smith module should use dedicated mobile browse section builders'
);

assert.match(
    source,
    /function createGridCell\(entry\) \{[\s\S]*?button\.className = `smith-cell\$\{entry\.isSelected \? ' is-selected' : ''\}`;[\s\S]*?return button;[\s\S]*?\}/,
    'smith module should render each smith item as a standalone auto-grid cell'
);

assert.match(
    source,
    /buildSmithGridEntries\(tab, DATA\.itemsById, selectedItemId\)\.forEach\(entry => \{[\s\S]*?grid\.appendChild\(createGridCell\(entry\)\);[\s\S]*?\}\);/,
    'smith grid should append flat cells directly so CSS can fit as many items per row as available'
);

assert.match(
    source,
    /const ingredients = buildFlattenedSmithRecipeRows\(\{[\s\S]*?expandedPaths: expandedRecipePaths[\s\S]*?\}\);/,
    'smith recipe rendering should build visible rows from the reusable flattened recipe tree model'
);

assert.match(
    source,
    /if \(entry\.canExpand\) \{[\s\S]*?const badge = document\.createElement\('button'\);[\s\S]*?badge\.className = 'smith-subrecipe-badge';[\s\S]*?badgeCount\.textContent = String\(DATA\?\.recipesByItemId\?\.\[entry\.item_id\]\?\.ingredients\?\.length \?\? 0\);[\s\S]*?badgeLabel\.textContent = 'sub';[\s\S]*?chevron\.className = `smith-subrecipe-badge-chevron\$\{entry\.isExpanded \? '' : ' collapsed'\}`;/,
    'smith recipe rows should render an inline subrecipe badge before the quantity for craftable ingredients'
);

assert.match(
    source,
    /ingredient\.className = `smith-ingredient\$\{entry\.canExpand \? ' is-craftable' : ''\}\$\{entry\.isExpanded \? ' is-expanded' : ''\}`;[\s\S]*?ingredient\.style\.setProperty\('--smith-recipe-depth', String\(entry\.depth\)\);/,
    'smith recipe rows should encode craftable state and nesting depth for tree styling'
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
    /const nextState = \{\s*act: selectedActId,\s*item: selectedItemId,\s*tab: isMobile\(\) \? currentTab : '',\s*speed: isSelectedSmelteryItem\(\) \? smelterySpeed : '',\s*gemshop: isSelectedSmelteryItem\(\) \? smelteryGemshopLevel : ''\s*\};/,
    'smith module should persist act, item, tab, smeltery speed, and gemshop tier in route state when needed'
);

assert.match(
    source,
    /function isSelectedSmelteryItem\(\) \{[\s\S]*?return DATA\?\.smelteryItemIds\?\.has\(selectedItemId\) \?\? false;[\s\S]*?\}/,
    'smith module should detect smeltery items from the merged dataset'
);

assert.match(
    source,
    /const timingRows = isSelectedSmelteryItem\(\) && recipe\?\.base_time[\s\S]*?renderStatsTable\(statsTableId, isSelectedSmelteryItem\(\) \? timingRows : \(gear\?\.stats \?\? \[\]\)\);/,
    'smith detail panel should switch between smith stats and smeltery timing rows by selected item type'
);

assert.match(
    source,
    /selectedActId = resolveSelectedSmithActId\(DATA, tab\.id\);[\s\S]*?selectedItemId = resolveSelectedSmithItemId\(DATA, selectedItemId, selectedActId\);/,
    'smith tab switching should preserve the selected item when it still exists in the merged dataset'
);

assert.match(
    source,
    /function updateSmelterySpeed\(rawValue\) \{[\s\S]*?smelterySpeed = normalizeSmelterySpeed\(rawValue\);[\s\S]*?renderDetail\(\);[\s\S]*?updateHostRouteState\(\);[\s\S]*?\}/,
    'smith module should recalculate smeltery detail timing when the speed input changes'
);

assert.match(
    source,
    /function applySmelteryCalculator\(\) \{[\s\S]*?const gemshopMultiplier = calculateSmelteryGemshopMultiplier\([\s\S]*?parseSmelteryMeasuredDuration\([\s\S]*?calculateSmelterySpeedFromMeasuredSeconds\([\s\S]*?recipe\?\.base_time,[\s\S]*?measuredSeconds,[\s\S]*?gemshopMultiplier[\s\S]*?\)[\s\S]*?closeSmelteryCalculator\(\);[\s\S]*?renderDetail\(\);[\s\S]*?updateHostRouteState\(\);[\s\S]*?\}/,
    'smith module should calculate smeltery speed from the selected item timing relative to the chosen gemshop tier and write only the remaining percent speed'
);

assert.match(
    source,
    /makeDraggable\(popover, popover\.querySelector\('\.smith-smeltery-calc-popover-header'\), null\);[\s\S]*?popover\.querySelector\('\.smith-smeltery-calc-popover-header'\)\?\.addEventListener\('mousedown', event => \{[\s\S]*?popover\.dataset\.dragged = 'true';[\s\S]*?\}\);/,
    'smith calculator popover should become draggable from its header on desktop'
);

assert.match(
    source,
    /function switchTab\(tab\) \{[\s\S]*?syncMobilePanelPosition\(currentTab, 'smooth'\);[\s\S]*?\}/,
    'smith module should sync mobile panel scrolling when switching tabs'
);

assert.match(
    source,
    /function initMobileSwipe\(\) \{[\s\S]*?wrap\.addEventListener\('scroll', \(\) => \{[\s\S]*?Math\.round\(wrap\.scrollLeft \/ \(wrap\.clientWidth \|\| 1\)\)/,
    'smith module should detect swipe-based tab changes from the mobile panel container'
);

assert.match(
    source,
    /button\.addEventListener\('click', \(\) => \{[\s\S]*?selectedActId = actId;[\s\S]*?selectedItemId = entry\.item\.id;[\s\S]*?renderAll\(\);[\s\S]*?switchTab\('item'\);[\s\S]*?\}\);/,
    'smith mobile browse item selection should update the item and switch to the item tab'
);

assert.match(
    source,
    /return \{\s*updateRouteState\(nextState\) \{[\s\S]*?restoreRoute\(\) \{[\s\S]*?refresh\(\) \{/,
    'smith mount API should expose route updates, route restore, and refresh'
);

console.log('smith/module.test.mjs passed');
