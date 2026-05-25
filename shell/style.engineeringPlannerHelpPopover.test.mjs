import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.engineering-planner-help-popover\.popover\s*\{[\s\S]*?background:\s*var\(--bg-panel\);[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?border-radius:\s*16px;[\s\S]*?\}/s,
    'engineering planner help popover should use the shared opaque popover chrome'
);

console.log('shell/style.engineeringPlannerHelpPopover.test.mjs passed');
