import assert from 'node:assert/strict';
import { computeEngineeringThroughput } from './engineeringThroughput.js';

const slots = [
    {
        id: 'idea',
        producedAmount: 1,
        currentRatePerHour: 600,
        produces: { idea: 1 }
    },
    {
        id: 'blueprint',
        producedAmount: 1,
        currentRatePerHour: 40,
        consumes: { idea: 30 },
        produces: { blueprint: 1 }
    },
    {
        id: 'runic_blueprint',
        producedAmount: 1,
        currentRatePerHour: 10,
        consumes: { idea: 70, blueprint: 1 },
        produces: { runic_blueprint: 1 }
    },
    {
        id: 'sun_scroll',
        producedAmount: 1,
        currentRatePerHour: 1,
        consumes: { blueprint: 14, runic_blueprint: 10 },
        produces: { sun_scroll: 1 }
    }
];

const weights = {
    idea: 1140,
    blueprint: 24,
    runic_blueprint: 10,
    sun_scroll: 1
};

{
    const rows = computeEngineeringThroughput({
        slots,
        anchorSlotId: 'sun_scroll',
        weights
    });

    const idea = rows.find(row => row.slotId === 'idea');
    const blueprint = rows.find(row => row.slotId === 'blueprint');
    const runic = rows.find(row => row.slotId === 'runic_blueprint');
    const sun = rows.find(row => row.slotId === 'sun_scroll');

    assert.equal(Number(idea.stableOutputRatePerHour.toFixed(3)), 600, 'root producer keeps its full useful output when it is the normalized bottleneck');
    assert.equal(Number(blueprint.stableOutputRatePerHour.toFixed(3)), 12.632, 'blueprint output scales to the same chain bottleneck');
    assert.equal(Number(runic.spendRatePerHour.toFixed(3)), 5.263, 'runic spend matches stabilized sun scroll demand');
    assert.equal(Number(sun.netRatePerHour.toFixed(3)), 0.526, 'anchor net throughput reflects the constrained chain output');
    assert.equal(runic.starved, true, 'runic is marked starved when upstream capacity cannot sustain its entered rate');
    assert.deepEqual(blueprint.blockingConsumers, [], 'non-blocking slots do not report downstream blocking consumers');
}

{
    const starvedRows = computeEngineeringThroughput({
        slots: [
            {
                id: 'idea',
                producedAmount: 1,
                currentRatePerHour: 300,
                produces: { idea: 1 }
            },
            {
                id: 'blueprint',
                producedAmount: 1,
                currentRatePerHour: 20,
                consumes: { idea: 30 },
                produces: { blueprint: 1 }
            },
            {
                id: 'runic_blueprint',
                producedAmount: 1,
                currentRatePerHour: 4,
                consumes: { idea: 70, blueprint: 1 },
                produces: { runic_blueprint: 1 }
            }
        ],
        anchorSlotId: 'runic_blueprint',
        weights: {
            idea: 100,
            blueprint: 1,
            runic_blueprint: 1
        }
    });

    const blueprint = starvedRows.find(row => row.slotId === 'blueprint');
    assert.equal(blueprint.starved, true, 'shared upstream shortages mark the slot as starved when it is not the blocker target');
    assert.deepEqual(blueprint.shortageProducerIds, ['idea'], 'starvation identifies the direct limiting producer');
    assert.deepEqual(blueprint.contenderIds, ['runic_blueprint'], 'starvation contenders include sibling consumers of the same producer');
}

console.log('bonuses/lib/engineeringThroughput.test.mjs passed');
