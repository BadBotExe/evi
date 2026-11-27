import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogHref, catalogQueryLimit, parseCatalogFilters, parseCatalogSearch } from './catalog.js';

test('catalog filters round-trip with shared items and encode search as text', () => {
    const filters = { query: '<b>&m=boss #', type: 'recipe', mechanic: 'vein' };
    const url = new URL(catalogHref(['recipe_mine_2'], new Map([['recipe_mine_2', 'mi2']]), filters), 'https://example.test');
    assert.equal(url.pathname, '/items');
    assert.equal(url.hash, '');
    assert.equal(url.search.includes('<'), false);
    assert.deepEqual(parseCatalogSearch(url.search), { shared: true, ids: ['mi2'] });
    assert.deepEqual(parseCatalogFilters(url.search, ['recipe'], ['vein']), filters);
});

test('catalog accepts only visible filter choices and bounds search length', () => {
    const search = '?t=unknown&t=recipe&m=boss&q=' + 'a'.repeat(catalogQueryLimit + 1);
    assert.deepEqual(parseCatalogFilters(search, ['recipe'], ['vein']), {
        query: 'a'.repeat(catalogQueryLimit), type: '', mechanic: ''
    });
    assert.equal(catalogHref([], undefined, { shared: true, mechanic: 'vein' }), '/items?i=&m=vein');
});
