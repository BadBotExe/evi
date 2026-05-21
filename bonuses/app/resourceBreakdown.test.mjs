import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourceBreakdownMethods } from './resourceBreakdown.js';
import { formulaMethods } from './formula.js';

const hunterUpgrades = JSON.parse(
    readFileSync(new URL('../sources/hunter_upgrades.json', import.meta.url), 'utf8')
);
const items = JSON.parse(
    readFileSync(new URL('../../items/items.json', import.meta.url), 'utf8')
);

const resolvedSources = resourceBreakdownMethods._resolveSourceRefs.call({
    ...resourceBreakdownMethods,
    _sourceResolver: {
        resolveSourceItemRef(source) { return source; },
        resolveImageAsset(_assetBasePath, _assetRef, assetPath) { return assetPath ?? null; },
        resolveBonusEntryAssetRefs(_assetBasePath, entry) { return entry; }
    }
}, hunterUpgrades, './').bonuses;
const resolvedSource = resolvedSources.find(source => source.id === 'hunter_upgrades_endurance_training');
const resolvedMovementSpeedSource = resolvedSources.find(source => source.id === 'hunter_upgrades_movement_speed_training');
const configuredModifierKeys = hunterUpgrades.cost_modifiers;

const context = {
    ...resourceBreakdownMethods,
    ...formulaMethods,
    data: {
        bonus_types: [
            { id: 'hunter_cost_reduction', key: 'cr' }
        ],
        sources: [resolvedSource],
        items: items.reduce((acc, item) => acc.set(item.id, item), new Map())
    },
    _sourceResolver: {
        resolveImageAsset(_assetBasePath, _assetRef, assetPath) { return assetPath ?? null; }
    },
    normalizeValue(value, digits = 2) {
        const multiplier = 10 ** digits;
        return Math.round(Number(value) * multiplier) / multiplier;
    }
};

const modifiers = context.getResourceBreakdownCostModifiers(resolvedSource, 'enhancement');
assert.deepEqual(
    modifiers.map(modifier => modifier.id),
    ['hunter_cost_breakdown', 'hunter_cost_reduction'],
    'hunter upgrades expose the configured cost modifiers in the declared order'
);
assert.deepEqual(
    modifiers.map(modifier => modifier.key),
    [
        configuredModifierKeys.hunter_cost_breakdown.key,
        configuredModifierKeys.hunter_cost_reduction.key
    ],
    'resource breakdown modifiers expose the configured compact URL keys'
);

const baseBreakdown = context.getResourceBreakdown(resolvedSource, 'enhancement', 1, 1);
assert.equal(baseBreakdown.rows[0].costs[0].amount, 1.7);

const modifiedBreakdown = context.getResourceBreakdown(
    resolvedSource,
    'enhancement',
    1,
    1,
    {
        hunter_cost_breakdown: 20,
        hunter_cost_reduction: 50
    }
);
assert.ok(
    Math.abs(modifiedBreakdown.rows[0].costs[0].amount - (1.7 * 0.8 * 100 / 150)) < 1e-9,
    'hunter modifiers are applied in declared order to the computed level cost'
);

const formulaView = context.getResourceBreakdownFormulaView(
    resolvedSource,
    'enhancement',
    {
        hunter_cost_breakdown: 20,
        hunter_cost_reduction: 50
    }
);
assert.match(
    formulaView.sections[0].costs[0].expression,
    /1\.7 \* 1\.7\^\(lvl - 1\)/,
    'formula view keeps the base price formula unchanged'
);
assert.equal(formulaView.sections.length, 1, 'formula view does not append cost modifiers as extra formula sections');

const movementSpeedBreakdown = context.getResourceBreakdown(resolvedMovementSpeedSource, 'enhancement', 1, 1);
const movementSpeedFormula = resolvedMovementSpeedSource.enhancement.segments[0].costs[0].amount;
const movementSpeedLevelOneExpected = Number(movementSpeedFormula.base ?? 0)
    * Math.pow(Number(movementSpeedFormula.growth ?? 1), 1 - Number(movementSpeedFormula.level_offset ?? 1));
assert.ok(
    Math.abs(movementSpeedBreakdown.rows[0].costs[0].amount - movementSpeedLevelOneExpected) < 1e-9,
    'movement speed training level 1 cost matches its configured exponential formula'
);
const movementSpeedFormulaView = context.getResourceBreakdownFormulaView(
    resolvedMovementSpeedSource,
    'enhancement'
);
assert.match(
    movementSpeedFormulaView.sections[0].costs[0].expression,
    /900 \* 1\.55\^lvl/,
    'movement speed training formula view renders its inline exponential formula'
);

const modifierFormulaRows = context.getResourceBreakdownCostModifierFormulaRows(
    resolvedSource,
    'enhancement',
    {
        hunter_cost_breakdown: 20,
        hunter_cost_reduction: 50
    }
);
assert.match(
    modifierFormulaRows[0].expression,
    /Price \* \(100 - Breakdown\) \/ 100/,
    'breakdown modifier exposes its own symbolic formula'
);
assert.match(
    modifierFormulaRows[1].expression,
    /Price \* 100 \/ \(100 \+ Reduction\)/,
    'reduction modifier exposes its own symbolic formula'
);

context.resourceBreakdownModifierValues = {
    hunter_cost_breakdown: 20,
    hunter_cost_reduction: 50
};
assert.deepEqual(
    context.getPersistedResourceBreakdownModifierValues(),
    {
        hunter_cost_breakdown: 20,
        hunter_cost_reduction: 50
    },
    'persisted modifier values keep only non-default normalized entries'
);

context.setResourceBreakdownModifierValue(resolvedSource, 'enhancement', 'hunter_cost_breakdown', 0);
context.setResourceBreakdownModifierValue(resolvedSource, 'enhancement', 'hunter_cost_reduction', 50);
assert.deepEqual(
    context.resourceBreakdownModifierValues,
    {
        hunter_cost_reduction: 50
    },
    'setting a modifier drops default values and keeps non-default values for URL persistence'
);

console.log('bonuses/app/resourceBreakdown.test.mjs passed');
