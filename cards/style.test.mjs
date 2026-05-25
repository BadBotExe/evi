import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

assert.match(
    source,
    /\.cards-app-section\.cards-root\s*\{[\s\S]*?max-width:\s*var\(--app-page-max-wide\);[\s\S]*?padding:\s*20px\s+var\(--app-page-gutter\)\s+var\(--app-page-bottom\);[\s\S]*?\}/s,
    'cards stylesheet should keep the shell-mounted desktop container width and top padding'
);

assert.match(
    source,
    /@media\s*\(min-width:\s*980px\)\s*\{[\s\S]*?\.cards-app-section\.cards-root\s*\{[\s\S]*?grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);[\s\S]*?height:\s*calc\(100dvh\s*-\s*var\(--app-header-height\)\s*-\s*var\(--app-header-border-width\)\);[\s\S]*?\}[\s\S]*?\.cards-app-section\s+\.browser-panel\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?min-height:\s*0;[\s\S]*?\}/s,
    'cards stylesheet should keep the desktop anti-scroll layout constraints for shell-mounted cards'
);

assert.match(
    source,
    /@media\s*\(max-width:\s*979px\),\s*\(pointer:\s*coarse\)\s*and\s*\(max-width:\s*979px\)\s*\{[\s\S]*?\.cards-app-section\.cards-root\s*\{[\s\S]*?top:\s*var\(--app-mobile-header-height\);[\s\S]*?padding:\s*0;[\s\S]*?height:\s*calc\(100dvh\s*-\s*var\(--app-mobile-header-height\)\);[\s\S]*?overflow:\s*hidden;[\s\S]*?\}/s,
    'cards stylesheet should keep the mobile shell offset and overflow lock under the shared header'
);

console.log('cards/style.test.mjs passed');
