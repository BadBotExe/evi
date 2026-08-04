import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bonusMethods } from '../app/bonuses.js';
import { itemBonusMethods } from '../app/ItemBonus.js';
import { formulaMethods } from '../app/formula.js';
import { resourceBreakdownMethods } from '../app/resourceBreakdown.js';

const hourglassTimeline = JSON.parse(
    readFileSync(new URL('./hourglass_timeline.json', import.meta.url), 'utf8')
);

assert.equal(hourglassTimeline.bonuses.length, 22, 'timeline CharacterStat upgrades are collapsed into 22 groups');

for (const source of hourglassTimeline.bonuses) {
    assert.equal(source.category, 'hourglass_timeline');
    const prices = source.enhancement?.segments?.[0]?.costs?.[0]?.amount?.values;
    const bonus = source.bonuses[0];

    assert.equal(source.enhancement?.level_label, 'Node', `${source.id} price breakdown must label levels as nodes`);
    assert.equal(source.bonuses.length, 1, `${source.id} must collapse equal nodes into one bonus entry`);
    assert.ok(bonus.tiers_formula, `${source.id} must use progression-style tiers_formula`);
    assert.ok(Array.isArray(prices), `${source.id} must use table prices`);
    assert.equal(bonus.tiers_formula.max_tier, prices.length, `${source.id} formula max tier and prices must align per node`);
    assert.equal(source.enhancement.max_level, prices.length, `${source.id} max level must match real node count`);
    assert.equal(prices.some(price => Number(price) >= 1e50), false, `${source.id} must not include fake prices`);
    assert.notEqual(bonus.tiers_formula.type, 'table', `${source.id} must not use table formulas for timeline bonuses`);
}

const pdef = hourglassTimeline.bonuses.find(source => source.id === 'hourglass_timeline_pdef');
const resolvedPdef = { ...pdef, _file_tiers_formula: hourglassTimeline.tiers_formula };
assert.ok(pdef, 'PDef timeline group must exist');
assert.deepEqual(
    [pdef.bonuses[0].label, pdef.bonuses[0].unit_type, pdef.bonuses[0].tiers_formula],
    ['Nodes 1-7', 'multiplier', { type: 'exponential', init: 1, growth: 1.1, max_tier: 7 }],
    'PercentMult value 10 is represented as multiplicative x1.1 nodes'
);
assert.deepEqual(
    pdef.enhancement.segments[0].costs[0].amount.values,
    [243, 877, 10261, 95259, 687988, 901475, 6879877],
    'collapsed PDef nodes keep real prices sorted from lower to higher'
);

const goldMultiplier = hourglassTimeline.bonuses.find(source => source.id === 'hourglass_timeline_gold_multiplier');
assert.ok(goldMultiplier, 'GoldMultiplier timeline group must exist');
assert.deepEqual(
    [goldMultiplier.bonuses[0].label, goldMultiplier.bonuses[0].unit_type, goldMultiplier.bonuses[0].tiers_formula],
    ['Nodes 1-3', 'percent', { coeff: 10, max_tier: 3 }],
    'Base +10% timeline stats are represented as percent bonuses'
);

const displayContext = {
    ...bonusMethods,
    ...itemBonusMethods,
    ...formulaMethods,
    ...resourceBreakdownMethods,
    data: {
        bonus_types: [
            { id: 'combat_experience', units: { percent: '%' } },
            { id: 'phys_defence', units: { multiplier: '' } }
        ],
        items: new Map([
            ['sands_of_time', { id: 'sands_of_time', name: 'Sands of Time' }]
        ])
    },
    normalizeValue(value, digits = 2) {
        const multiplier = 10 ** digits;
        return Math.round(Number(value) * multiplier) / multiplier;
    },
    bonusDisplayDecimals() {
        return 2;
    },
    unitFor(bonusId, unitType) {
        if (unitType === 'percent') return '%';
        return '';
    },
    _resolveResourceBreakdownImage() {
        return null;
    }
};

assert.equal(
    displayContext._formatItemFormulaValueRange(resolvedPdef, pdef.bonuses[0]),
    'x1.1 -> x1.95',
    'timeline multiplier groups display as a min/max formula range'
);
const combatExp = hourglassTimeline.bonuses.find(source => source.id === 'hourglass_timeline_combat_exp');
const resolvedCombatExp = { ...combatExp, _file_tiers_formula: hourglassTimeline.tiers_formula };
assert.equal(
    displayContext.resolveSourceBonusValue(resolvedPdef, pdef.bonuses[0]),
    1.1 ** 7,
    'collapsed multiplier timeline nodes multiply instead of adding'
);
assert.equal(
    displayContext._formatItemFormulaValueRange(resolvedCombatExp, combatExp.bonuses[0]),
    '+20% -> +60%',
    'timeline percent groups display as a min/max formula range'
);
assert.equal(
    displayContext.getResourceBreakdownDisplayConfig(pdef, 'enhancement').level_label,
    'Node',
    'timeline price breakdown config uses node labels'
);
assert.deepEqual(
    displayContext.getResourceBreakdownLevelsView(pdef, 'enhancement').rows.map(row => row.level),
    [1, 2, 3, 4, 5, 6, 7],
    'timeline price breakdown still exposes each node price row'
);
assert.deepEqual(
    displayContext.getResourceBreakdownTotalsView(pdef, 'enhancement').groups.map(group => group.label),
    ['Node 1-7'],
    'timeline price breakdown totals use node range labels'
);

console.log('bonuses/sources/hourglass_timeline.test.mjs passed');
