import test from 'node:test';
import assert from 'node:assert/strict';
import { persistHourglassState, restoreHourglassState } from './hourglassRebirthState.js';

test('all counts and the goal survive recreation of calculator state', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const state = { timeline: [0, 1, 2, 3, 4, 5], sand: [5, 4, 3, 2, 1, 0], goal: 'five' };
    persistHourglassState(state, storage);
    assert.deepEqual(restoreHourglassState(storage), state);
});

test('invalid values fall back individually and out-of-range counts are capped', () => {
    const storage = { getItem: () => 'timeline1=-7&timeline2=100&sand1=0&goal=unknown' };
    assert.deepEqual(restoreHourglassState(storage), {
        timeline: [3, 25, 2, 1, 0, 3],
        sand: [0, 2, 0, 0, 0, 3],
        goal: 'two'
    });
});
