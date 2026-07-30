import assert from 'node:assert/strict';
import { PriceBreakdownPopover } from './PriceBreakdownPopover.js';
import { FormulaSections } from './FormulaSections.js';

assert.match(
    PriceBreakdownPopover.template,
    /<div v-if="!isTabActive\('formula'\)">[\s\S]*<div v-if="hasModifierFields" class="price-breakdown-range-card">[\s\S]*Cost Modifiers/,
    'price breakdown popover hides cost modifier controls while the formula tab is active'
);

assert.match(
    PriceBreakdownPopover.template,
    /<formula-sections :sections="combinedFormulaSections" :app="app"><\/formula-sections>/,
    'formula tab renders through the shared formula sections component'
);

assert.match(
    PriceBreakdownPopover.template,
    /v-else-if="tab\.id === 'formula'"[\s\S]*<formula-sections :sections="combinedFormulaSections"/,
    'formula tab includes modifier formulas in the formula section list'
);

assert.equal(
    PriceBreakdownPopover.components.FormulaSections.template,
    FormulaSections.template,
    'price breakdown popover uses the shared formula sections component'
);

console.log('bonuses/components/PriceBreakdownPopover.formulaTab.test.mjs passed');
