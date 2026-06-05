import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourceBreakdownMethods } from '../app/resourceBreakdown.js';
import { formulaMethods } from '../app/formula.js';

const bonfireSacrifice = JSON.parse(
    readFileSync(new URL('./bonfire_sacrifice.json', import.meta.url), 'utf8')
);

for (const source of bonfireSacrifice.bonuses) {
    const enhancement = source.enhancement;
    assert.ok(enhancement, `${source.id} must define enhancement costs`);
    assert.equal(typeof enhancement.$ref, 'string', `${source.id} enhancement must reuse a shared template`);
    assert.equal(typeof enhancement.$vars?.item, 'string', `${source.id} enhancement item placeholder must be a string`);
    assert.notEqual(enhancement.$vars.item.trim(), '', `${source.id} enhancement item placeholder must be non-empty`);
}

const context = {
    ...resourceBreakdownMethods,
    ...formulaMethods,
    _sourceResolver: {
        resolveSourceItemRef(source) { return source; },
        resolveImageAsset(_assetBasePath, _assetRef, assetPath) { return assetPath ?? null; },
        resolveBonusEntryAssetRefs(_assetBasePath, entry) { return entry; }
    },
    data: {
        items: new Map([
            ['TODO_MATERIAL', { id: 'TODO_MATERIAL', name: 'TODO Material' }],
            ['TODO_CRYSTALLIZED', { id: 'TODO_CRYSTALLIZED', name: 'TODO Crystallized' }],
            ['ash', { id: 'ash', name: 'Ash' }]
        ])
    },
    normalizeValue(value, digits = 2) {
        const multiplier = 10 ** digits;
        return Math.round(Number(value) * multiplier) / multiplier;
    }
};

const resolvedSources = resourceBreakdownMethods._resolveSourceRefs.call(
    context,
    bonfireSacrifice,
    './'
).bonuses;

const defaultSource = resolvedSources.find(source => source.id === 'bonfire_sacrifice_cutting_edge_technology');
const speedSource = resolvedSources.find(source => source.id === 'bonfire_sacrifice_wish_for_speed');
const goldSource = resolvedSources.find(source => source.id === 'bonfire_sacrifice_wish_for_gold');

const defaultBreakdown = context.getResourceBreakdown(defaultSource, 'enhancement', 1, 1);
assert.equal(defaultBreakdown.rows[0].costs[0].amount, 500);
assert.equal(defaultBreakdown.rows[0].costs[1].item, 'ash');
assert.equal(defaultBreakdown.rows[0].costs[1].amount, 250);
assert.equal(defaultSource.enhancement.max_level, 42);
assert.equal(defaultSource.enhancement.segments[0].to_level, 42);

const speedBreakdown = context.getResourceBreakdown(speedSource, 'enhancement', 1, 1);
assert.equal(speedBreakdown.rows[0].costs[0].amount, 500);
assert.equal(speedBreakdown.rows[0].costs[1].item, 'ash');
assert.equal(speedBreakdown.rows[0].costs[1].amount, 250);
assert.equal(speedSource.enhancement.max_level, 20);
assert.equal(speedSource.enhancement.segments[0].to_level, 20);

const goldBreakdown = context.getResourceBreakdown(goldSource, 'enhancement', 1, 1);
assert.equal(goldBreakdown.rows[0].costs[0].amount, 50);
assert.equal(goldBreakdown.rows[0].costs[1].item, 'ash');
assert.equal(goldBreakdown.rows[0].costs[1].amount, 250);
assert.equal(goldSource.enhancement.max_level, 42);
assert.equal(goldSource.enhancement.segments[0].to_level, 42);

const defaultFormulaView = context.getResourceBreakdownFormulaView(defaultSource, 'enhancement');
assert.match(defaultFormulaView.sections[0].costs[0].expression, /ceil\(500 \* 1\.3\^\(lvl - 1\)\)/);
assert.match(defaultFormulaView.sections[0].costs[1].expression, /250 \+ 50 \* \(lvl - 1\)/);

const goldFormulaView = context.getResourceBreakdownFormulaView(goldSource, 'enhancement');
assert.match(goldFormulaView.sections[0].costs[0].expression, /ceil\(50 \* 1\.11\^\(lvl - 1\)\)/);
assert.match(goldFormulaView.sections[0].costs[1].expression, /250 \+ 50 \* \(lvl - 1\)/);

console.log('bonuses/sources/bonfire_sacrifice.test.mjs passed');
