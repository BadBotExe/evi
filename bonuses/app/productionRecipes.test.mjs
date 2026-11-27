import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BonusDataLoader } from './dataLoader.js';

test('production slots provide recipes only for currencies with ingredients', () => {
    const data = JSON.parse(readFileSync(new URL('../sources/engineering_production.json', import.meta.url), 'utf8'));
    const recipes = new BonusDataLoader({}).buildProductionRecipes([{ data }, { data: [] }]);

    assert.equal(recipes.has('idea'), false);
    assert.deepEqual(recipes.get('blueprint'), [{ item: 'idea', quantity: 30 }]);
    assert.deepEqual(recipes.get('runic_blueprint'), [
        { item: 'idea', quantity: 70 },
        { item: 'blueprint', quantity: 1 }
    ]);
    assert.deepEqual(recipes.get('sun_scroll'), [
        { item: 'blueprint', quantity: 14 },
        { item: 'runic_blueprint', quantity: 10 }
    ]);
});
