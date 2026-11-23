import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadAfkCombatBonusCatalog } from './afkCombatBonuses.js';

test('catalog can exclude an event weapon and require an alternative', async t => {
    t.mock.method(globalThis, 'fetch', async url => ({
        ok: true,
        json: async () => JSON.parse(await readFile(url, { encoding: 'utf8' }))
    }));
    const catalog = await loadAfkCombatBonusCatalog();
    const initial = catalog.build();
    const bow = initial.items.find(item => item.name === 'Christmas Bow');
    const belt = initial.items.find(item => item.name === 'Harvest Belt');
    assert.ok(initial.options.some(option => option.slots.some(item => item.id === bow.id)));

    const excluded = catalog.build({ excluded: [bow.id] });
    assert.ok(excluded.options.length > 0);
    assert.ok(excluded.options.every(option => option.slots.every(item => item.id !== bow.id)));
    assert.ok(excluded.options.every(option => option.offlineRate <= Math.max(...initial.options.map(initialOption => initialOption.offlineRate))));

    const replacement = initial.items.find(item => item.slot === 'weapon' && item.id !== bow.id);
    const required = catalog.build({ excluded: [bow.id], required: { weapon: replacement.id, belt: belt.id } });
    assert.ok(required.options.length > 0);
    for (const option of required.options) {
        assert.deepEqual(option.slots.filter(item => item.slot === 'weapon').map(item => item.id), [replacement.id]);
        assert.deepEqual(option.slots.filter(item => item.slot === 'belt').map(item => item.id), [belt.id]);
    }
    assert.deepEqual(catalog.build({ excluded: [bow.id], required: { weapon: bow.id } }).options, []);
});
