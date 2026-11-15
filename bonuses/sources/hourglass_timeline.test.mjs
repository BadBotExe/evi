import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bonusMethods } from '../app/bonuses.js';
import { itemBonusMethods } from '../app/ItemBonus.js';
import { formulaMethods } from '../app/formula.js';

const hourglassTimeline = JSON.parse(
    readFileSync(new URL('./hourglass_timeline.json', import.meta.url), 'utf8')
);

assert.equal(hourglassTimeline.bonuses.length, 23, 'timeline upgrades are collapsed into 23 existing groups');

for (const source of hourglassTimeline.bonuses) {
    assert.equal(source.category, 'hourglass_timeline');
    assert.equal(source.enhancement, undefined, `${source.id} must not expose timeline node prices`);
    assert.ok(source.bonuses.length > 0, `${source.id} must expose at least one bonus segment`);
    for (const bonus of source.bonuses) {
        assert.ok(bonus.tiers_formula, `${source.id} must use progression-style tiers_formula`);
        assert.notEqual(bonus.tiers_formula.type, 'table', `${source.id} must not use table formulas`);
    }
}

const pdef = hourglassTimeline.bonuses.find(source => source.id === 'hourglass_timeline_pdef');
const resolvedPdef = { ...pdef, _file_tiers_formula: hourglassTimeline.tiers_formula };
assert.ok(pdef, 'PDef timeline group must exist');
assert.deepEqual(
    [pdef.bonuses[0].label, pdef.bonuses[0].unit_type, pdef.bonuses[0].tiers_formula],
    ['Nodes 1-10', 'multiplier', { type: 'exponential', init: 1, growth: 1.1, max_tier: 10 }],
    'all ten PDef nodes are represented as multiplicative x1.1 nodes'
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
};

assert.equal(
    displayContext._formatItemFormulaValueRange(resolvedPdef, pdef.bonuses[0]),
    'x1.1 -> x2.59',
    'timeline multiplier groups display as a min/max formula range'
);
const combatExp = hourglassTimeline.bonuses.find(source => source.id === 'hourglass_timeline_combat_exp');
const resolvedCombatExp = { ...combatExp, _file_tiers_formula: hourglassTimeline.tiers_formula };
assert.equal(
    displayContext.resolveSourceBonusValue(resolvedPdef, pdef.bonuses[0]),
    1.1 ** 10,
    'collapsed multiplier timeline nodes multiply instead of adding'
);
assert.equal(
    displayContext._formatItemFormulaValueRange(resolvedCombatExp, combatExp.bonuses[0]),
    '+20% -> +60%',
    'timeline percent groups display as a min/max formula range'
);

const expectedExpandedGroups = {
    hourglass_timeline_pdef: 10,
    hourglass_timeline_patk: 7,
    hourglass_timeline_crit_chance: 6,
    hourglass_timeline_crit_damage: 9,
    hourglass_timeline_max_hp: 5,
    hourglass_timeline_max_mana: 5
};
for (const [id, expectedNodes] of Object.entries(expectedExpandedGroups)) {
    const source = hourglassTimeline.bonuses.find(value => value.id === id);
    assert.ok(source, `${id} must exist`);
    const actualNodes = source.bonuses.reduce((sum, bonus) => sum + bonus.tiers_formula.max_tier, 0);
    assert.equal(actualNodes, expectedNodes, `${id} must include every currently available node`);
}

console.log('bonuses/sources/hourglass_timeline.test.mjs passed');
