import assert from 'node:assert/strict';
import test from 'node:test';
import { CampCalculatorPanel } from './CampCalculatorPanel.js';
import { createCampState } from '../lib/campCalculator.js';

test('clears only the selected building, including workers hidden by the hall level', () => {
    const state = createCampState(true);
    state.buildings.hall.stars = 1;
    state.storedRP = 100;
    const expected = structuredClone(state);
    expected.buildings.mine = createCampState().buildings.mine;

    CampCalculatorPanel.methods.clearBuilding.call({ state }, 'mine');

    assert.deepEqual(state, expected);
});

test('formats fish production in kilograms per hour', () => {
    const { format, fishRate } = CampCalculatorPanel.methods;
    const context = {
        format,
        $label: (label, values) => label.replace(/\{(\d+)\}/g, (_, index) => values[index])
    };
    assert.equal(fishRate.call(context, 405), '40.5 kg/h');
});
