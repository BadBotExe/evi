import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { optimizeAdditivePair } from '../../bonuses/lib/optimizer.v2.js';

globalThis.document = { body: {}, createElement: () => ({}) };
const { createToolsApp } = await import('../module.js');
const { methods } = createToolsApp()._component;

test('five Curio slots keep both three-plus-two allocations feasible', () => {
    const containers = Array.from({ length: 5 }, (_, index) => ({
        id: 'curio_' + index, slot_type: 'curio', slots: 1, maxExclusive: 1
    }));
    const item = (id, unit_type, value) => ({
        id, slot: 'curio', max: 3, bonuses: [{ bonus: 'pair', unit_type, value }]
    });
    const frontier = optimizeAdditivePair(containers, [], [
        item('respawn', 'flat', 6),
        item('afk', 'percent', 9)
    ], 'pair');

    assert.deepEqual(
        frontier.map(({ contrib }) => [contrib.flat, contrib.percent]).sort((a, b) => a[0] - b[0]),
        [[12, 27], [18, 18]]
    );
    assert.ok(frontier.every(({ assignment }) => assignment.every(slot => slot.items.length === 1)));
});

test('AFK calculator loads catalog limits and selects a feasible set for the active combat bottleneck', async t => {
    t.mock.method(globalThis, 'fetch', async url => ({
        ok: true,
        json: async () => JSON.parse(await readFile(url, { encoding: 'utf8' }))
    }));
    const player = { attack: 1000, attackSpeed: 1, offlineRate: 100, mobSpawnMultiplier: 100 };
    const app = {
        ...methods,
        afkCombatState: { player },
        afkCombatSelectedEnemy: () => ({ hp: 100, baseSpawnSeconds: 10, maxSpawns: 5 }),
        afkCombatWeaponOptions: () => [{ id: 'test', attackRange: 5 }],
    };
    player.weaponId = 'test';

    await app.ensureAfkCombatBonusOptions();
    assert.equal(app.afkCombatBonusError, false);

    const spawnLimited = app.afkCombatBonusRecommendation();
    assert.equal(spawnLimited.minimumSpawnTime, 31);
    assert.equal(spawnLimited.maximumAfkGains, 215);
    assert.equal(spawnLimited.best.mobSpawnMultiplier, 31);
    assert.ok(spawnLimited.best.offlineRate < 215);
    assert.equal(spawnLimited.best.slots.filter(slot => slot.type === 'Curio').length, 5);

    player.attack = 10;
    const damageLimited = app.afkCombatBonusRecommendation();
    assert.equal(damageLimited.best.offlineRate, 215);
    assert.ok(damageLimited.best.mobSpawnMultiplier > 31);
    assert.equal(player.offlineRate, 100);
    assert.equal(player.mobSpawnMultiplier, 100);
});
