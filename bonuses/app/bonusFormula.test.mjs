import assert from 'node:assert/strict';
import { bonusMethods } from './bonuses.js';
import { itemBonusMethods } from './ItemBonus.js';
import { formulaMethods } from './formula.js';

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
    ...formulaMethods,
    data: {
        tier_preview_limit: 5,
        bonus_types: [
            { id: 'sands_of_time_per_hour', units: { flat: '' } },
            { id: 'rift_xp_required', units: { flat: '' } }
        ]
    },
    tierPopoverColThreshold: 10,
    tierTabSelections: {},
    tierPreviewExpansions: {},
    selectedBonus: 'sands_of_time_per_hour',
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
const xpRequired = {
    bonus: 'rift_xp_required',
    unit_type: 'flat',
    label: 'XP Required',
    tiers_formula: {
        type: 'exponential',
        init: 300,
        growth: 1.1,
        max_tier: 50,
        init_at_unlock_tier: true
    },
    show_tier_formula: true,
    show_tier_totals: true
};
const expectedSandsRange = itemBonusContext.formatBonusValueRange(
    sandsPerHour.bonus,
    sandsPerHour.unit_type,
    3750,
    400196.08936259925
);

assert.equal(
    itemBonusContext._formatItemFormulaValueRange({ tiers_formula: { label_prefix: 'Level' } }, sandsPerHour),
    expectedSandsRange,
    'item bonus range renders first and last exponential tier values'
);

assert.deepEqual(
    itemBonusContext.tierFormulaSections({ tiers_formula: { label_prefix: 'Level' } }, sandsPerHour),
    [],
    'tier formula sections are hidden unless enabled by JSON'
);

const [formulaSection] = itemBonusContext.tierFormulaSections(
    { tiers_formula: { label_prefix: 'Level' } },
    { ...sandsPerHour, show_tier_formula: true }
);
assert.deepEqual(
    formulaSection.costs.map(cost => [cost.label, cost.expression]),
    [
        ['Formula', '3750 * 1.1^(Level - 1)']
    ],
    'tier formula sections contain only formula rows'
);
assert.match(
    formulaSection.costs[0].expressionHtml,
    /price-breakdown-formula-math/,
    'tier formula expression is formatted by the shared formula renderer'
);
assert.equal(
    formulaSection.costs.some(cost => cost.label === 'Range'),
    false,
    'tier formula tab does not duplicate the value range'
);

const tierEntry = {
    src: {
        id: 'hourglass_sands_of_time_rift',
        tiers_formula: { label_prefix: 'Level' },
        bonuses: [{ ...sandsPerHour, show_tier_formula: true }]
    },
    bonuses: [{ ...sandsPerHour, show_tier_formula: true }]
};
let [tierGroup] = itemBonusContext.getTierGroups(tierEntry);
assert.deepEqual(
    tierGroup.tabs.map(tab => [tab.label, tab.kind]),
    [
        ['Levels', 'levels'],
        ['Formula', 'formula']
    ],
    'tier popover exposes Formula as a normal tab when JSON enables it'
);
assert.equal(tierGroup.activeTab.label, 'Levels', 'tier popover opens on levels by default');

itemBonusContext.setActiveTierTab(tierEntry, tierEntry.bonuses[0], 'Formula');
[tierGroup] = itemBonusContext.getTierGroups(tierEntry);
assert.equal(tierGroup.activeTab.kind, 'formula', 'tier popover can switch to formula tab through existing tab state');

const previousTierPopoverColThreshold = itemBonusContext.tierPopoverColThreshold;
itemBonusContext.tierPopoverColThreshold = 3;
assert.equal(
    itemBonusContext.tierPopoverUsesTwoCol(tierEntry),
    true,
    'tier popover wide state is based on group data instead of active tab DOM'
);
itemBonusContext.tierPopoverColThreshold = previousTierPopoverColThreshold;

const xpTierEntry = {
    src: {
        id: 'hourglass_sands_of_time_rift',
        tiers_formula: { label_prefix: 'Level' },
        bonuses: [xpRequired]
    },
    bonuses: [xpRequired]
};
const [xpTierGroup] = itemBonusContext.getTierGroups(xpTierEntry);
assert.deepEqual(
    xpTierGroup.tabs.map(tab => [tab.label, tab.kind]),
    [
        ['Levels', 'levels'],
        ['Totals', 'totals'],
        ['Formula', 'formula']
    ],
    'rift XP required exposes Totals through the existing tier tab system'
);
assert.deepEqual(
    itemBonusContext.tierTotalsForRange(xpTierEntry.src, xpRequired, 1, 3).map(cost => [cost.label, cost.amount]),
    [['XP Required', 993]],
    'rift XP required totals sum the per-level formula values over the selected range'
);

console.log('bonuses/app/bonusFormula.test.mjs passed');
