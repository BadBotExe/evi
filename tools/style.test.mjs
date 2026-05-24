import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.tools-root\s+\.layout\.calc-view\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?grid-template-areas:\s*'left'\s*'center';[\s\S]*?\}/s,
    'tools mobile layout should locally restore the shared calc layout instead of letting the global mobile rule hide the entire tools screen'
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

console.log('tools/style.test.mjs passed');
