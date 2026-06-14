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
    'mobile max panel must bind available items'
);

assert.equal(
    markup.includes(`<max-panel :max-items="maxItemsAll" :max-tab="'all'" :app="appRef"`),
    false,
    'mobile all max panel must not render'
);

assert.equal(
    markup.includes(`<button v-if="showAllTab" class="max-tab-btn"`),
    false,
    'section markup must not expose the removed all tab prop'
);

assert.equal(
    markup.includes(`Max (Avail)`),
    false,
    'mobile max tab uses the generic max label'
);

assert.equal(
    markup.includes(`v-model="bonusSourceSearch"`),
    true,
    'bonus source search input must be present in the section markup'
);

assert.equal(
    markup.includes(`mobile-header-search-btn`),
    true,
    'mobile header renders the shared search action button'
);

assert.equal(
    markup.includes(`mobile-header-btn-badge`) && markup.includes(`hasActiveMobileSearchFilters`),
    true,
    'mobile header search button renders an active filters badge'
);

assert.equal(
    markup.includes(`@click="toggleMobileSettings($event)"`) && markup.includes(`@click="closeMobileSettings()"`),
    true,
    'mobile settings controls should use the shared toggle and close handlers'
);

assert.equal(
    markup.includes(`mobile-drawer item-sheet`) && markup.includes(`:class="{ open: mobileSettingsOpen }"`),
    true,
    'mobile settings drawer should use the same teleported sheet structure as the mobile search drawer'
);

assert.equal(
    markup.includes(`mobileSearchPopoverOpen`) && markup.includes(`mobile-drawer item-sheet`),
    true,
    'mobile search sheet markup must be present'
);

console.log('bonuses/app.test.mjs passed');
