import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalogHref, catalogRouteKeys, parseCatalogSearch } from './catalog.js';

const items = JSON.parse(readFileSync(new URL('./items.json', import.meta.url), 'utf8'));
const { keyById, idByKey } = catalogRouteKeys(items);

test('every item has a short key that resolves to the same item', () => {
    for (const { id, key } of items) {
        assert.match(key, /^[a-z0-9_-]+$/i, id);
        assert.equal(keyById.get(id), key);
        assert.equal(idByKey.get(key), id);
    }
});

test('three curios can be shared with short keys or legacy IDs', () => {
    const ids = ['curio_opulent_spyglass', 'curio_numbers_map', 'curio_wish_finder'];
    assert.equal(catalogHref(ids, keyById), '/items?i=ops,nmp,wsf');
    assert.deepEqual(parseCatalogSearch('?i=ops,nmp,wsf', idByKey), { shared: true, ids });
    assert.deepEqual(parseCatalogSearch('?items=' + ids.join(','), idByKey), { shared: true, ids });
});
