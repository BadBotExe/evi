import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSectionRootMarkup } from './app/sectionMount.js';

const html = readFileSync(new URL('./section.html', import.meta.url), 'utf8');
const markup = extractSectionRootMarkup(html);

assert.equal(
    markup.includes('v-cloak'),
    false,
    'section root markup must not keep v-cloak after extraction'
);

assert.equal(
    markup.includes('id="app"'),
    true,
    'section root markup keeps the application mount node'
);

assert.equal(
    /<template>\s*<!-- DESKTOP LAYOUT -->/.test(markup),
    false,
    'section root markup must not wrap the main content in a raw template element'
);

assert.equal(
    markup.includes(`<max-panel :max-items="maxItemsAvail" :max-tab="'avail'" :app="appRef"`),
    true,
    'mobile available max panel must bind available items'
);

assert.equal(
    markup.includes(`<max-panel :max-items="maxItemsAll" :max-tab="'all'" :app="appRef"`),
    true,
    'mobile all max panel must bind all items'
);

console.log('bonuses/app.test.mjs passed');
