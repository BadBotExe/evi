import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadAfkCombatBonusCatalog } from './afkCombatBonuses.js';

test('Christmas weapons and bonfire can be toggled independently', async t => {
    t.mock.method(globalThis, 'fetch', async url => ({
        ok: true,
        json: async () => JSON.parse(await readFile(url, { encoding: 'utf8' }))
    }));
    const catalog = await loadAfkCombatBonusCatalog();
    const minSpawn = settings => Math.min(...catalog.build(settings).options.map(option => option.mobSpawnMultiplier));
    const defaultSpawn = minSpawn();
    const withoutWeapons = minSpawn({ includeChristmasWeapons: false });
    assert.equal(defaultSpawn, 31);
    assert.ok(withoutWeapons > defaultSpawn);
    assert.equal(minSpawn({ includeBonfire: false }), defaultSpawn + 20);
    assert.equal(minSpawn({ includeChristmasWeapons: false, includeBonfire: false }), withoutWeapons + 20);
    assert.equal(minSpawn(), defaultSpawn);
});
