import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./section.html', import.meta.url), 'utf8');

assert.match(
    source,
    /<div id="app" class="tools-root" v-cloak>/,
    'tools section should mark the root so tools can override the shared mobile layout rules without duplicating panels'
);

console.log('tools/section.test.mjs passed');
