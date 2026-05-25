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
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.engineering-card-grid\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}[\s\S]*?\.engineering-planner-help-table td:first-child\s*\{[\s\S]*?color:\s*var\(--gold-lt\);[\s\S]*?\}/s,
    'shell stylesheet should own the mobile engineering planner layout fallbacks'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.engineering-planner-controls\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}[\s\S]*?\.engineering-mode-switch\s*\{[\s\S]*?width:\s*100%;[\s\S]*?align-self:\s*stretch;[\s\S]*?\}[\s\S]*?\.engineering-planner-controls\s+\.engineering-field,\s*[\s\S]*?\.engineering-planner-controls\s+\.engineering-field:last-child\s+\.engineering-input\s*\{[\s\S]*?width:\s*100%;[\s\S]*?\}[\s\S]*?\.engineering-planner-summary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}/s,
    'shell stylesheet should keep the shared mobile engineering planner controls and summary grid layout'
);

console.log('shell/style.test.mjs passed');
