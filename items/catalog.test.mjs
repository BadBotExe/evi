import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import gameRu from '../i18n/game-ru.js';
import { resolveShellRoute, resolveTopLevelRoute } from '../shell/routing/routeResolver.js';
import { buildCatalog, catalogHref, filterCatalog, parseCatalogSearch } from './catalog.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const items = read('./items.json');
const catalog = buildCatalog(items, read('./item-sources.json'), read('../cards/cards.json'));
const byId = id => catalog.find(item => item.id === id);
const names = item => [item.name, gameRu.item[item.id]].filter(Boolean);

test('catalog exposes every item and combines bilingual search, type and mechanics', () => {
    assert.equal(catalog.length, new Set(items.map(item => item.id)).size);
    assert.equal(byId('grassy_core').name, 'Grassy Core');
    for (const query of ['bream', 'серый лещ', 'grey_bream']) {
        assert.deepEqual(filterCatalog(catalog, { query, type: 'fish', mechanic: 'fishing' }, names)
            .map(item => item.id), ['grey_bream']);
    }
    assert.deepEqual(filterCatalog(catalog, { query: 'серый лещ', mechanic: 'tree' }, names), []);
    assert.ok(byId('boar_card').types.includes('card'));
    assert.ok(byId('goak_log').mechanics.has('tree'));
});

test('catalog includes card-only, fishing and restricted acquisition sources', () => {
    assert.deepEqual(byId('grey_bream').drops.map(drop => drop.card.id), ['pond_shallows']);
    assert.equal(byId('old_boot').drops.length, 9);
    assert.ok(byId('recipe_pier_2').drops.some(drop => drop.card.id === 'river_pool'));
    const beeb = byId('pet_beeb').drops.find(drop => drop.card.id === 'boar');
    assert.deepEqual(beeb.modes, ['normal', 'hard', 'nightmare']);
    const cardSource = byId('act1_hard_card').sources.find(source => source.id === 'act1_all_zones');
    assert.deepEqual(cardSource.modes, ['hard']);
    assert.ok(byId('act1_hard_card').mechanics.has('zone'));
    assert.deepEqual(byId('anniversary_belt').sources[0].during.map(source => source.id), ['anniversary_event']);
});

test('share links open the exact known subset in URL order', () => {
    const ids = ['curio_opulent_spyglass', 'curio_numbers_map', 'curio_wish_finder'];
    for (const selection of [ids.slice(0, 1), ids]) {
        const url = new URL(catalogHref(selection), 'https://evitania.local');
        assert.equal(resolveTopLevelRoute(url.pathname), 'catalog');
        assert.deepEqual(parseCatalogSearch(url.search), { shared: true, ids: selection });
        assert.deepEqual(filterCatalog(catalog, {
            ...parseCatalogSearch(url.search), query: 'ignored', type: 'fish'
        }, names).map(item => item.id), selection);
    }
    assert.deepEqual(resolveShellRoute('catalog'), { routeId: 'catalog', href: '/items' });
    const mixed = parseCatalogSearch('?items=goak_log,unknown,goak_log');
    assert.deepEqual(filterCatalog(catalog, mixed, names).map(item => item.id), ['goak_log']);
    assert.deepEqual(filterCatalog(catalog, parseCatalogSearch('?items='), names), []);
    assert.equal(parseCatalogSearch('').shared, false);
});
