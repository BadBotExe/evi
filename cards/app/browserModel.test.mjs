import assert from 'node:assert/strict';

import {
    buildDesktopBrowserSections,
    buildMobileBrowserSections,
    cardMatchesBrowserFilters,
    matchesCardSearchQuery,
    normalizeCardSearchQuery
} from './browserModel.js';

const categories = [
    {
        label: 'Forest',
        cards: [
            { id: 'gap', placeholder: true },
            { id: 'alpha', name: 'Alpha Wolf', short_name: 'Wolf', bonus_type: 'attack' },
            { id: 'beta', name: 'Beta Mage', short_name: 'Mage', bonus_type: 'health' }
        ]
    },
    {
        label: 'Desert',
        cards: [
            { id: 'gamma', name: 'Gamma', short_name: 'Sand', bonus_type: 'speed' }
        ]
    }
];

assert.equal(normalizeCardSearchQuery('  WoLf  '), 'wolf');
assert.equal(matchesCardSearchQuery(categories[0].cards[1], 'wolf'), true);
assert.equal(matchesCardSearchQuery(categories[0].cards[2], 'wolf'), false);

const activeFilters = new Set(['attack']);
assert.equal(cardMatchesBrowserFilters(categories[0].cards[1], activeFilters, ''), true);
assert.equal(cardMatchesBrowserFilters(categories[0].cards[2], activeFilters, ''), false);
assert.equal(cardMatchesBrowserFilters(categories[0].cards[0], activeFilters, ''), false);

const desktopDefault = buildDesktopBrowserSections(categories, {
    activeFilters: new Set(),
    query: '',
    selectedId: 'alpha'
});
assert.equal(desktopDefault.sections.length, 2);
assert.deepEqual(desktopDefault.sections[0].entries.map(entry => entry.kind), ['placeholder', 'card', 'card']);
assert.equal(desktopDefault.sections[0].entries[1].isSelected, true);
assert.equal(desktopDefault.showEmptyMessage, false);

const desktopFiltered = buildDesktopBrowserSections(categories, {
    activeFilters,
    query: '',
    selectedId: null
});
assert.deepEqual(desktopFiltered.sections.map(section => section.label), ['Forest']);
assert.deepEqual(desktopFiltered.sections[0].entries.map(entry => entry.card.id), ['alpha']);

const mobileSearch = buildMobileBrowserSections(categories, {
    activeFilters: new Set(),
    query: 'mage',
    selectedId: 'beta'
});
assert.deepEqual(mobileSearch.sections.map(section => section.label), ['Forest']);
assert.deepEqual(mobileSearch.sections[0].entries.map(entry => entry.card.id), ['beta']);
assert.equal(mobileSearch.sections[0].entries[0].isSelected, true);

const noResults = buildMobileBrowserSections(categories, {
    activeFilters: new Set(['defense']),
    query: 'zzz',
    selectedId: null
});
assert.equal(noResults.sections.length, 0);
assert.equal(noResults.showEmptyMessage, true);

console.log('cards/app/browserModel.test.mjs passed');
