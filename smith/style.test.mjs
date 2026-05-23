import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.smith-page\s*\{[\s\S]*?padding:\s*var\(--app-layout-top-padding\)\s+var\(--app-page-gutter\)\s+40px;[\s\S]*?max-width:\s*1200px;[\s\S]*?\}/s,
    'smith page should align its top padding with the shared sticky offset spacing and allow the wider browser panel'
);

assert.match(
    source,
    /\.smith-sidebar-left\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*var\(--app-panel-sticky-offset\);[\s\S]*?height:\s*fit-content;[\s\S]*?\}/s,
    'smith sidebar should keep using the shared sticky offset contract'
);

assert.match(
    source,
    /\.smith-root\.smith-layout-mobile\s+\.smith-mobile-root\s*\{\s*display:\s*flex;\s*\}/s,
    'smith mobile root should be shown only in mobile layout mode'
);

assert.match(
    source,
    /\.smith-mobile-root\s*\{[\s\S]*?height:\s*100dvh;[\s\S]*?padding-top:\s*var\(--app-mobile-header-height\);[\s\S]*?\}/s,
    'smith mobile root should reserve space for the fixed shell header and fill the viewport height'
);

console.log('smith/style.test.mjs passed');
