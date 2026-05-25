import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.about-shell\s*\{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*24px;[\s\S]*?\}/s,
    'shell stylesheet should own the about section layout styles'
);

assert.match(
    source,
    /\.layout\s*\{[\s\S]*?grid-template-columns:\s*var\(--sidebar-w\)\s+1fr\s+var\(--right-w\);[\s\S]*?max-width:\s*1400px;[\s\S]*?\}[\s\S]*?\.layout\.about-view\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?max-width:\s*var\(--app-page-max-wide\);[\s\S]*?\}/s,
    'shell stylesheet should own the constrained shared route layout, including the about view max width'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.about-mobile-browser\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?overflow-y:\s*auto;[\s\S]*?\}/s,
    'shell stylesheet should own the mobile about browser layout'
);

assert.match(
    source,
    /\.engineering-summary-chip\s*\{[\s\S]*?background:\s*var\(--bg-stat\);[\s\S]*?\}[\s\S]*?\.engineering-card-badge\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?text-transform:\s*uppercase;[\s\S]*?\}/s,
    'shell stylesheet should own the shared engineering planner card and summary chip styles'
);

assert.match(
    source,
    /\.item-sheet\s*\{[\s\S]*?z-index:\s*500;[\s\S]*?\}[\s\S]*?\.item-popover\s*\{[\s\S]*?background:\s*var\(--bg-panel\);[\s\S]*?width:\s*340px;[\s\S]*?\}[\s\S]*?\.item-popover-header\s*\{[\s\S]*?background:\s*var\(--bg-stat\);[\s\S]*?\}[\s\S]*?\.item-popover-name\s*\{[\s\S]*?color:\s*var\(--gold-lt\);[\s\S]*?\}[\s\S]*?\.item-popover-type\s*\{[\s\S]*?color:\s*var\(--hint\);[\s\S]*?\}[\s\S]*?\.price-breakdown-popover-sheet\s*\{[\s\S]*?position:\s*static;[\s\S]*?height:\s*100%;[\s\S]*?\}/s,
    'shell stylesheet should own the shared teleported item-popover sheet styles used by planner drawers'
);

assert.match(
    source,
    /\.engineering-planner-help-body\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overflow-x:\s*hidden;[\s\S]*?scrollbar-gutter:\s*stable;[\s\S]*?\}[\s\S]*?\.engineering-planner-help-copy\s*\{[\s\S]*?margin-top:\s*8px;[\s\S]*?padding:\s*0 10px;[\s\S]*?\}[\s\S]*?\.engineering-planner-help-copy p\s*\{[\s\S]*?color:\s*var\(--text\);[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?line-height:\s*1\.45;[\s\S]*?\}/s,
    'shell stylesheet should keep planner help notes aligned with the table and preserve a dedicated scrollable help body'
);

assert.match(
    source,
    /\.tools-input-surface,\s*\.tools-number-input\s*\{[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.14\);[\s\S]*?\}[\s\S]*?\.tools-input-filled,\s*\.tools-number-input\s*\{[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*0\.30\);[\s\S]*?\}[\s\S]*?\.tools-input-full\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?\}/s,
    'shell stylesheet should own the shared filled input surface classes reused by calculator modules'
);

assert.match(
    source,
    /::-webkit-scrollbar\s*\{[\s\S]*?width:\s*6px;[\s\S]*?\}[\s\S]*?::-webkit-scrollbar-track\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?\}[\s\S]*?::-webkit-scrollbar-thumb\s*\{[\s\S]*?background:\s*var\(--bg-row\);[\s\S]*?border-radius:\s*6px;[\s\S]*?\}/s,
    'shell stylesheet should own the shared custom scrollbar styles used across app modules'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.engineering-card-grid\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}[\s\S]*?\.engineering-planner-help-table td:first-child\s*\{[\s\S]*?color:\s*var\(--gold-lt\);[\s\S]*?\}/s,
    'shell stylesheet should own the mobile engineering planner layout fallbacks'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.engineering-planner-controls\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}[\s\S]*?\.engineering-planner-controls\s+\.engineering-field,\s*[\s\S]*?\.engineering-planner-controls\s+\.engineering-field:last-child\s+\.engineering-input\s*\{[\s\S]*?width:\s*100%;[\s\S]*?\}[\s\S]*?\.engineering-planner-summary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}/s,
    'shell stylesheet should keep the shared mobile engineering planner controls and summary grid layout'
);

console.log('shell/style.test.mjs passed');
