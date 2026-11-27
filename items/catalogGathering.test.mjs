import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCatalog } from './catalog.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('woodcutting and fishing include drops and items with configured skill bonuses', () => {
    const sources = [
        { item_id: 'curio_fifth_stab', bonuses: [{ bonus: 'woodcutting_power' }, { bonus: 'attack' }] },
        { item_id: 'curio_opulent_spyglass', bonuses: [{ bonus: 'fishing_power' }, { bonus: 'attack' }] }
    ];
    const catalog = buildCatalog(read('./items.json'), read('./item-sources.json'), read('../cards/cards.json'), sources);
    const items = new Map(catalog.map(item => [item.id, item]));

    assert.ok(items.get('goak_log').mechanics.has('tree'));
    assert.ok(items.get('old_boot').drops.some(drop => drop.type === 'fishing'));
    assert.deepEqual(items.get('curio_fifth_stab').mechanicBonuses.get('tree'), ['woodcutting_power']);
    assert.deepEqual(items.get('curio_opulent_spyglass').mechanicBonuses.get('fishing'), ['fishing_power']);
    assert.ok(items.get('undead_piranha').mechanics.has('fishing'));
    assert.ok(items.get('undead_piranha').sources.some(source => source.type === 'unobtainable'));
});
