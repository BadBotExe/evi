import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./section.html', import.meta.url), 'utf8');

assert.match(
    source,
    /<div id="app" class="tools-root" v-cloak>/,
    'tools section should mark the root so tools can override the shared mobile layout rules without duplicating panels'
);

assert.match(
    source,
    /<div class="mobile-topbar tools-mobile-topbar" v-if="calcEntries\?\.length">[\s\S]*?class="tools-calculator-select-box"[\s\S]*?calcDropdownOpen[\s\S]*?class="tools-calculator-dropdown mobile-dropdown"[\s\S]*?selectCalc\(entry\.id\); calcDropdownOpen = false/s,
    'tools section should render the mobile calculator selector with tools-local dropdown class names instead of bonuses classes'
);

assert.match(
    source,
    /<div class="mobile-item-browser mobile-panel">[\s\S]*?<engineering-planner-panel[\s\S]*?<smith-calculator-panel/s,
    'tools section should render calculators in the dedicated mobile content container below the selector'
);

console.log('tools/section.test.mjs passed');
