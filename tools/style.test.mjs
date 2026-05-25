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

assert.doesNotMatch(
    source,
    /\.smith-smeltery-calc-popover\s*\{/s,
    'tools stylesheet should not redefine the shared smith smeltery calculator popover styles'
);

console.log('tools/style.test.mjs passed');
