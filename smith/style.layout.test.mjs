import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.smith-browser-panel\s*\{[\s\S]*?width:\s*min\(100%, 900px\);[\s\S]*?\}/s,
    'smith browser panel should be 90px wider on desktop'
);

assert.match(
    source,
    /\.smith-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit, minmax\(76px, 76px\)\);[\s\S]*?column-gap:\s*8px;[\s\S]*?row-gap:\s*8px;[\s\S]*?\}/s,
    'smith grid should auto-fit as many desktop cells per row as available with compact gaps'
);

assert.match(
    source,
    /\.smith-mobile-panel-wrap\s*\{[\s\S]*?overflow-x:\s*scroll;[\s\S]*?scroll-snap-type:\s*x mandatory;[\s\S]*?\}/s,
    'smith mobile panel wrap should use horizontal scroll snapping'
);

assert.match(
    source,
    /\.smith-mobile-tab-bar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*64px;[\s\S]*?\}/s,
    'smith mobile layout should include a bottom tab bar sized for touch navigation'
);

assert.match(
    source,
    /\.smith-smeltery-control-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(118px,\s*1fr\)\s+minmax\(118px,\s*1fr\)\s+minmax\(78px,\s*0\.67fr\)\s+auto;[\s\S]*?\}/s,
    'smith smeltery control should keep gemshop speed and multicraft equal while making speed percent narrower'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.smith-smeltery-control-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(108px,\s*1fr\)\s+minmax\(108px,\s*1fr\)\s+minmax\(72px,\s*0\.67fr\)\s+auto;[\s\S]*?\}[\s\S]*?\}/s,
    'smith mobile smeltery control should keep gemshop speed, multicraft, speed, and calculator button on one row'
);

console.log('smith/style.layout.test.mjs passed');
