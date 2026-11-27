import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMP } from './campData.js';
import { calculateCamp, campTargets, campWorkerRate, createCampState } from './campCalculator.js';

test('the three level-100 branches reproduce the studied mine setup', () => {
    const state = createCampState(true);
    const result = calculateCamp(state);
    const mine = result.production.find(row => row.id === 'mine');
    assert.equal(Math.round(mine.rate), 238304);
    assert.equal(result.usedSlots, 1);
    assert.equal(result.resources[0].hourly, mine.rate);
    assert.equal(result.storageHours, result.capacity / mine.rate);
});

test('RP and chest bonuses stack separately from branch levels', () => {
    const state = createCampState(true);
    Object.assign(state, { activeBought: 3, storedRP: 100000 });
    for (const [id, target] of [['mine', 'copper_ore'], ['pier', 'grey_bream'], ['lumber', 'ash_log']]) {
        for (const cat of state.buildings[id].workers) {
            Object.assign(cat, { target, level: 50, tier: 3, job: 'keeper', perk: 'treas' });
        }
    }
    const result = calculateCamp(state);
    assert.equal(result.active, 9);
    assert.equal(result.valid, true);
    assert.equal(result.capacity, 44800000);
    assert.equal(result.rpHourly, 8704);
    assert.equal(result.rpHours, 1900000 / 8704);

    state.activeBought = 2;
    assert.equal(calculateCamp(state).valid, false);
});

test('weights and distinct resource slots constrain storage independently', () => {
    const state = createCampState(true);
    for (const [index, target] of ['copper_ore', 'tin_ore', 'sunstone_ore'].entries()) {
        state.buildings.mine.workers[index].target = target;
    }
    state.buildings.pier.workers[0].target = 'grey_bream';
    state.buildings.pier.workers[1].target = 'toot_tang';
    assert.equal(calculateCamp(state).storageHours, null);
    assert.equal(calculateCamp(state).usedSlots, 5);
    state.slotsBought = 1;
    const result = calculateCamp(state);
    assert.equal(result.slots, 6);
    assert.ok(result.storageHours > 0);
    assert.deepEqual(result.resources.map(row => row.weight), [1, 1, 10, 0.1, 0.1]);
});

test('fish ranks modify the norm and lower stars gate targets and branch levels', () => {
    const [bream, snapper, scad, tang] = campTargets('pier', 1);
    const reference = { tier: 0, level: 20, job: 'fish', perk: '' };
    assert.deepEqual([bream, snapper, scad, tang].map(target => campWorkerRate('pier', 1, target, reference, 0, 1)),
        [100, 200, 100, 400]);
    const state = createCampState(true);
    state.buildings.hall.stars = 1;
    const result = calculateCamp(state);
    assert.equal(result.active, 1);
    assert.equal(result.rpHourly, 200);
    assert.equal(result.capacity, 200000);
    assert.equal(campTargets('mine', 1).length, 3);
});

test('the calculator and example use only the released rarities', () => {
    assert.deepEqual(CAMP.rarities, ['Common', 'Uncommon', 'Rare', 'Epic']);
    assert.deepEqual(CAMP.maxLevels, [20, 30, 40, 50]);
    assert.ok(Object.values(CAMP.perks).every(values => values.length === CAMP.rarities.length));

    const state = createCampState(true);
    assert.ok(state.buildings.mine.workers.every(cat => cat.tier === 3 && cat.level === 50));
    state.buildings.mine.workers[0].tier = 4;
    assert.equal(calculateCamp(state).active, 2);
});

test('an unassigned worker can keep custom settings and uses the rank cap by default', () => {
    const state = createCampState(true);
    const worker = state.buildings.mine.workers[0];
    Object.assign(worker, { target: '', tier: 3, level: null });
    assert.equal(calculateCamp(state).active, 2);

    worker.target = 'copper_ore';
    const automatic = calculateCamp(state).production[0].rate;
    worker.level = 50;
    assert.equal(calculateCamp(state).production[0].rate, automatic);
    worker.level = 37;
    assert.ok(calculateCamp(state).production[0].rate < automatic);
});
