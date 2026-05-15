import { optimize } from './optimizer.v2.js';

function assignmentSignature(result) {
    return result.assignment.map(container => `${container.id}:${container.items.map(item => item.id).join(',')}`).join('|');
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected "${expected}", got "${actual}"`);
    }
}

function assert(condition, label) {
    if (!condition) throw new Error(label);
}

function run() {
    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'mammoth_ring', slot: 'ring', bonuses: [{ bonus: 'attack', value: 10, unit_type: 'flat' }] },
                { id: 'ashen_ring', slot: 'ring', max: 1, bonuses: [{ bonus: 'attack', value: 9, unit_type: 'flat' }] }
            ],
            [],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:mammoth_ring|ring_2:mammoth_ring', 'unlimited ring can duplicate');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'flat_ring', slot: 'ring', bonuses: [{ bonus: 'attack', value: 100, unit_type: 'flat' }] },
                { id: 'percent_ring', slot: 'ring', max: 1, bonuses: [{ bonus: 'attack', value: 100, unit_type: 'percent' }] }
            ],
            [],
            'attack',
            { flat: 100, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:flat_ring|ring_2:percent_ring', 'compound objective chooses mixed best');
    }

    {
        const result = optimize(
            [
                { id: 'c1', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 },
                { id: 'c2', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 }
            ],
            [
                {
                    id: 'rw_pre',
                    slot: 'rune_socket',
                    size: 6,
                    exclusive: true,
                    max: 1,
                    bonuses: [{ bonus: 'attack', value: 200, unit_type: 'flat' }],
                    constraint: { excludes: ['pre'] }
                }
            ],
            [
                {
                    id: 'pre',
                    slot: 'rune_socket',
                    max: 6,
                    bonuses: [{ bonus: 'attack', value: 30, unit_type: 'flat' }],
                    constraint: { excludes: ['rw_pre'] }
                },
                { id: 'vex', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 45, unit_type: 'flat' }] }
            ],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(result.total, 540, 'rune exact search total');
        assert(!assignmentSignature(result).includes('pre'), 'pre excluded by stronger solution');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'a', slot: 'ring', bonuses: [{ bonus: 'respawn_time', value: -2, unit_type: 'percent' }] },
                { id: 'b', slot: 'ring', bonuses: [{ bonus: 'respawn_time', value: -1, unit_type: 'percent' }] }
            ],
            [],
            'respawn_time',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:|ring_2:', 'raw optimizer expects pre-signed minimize inputs');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'a', slot: 'ring', bonuses: [{ bonus: 'attack', value: 10, unit_type: 'flat' }], constraint: { excludes: ['b'] } },
                { id: 'b', slot: 'ring', bonuses: [{ bonus: 'attack', value: 100, unit_type: 'flat' }] }
            ],
            [],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:b|ring_2:b', 'reverse excludes respected');
    }

    console.log('optimizer.v2 tests passed');
}

run();
