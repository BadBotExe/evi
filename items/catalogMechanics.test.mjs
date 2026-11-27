import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCatalog, filterCatalog } from './catalog.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('mining includes vein drops and items with mining bonuses configured in JSON', () => {
    const catalog = buildCatalog(read('./items.json'), read('./item-sources.json'), read('../cards/cards.json'), [
        { id: 'unrelated_source_id', item_id: 'rune_sko', bonuses: [
            { bonus: 'mining_power' },
            { bonus: 'mining_crit_chance' },
            { bonus: 'attack' }
        ] },
        { id: 'rune_sko', bonuses: [{ bonus: 'mining_power' }] }
    ]);
    const matches = filterCatalog(catalog, { mechanic: 'vein' }, item => [item.name]);
    const ore = matches.find(item => item.id === 'copper_ore');
    const rune = matches.find(item => item.id === 'rune_sko');

    assert.ok(ore.sources.some(source => source.type === 'vein'));
    assert.equal(ore.mechanicBonuses.has('vein'), false);
    assert.deepEqual(rune.mechanicBonuses.get('vein'), ['mining_power', 'mining_crit_chance']);
    assert.ok(!matches.some(item => item.id === 'cryolite_ore'));
});
