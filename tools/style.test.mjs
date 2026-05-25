import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s*\{[\s\S]*?background:\s*var\(--bg-row\);[\s\S]*?\}/s,
    'tools mobile layout should keep the repo mobile browser background'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.section-header,\s*[\s\S]*?\.engineering-planner-header-actions\s+\.engineering-planner-help-btn\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}/s,
    'tools mobile layout should hide local panel headers and panel help buttons'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card,\s*[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-per-item-card\s*\{[\s\S]*?padding:\s*0;[\s\S]*?border:\s*none;[\s\S]*?background:\s*transparent;[\s\S]*?\}/s,
    'tools mobile layout should flatten local panel chrome'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-per-item-tree\s*\{[\s\S]*?padding-bottom:\s*12px;[\s\S]*?border-bottom:\s*1px solid var\(--border\);[\s\S]*?\}/s,
    'tools mobile per-item smith sections should end expanded trees with a divider before the next item header'
);

assert.match(
    source,
    /#shell-mobile-inline-actions\.tools-shell-inline-actions-visible\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?\}[\s\S]*?\.tools-shell-help-btn\s*\{[\s\S]*?font-size:\s*1rem;[\s\S]*?font-weight:\s*800;[\s\S]*?\}/s,
    'tools should expose a dedicated shell-header help action style for the mobile planner help button'
);

assert.doesNotMatch(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.layout\.calc-view\s*\{[\s\S]*?display:\s*grid\s*!important;/s,
    'tools mobile layout should not restore the desktop calc grid just to keep the page visible'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*1120px\)\s*\{[\s\S]*?\.tools-results-table\s+\.tools-inline-action\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}/s,
    'tools intermediate desktop layout should hide min and max shortcuts before the table reaches the mobile breakpoints'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*1120px\)\s*\{[\s\S]*?\.tools-results-table\s+th\.tools-owned-col-head\s*\{[\s\S]*?text-align:\s*right\s*!important;[\s\S]*?\}/s,
    'tools intermediate desktop layout should right-align the Owned header once min and max shortcuts are hidden'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*1120px\)\s*\{[\s\S]*?\.tools-results-table\s+\.tools-needed-col\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}/s,
    'tools intermediate desktop layout should hide the Needed column together with the min and max shortcuts'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-selected-table\s+th,\s*[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-results-table\s+td\s*\{[\s\S]*?padding-left:\s*5px;[\s\S]*?padding-right:\s*5px;[\s\S]*?\}[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-selected-table\s+th:first-child,\s*[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-results-table\s+td:first-child\s*\{[\s\S]*?padding-left:\s*0;[\s\S]*?\}[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-selected-table\s+th:last-child,\s*[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-results-table\s+td:last-child\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?\}/s,
    'tools mobile smith result tables should halve horizontal cell padding and remove the outer horizontal padding'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-results-table\s+th\.tools-percent-col,\s*[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-result-card\s+\.tools-results-table\s+td\.tools-percent-col\s*\{[\s\S]*?width:\s*53px;[\s\S]*?min-width:\s*53px;[\s\S]*?max-width:\s*53px;[\s\S]*?\}/s,
    'tools mobile smith percent column should stay sized to the badge content instead of inheriting the wider numeric column width'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.mobile-item-browser\s+\.tools-compact-value\s*\{[\s\S]*?text-decoration:\s*underline;[\s\S]*?text-decoration-style:\s*dotted;[\s\S]*?\}[\s\S]*?\.tools-value-sheet-card\s*\{[\s\S]*?display:\s*grid;[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\);[\s\S]*?\}[\s\S]*?\.tools-value-sheet-value\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums;[\s\S]*?\}/s,
    'tools mobile smith compact values should look tappable and the exact-value drawer should preserve tabular numeric presentation'
);

assert.match(
    source,
    /\.tools-root\s+\.empty-state\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?\}[\s\S]*?\.tools-root\s+\.item-empty-state\s*\{[\s\S]*?justify-content:\s*center;[\s\S]*?\}/s,
    'tools stylesheet should define the local empty-state layout used by calculators'
);

assert.match(
    source,
    /\.tools-root\s+\.price-breakdown-popover-sheet\s*\{[\s\S]*?position:\s*static;[\s\S]*?height:\s*100%;[\s\S]*?\}/s,
    'tools stylesheet should keep the tools-local sheet sizing layer used by its price-breakdown flows'
);

assert.doesNotMatch(
    source,
    /\.tools-root\s+\.item-sheet\s*\{|\.tools-root\s+\.item-popover\s*\{|\.tools-root\s+\.item-popover-header\s*\{|\.tools-root\s+\.item-popover-name\s*\{|\.tools-root\s+\.item-popover-type\s*\{/s,
    'tools stylesheet should not own the shared teleported item-popover shell styles'
);

assert.match(
    source,
    /\.tools-smeltery-calc-popover\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?background:\s*var\(--tools-panel-bg\);[\s\S]*?\}/s,
    'tools stylesheet should define its own smeltery calculator popover styles under tools-local class names'
);

assert.match(
    source,
    /\.tools-per-item-tree-row\s*\{[\s\S]*?grid-template-columns:\s*34px minmax\(0,\s*1fr\) auto 24px;[\s\S]*?\}[\s\S]*?\.tools-resource-row\.tools-per-item-tree-row\s*\{[\s\S]*?grid-template-columns:\s*34px minmax\(0,\s*1fr\) auto 24px;[\s\S]*?\}[\s\S]*?\.tools-resource-row\s*\{[\s\S]*?grid-template-columns:\s*34px minmax\(0,\s*1fr\) auto;[\s\S]*?\}/s,
    'tools per-item smith rows should preserve their dedicated 4-column grid when they also use the shared tools resource row class'
);

assert.doesNotMatch(
    source,
    /\.smith-smeltery-calc-popover\s*\{/s,
    'tools stylesheet should not keep smith module popover class names'
);

console.log('tools/style.test.mjs passed');
