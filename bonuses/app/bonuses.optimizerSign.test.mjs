import assert from 'node:assert/strict';
import { bonusMethods } from './bonuses.js';

const app = {
    ...bonusMethods,
    selectedBonus: 'respawn_time',
    data: {
        bonus_types: [
            { id: 'respawn_time', label: 'Mob Spawn Time', minimize: true }
        ],
        compound_rules: {},
        sources: []
    },
    groupedSources: {},
    _resolveBonusIds(bonusId) {
        return Array.isArray(bonusId) ? bonusId : [bonusId];
    }
};

const items = [];
app._runOptimizers(
    {
        containers: [
            { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 }
        ],
        exclusive: [
            {
                id: 'spawn_ring',
                slot: 'ring',
                bonuses: [
                    { bonus: 'respawn_time', unit_type: 'percent', value: -3 }
                ]
            }
        ],
        stackable: []
    },
    items,
    new Map([
        ['spawn_ring', { id: 'spawn_ring', name: 'Spawn Ring', type: 'gear', slot: 'ring' }]
    ])
);

assert.equal(items.length, 1, 'optimizer should return selected minimize item');
assert.equal(items[0].value, -3, 'minimize optimizer restores display value sign');
assert.equal(items[0].instance_value, -3, 'minimize optimizer restores per-instance value sign');
assert.equal(items[0].bonus.value, -3, 'minimize optimizer restores row bonus value sign');
assert.deepEqual(items[0].percentStages, {}, 'minimize optimizer keeps percent stage container stable');

console.log('bonuses/app/bonuses.optimizerSign.test.mjs passed');
