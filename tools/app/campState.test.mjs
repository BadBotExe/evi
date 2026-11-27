import assert from 'node:assert/strict';
import test from 'node:test';
import { persistCampState, restoreCampState } from './campState.js';
import { createCampState } from '../lib/campCalculator.js';

function memoryStorage() {
    const data = new Map();
    return { setItem: (key, value) => data.set(key, value), getItem: key => data.get(key) };
}

test('restores every input, including branches and assignments hidden by a lower hall', () => {
    const storage = memoryStorage();
    const state = createCampState();
    Object.assign(state, { buildingId: 'mine', mobileTab: 'parameters', storedRP: 321, activeBought: 2, slotsBought: 1 });
    Object.assign(state.buildings.hall, { stars: 2, levels: [50, 100, 75] });
    Object.assign(state.buildings.mine, { stars: 3, levels: [100, '', 50] });
    Object.assign(state.buildings.mine.workers[2], {
        target: 'sunstone_ore', tier: 3, level: 50, job: 'mine', perk: 'lead'
    });
    persistCampState(state, storage);
    assert.deepEqual(restoreCampState(storage), state);
    const legacy = { getItem: key => storage.getItem(key) + '&hours=12.5' };
    assert.deepEqual(restoreCampState(legacy), state);
});

test('restores defaults when browser storage is missing or inaccessible', () => {
    const storage = {
        getItem() { throw new Error('disabled'); },
        setItem() { throw new Error('disabled'); }
    };
    assert.deepEqual(restoreCampState(memoryStorage()), createCampState());
    assert.deepEqual(restoreCampState(storage), createCampState());
    const unknown = restoreCampState({ getItem: () => 'building=unknown&mobileTab=unknown' });
    assert.equal(unknown.buildingId, 'hall');
    assert.equal(unknown.mobileTab, 'summary');
    assert.doesNotThrow(() => persistCampState(createCampState(), storage));
});
