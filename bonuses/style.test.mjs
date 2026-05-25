import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.bonus-select-wrap\s*\{[\s\S]*?position:\s*relative;[\s\S]*?\}[\s\S]*?\.bonus-dropdown\s*\{[\s\S]*?max-height:\s*calc\(100vh\s*-\s*200px\);[\s\S]*?\}/s,
    'bonuses stylesheet should keep the bonuses-local dropdown styles'
);

assert.match(
    source,
    /\.bonus-desktop-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?\}[\s\S]*?\.sidebar-right\s*\{[\s\S]*?grid-area:\s*right;[\s\S]*?\}/s,
    'bonuses stylesheet should keep the bonuses-local desktop layout layer'
);

assert.doesNotMatch(
    source,
    /^:root\s*\{[\s\S]*?--sidebar-w:/m,
    'bonuses stylesheet should not own shared shell layout variables'
);

assert.doesNotMatch(
    source,
    /^\.(layout\.about-view|layout\.bonus-view|layout\.calc-view)\s*\{/m,
    'bonuses stylesheet should not redefine shared shell route layouts'
);

assert.doesNotMatch(
    source,
    /\.item-nav-panel\s*\{|\.source-section\s*\{|\.section-header\s*\{|\.section-chev\s*\{/s,
    'bonuses stylesheet should not redefine shared shell navigation and section chrome'
);

assert.doesNotMatch(
    source,
    /\.engineering-planner-controls\s*\{|\.engineering-mode-switch\s*\{|\.engineering-summary-chip\s*\{|\.engineering-card-grid\s*\{|\.engineering-mobile-sheet-body\s*\{/s,
    'bonuses stylesheet should not redefine the shared engineering planner baseline layer'
);

assert.doesNotMatch(
    source,
    /^\.(popover-header|popover-close)\s*\{/m,
    'bonuses stylesheet should not redefine shared popover header chrome'
);

console.log('bonuses/style.test.mjs passed');
