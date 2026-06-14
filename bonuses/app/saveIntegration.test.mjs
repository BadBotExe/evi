import assert from 'node:assert/strict';
import { BonusSaveIntegration } from './saveIntegration.js';

const app = {
    maxTab: 'actual',
    data: {
        _base_sources: [{ id: 'base_source', bonuses: [] }],
        parameters: [{ id: 'level', value: 1 }]
    },
    _dataLoader: {
        buildParameter(parameter) {
            return { ...parameter, built: true };
        }
    },
    resetMaxPanelCalls: [],
    resetMaxPanel(tab) {
        this.resetMaxPanelCalls.push(tab);
    }
};

const integration = new BonusSaveIntegration(app);
integration.applySaveContext(null, null);

assert.equal(app.maxTab, 'avail', 'clearing save returns max panel actions to available tab');
assert.deepEqual(app.data.sources, app.data._base_sources, 'clearing save restores base sources');
assert.deepEqual(app.parameters, [{ id: 'level', value: 1, built: true }], 'clearing save rebuilds parameters');
assert.deepEqual(app.resetMaxPanelCalls, ['actual'], 'clearing save resets actual max panel edits');

console.log('bonuses/app/saveIntegration.test.mjs passed');
