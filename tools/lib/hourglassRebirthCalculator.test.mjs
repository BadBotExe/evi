import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHourglassBoard, calculateHourglassChain } from './hourglassRebirthCalculator.js';

const example = { timeline: [3, 2, 2, 1, 0, 3], sand: [3, 2, 0, 0, 0, 3] };

test('the two chains fill the board from opposite corners, highest tiers first', () => {
    const board = buildHourglassBoard(example);
    assert.equal(board.occupied, 19);
    assert.equal(board.cells.length, 25);
    assert.equal(board.cells[0].label, 'TL6');
    assert.equal(board.cells[10].label, 'TL1');
    assert.equal(board.cells[11], null);
    assert.equal(board.cells[17].label, 'S1');
    assert.equal(board.cells[24].label, 'S6');
    assert.equal(buildHourglassBoard({ ...example, timeline: [25, 0, 0, 0, 0, 0] }).overflow, true);
});

test('all three goals reproduce the original example and return executable plans', () => {
    for (const [goal, yieldCount, timelineSpawns, sandSpawns] of [
        ['one', 1, 92, 117],
        ['two', 2, 167, 200],
        ['five', 2, 167, 212]
    ]) {
        for (const [chain, expectedSpawns] of [['timeline', timelineSpawns], ['sand', sandSpawns]]) {
            const result = calculateHourglassChain({ ...example, goal }, chain);
            assert.equal(result.yield, yieldCount);
            assert.equal(result.spawns, expectedSpawns);
            const board = { timeline: [...example.timeline], sand: [...example.sand] };
            for (const op of result.ops) {
                const counts = board[op.chain];
                if (op.t === 'spawn') {
                    counts[0]++;
                } else {
                    const [take, give] = op.t === 'm5' ? [5, 2] : [3, 1];
                    assert.ok(counts[op.tier - 1] >= take);
                    counts[op.tier - 1] -= take;
                    counts[op.tier] += give;
                }
                assert.ok(buildHourglassBoard(board).occupied <= 25);
            }
            assert.equal(board[chain][5], example[chain][5] + yieldCount);
        }
    }
});

test('the two-T6 goal falls back to one when only a three-item merge fits', () => {
    const state = { timeline: [0, 0, 0, 0, 3, 0], sand: [0, 0, 0, 0, 0, 22], goal: 'two' };
    const result = calculateHourglassChain(state, 'timeline');
    assert.equal(result.yield, 1);
    assert.equal(result.fallback, true);
    assert.equal(result.spawns, 0);
});
