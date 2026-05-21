import assert from 'node:assert/strict';
import { PriceBreakdownPopover } from './PriceBreakdownPopover.js';

assert.match(
    PriceBreakdownPopover.template,
    /<div v-if="hasModifierFields" class="price-breakdown-range-card">[\s\S]*Cost Modifiers[\s\S]*v-for="modifier in modifierFields"/,
    'price breakdown popover renders shared cost modifier controls when a breakdown defines them'
);

assert.match(
    PriceBreakdownPopover.template,
    /v-model\.number="modifierValues\[modifier\.id\]"/,
    'price breakdown popover binds modifier inputs to local modifier state'
);

assert.match(
    PriceBreakdownPopover.template,
    /modifierFormulaRow\(modifier\.id\)\.expressionHtml \|\| modifierFormulaRow\(modifier\.id\)\.expression/,
    'price breakdown popover renders the modifier formula inside the cost modifiers block'
);

assert.equal(
    PriceBreakdownPopover.methods.clampModifierInput.call(
        {
            app: {
                _resourceBreakdownModifierPrecision() { return null; }
            }
        },
        { id: 'hunter_cost_reduction', min: 0, max: null, default: 0, step: 1 },
        50
    ),
    50,
    'modifier inputs without a max keep entered values instead of collapsing to zero'
);

{
    let synced = 0;
    let persisted = null;
    const state = {
        modifierValues: { hunter_cost_reduction: 50 },
        app: {
            setResourceBreakdownModifierValue(src, kind, modifierId, value) {
                persisted = { src, kind, modifierId, value };
            },
            syncUrl() {
                synced += 1;
            },
            _resourceBreakdownModifierPrecision() {
                return null;
            }
        },
        src: { id: 'hunter_upgrades_endurance_training' },
        kind: 'enhancement',
        clampModifierInput: PriceBreakdownPopover.methods.clampModifierInput
    };

    PriceBreakdownPopover.methods.normalizeModifierValue.call(
        state,
        { id: 'hunter_cost_reduction', min: 0, max: null, default: 0, step: 1 }
    );

    assert.deepEqual(
        persisted,
        {
            src: { id: 'hunter_upgrades_endurance_training' },
            kind: 'enhancement',
            modifierId: 'hunter_cost_reduction',
            value: 50
        },
        'modifier changes are persisted into app state'
    );
    assert.equal(synced, 1, 'modifier changes sync the URL');
}

console.log('bonuses/components/PriceBreakdownPopover.test.mjs passed');
