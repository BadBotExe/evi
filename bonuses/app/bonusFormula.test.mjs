import assert from 'node:assert/strict';
import { bonusMethods } from './bonuses.js';
import { itemBonusMethods } from './ItemBonus.js';

assert.equal(
    bonusMethods._applyFormula({ type: 'exponential', init: 3750, growth: 1.1, max_tier: 1, init_at_unlock_tier: true }, 1),
    3750,
    'exponential formula keeps init value at level 1'
);

assert.ok(
    Math.abs(
        bonusMethods._applyFormula({ type: 'exponential', init: 3750, growth: 1.1, max_tier: 50, init_at_unlock_tier: true }, 1)
        - 400196.08936259925
    ) < 1e-9,
    'exponential formula applies growth once per level after level 1'
);

assert.equal(
    bonusMethods._applyFormula({ type: 'exponential', init: 80, growth: 1.1, max_tier: 30, init_at_unlock_tier: true, rounding: 'ceil' }, 1),
    1270,
    'exponential formula supports existing formula rounding modes'
);

const itemBonusContext = {
    ...bonusMethods,
    ...itemBonusMethods,
    data: {
        bonus_types: [
            { id: 'sands_of_time_per_hour', units: { flat: '' } }
        ]
    },
    normalizeValue(value, digits = 2) {
        const multiplier = 10 ** digits;
        return Math.round(Number(value) * multiplier) / multiplier;
    },
    bonusDisplayDecimals() {
        return 2;
    },
    unitFor() {
        return '';
    }
};

const sandsPerHour = {
    bonus: 'sands_of_time_per_hour',
    unit_type: 'flat',
    tiers_formula: {
        type: 'exponential',
        init: 3750,
        growth: 1.1,
        max_tier: 50,
        init_at_unlock_tier: true
    }
};

assert.equal(
    itemBonusContext._formatItemFormulaValueRange({ tiers_formula: { label_prefix: 'Level' } }, sandsPerHour),
    '+3,750 -> +400,196.09',
    'item bonus range renders first and last exponential tier values'
);

console.log('bonuses/app/bonusFormula.test.mjs passed');
