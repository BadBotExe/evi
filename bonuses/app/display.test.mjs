import assert from 'node:assert/strict';
import { displayMethods } from './display.js';

const app = {
    selectedBonus: 'smeltery_speed',
    data: {
        bonus_types: [
            {
                id: 'smeltery_speed',
                units: {
                    flat: '',
                    percent: '%',
                    multiplier: ''
                }
            }
        ]
    },
    groupedSources: {},
    _escapeHtml(value) {
        return String(value);
    },
    _compoundRuleForBonus() {
        return null;
    }
};

Object.assign(app, displayMethods);

const percentAndMultiplierOnlyResult = {
    value: 4488,
    unit_type: 'percent',
    isMixed: true,
    flat: 0,
    percent: 1496,
    percentStages: {},
    multiplier: 3
};

assert.deepEqual(
    app.formatCompoundBreakdownColumns(percentAndMultiplierOnlyResult).map(entry => entry.label),
    ['%', 'Multiplier'],
    'compound total columns skip synthetic flat zero when total has only percent and multiplier'
);

assert.deepEqual(
    app.formatCompoundBreakdownColumns(percentAndMultiplierOnlyResult).map(entry => entry.value),
    [
        app.formatBonusValue(1496, 'smeltery_speed', 'percent'),
        app.formatBonusValue(3, 'smeltery_speed', 'multiplier')
    ],
    'compound total columns keep percent and multiplier values intact'
);

assert.deepEqual(
    app.formatCompoundBreakdownRows(percentAndMultiplierOnlyResult).map(entry => entry.text),
    [
        app.formatBonusValue(1496, 'smeltery_speed', 'percent'),
        app.formatBonusValue(3, 'smeltery_speed', 'multiplier')
    ],
    'compound total rows skip synthetic flat zero when total has only percent and multiplier'
);

console.log('bonuses/app/display.test.mjs passed');
