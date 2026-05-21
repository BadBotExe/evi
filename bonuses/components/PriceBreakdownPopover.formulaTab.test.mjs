import assert from 'node:assert/strict';
import { PriceBreakdownPopover } from './PriceBreakdownPopover.js';

assert.match(
    PriceBreakdownPopover.template,
    /<div v-if="!isTabActive\('formula'\)">[\s\S]*<div v-if="hasModifierFields" class="price-breakdown-range-card">[\s\S]*Cost Modifiers/,
    'price breakdown popover hides cost modifier controls while the formula tab is active'
);

assert.match(
    PriceBreakdownPopover.template,
    /v-for="section in combinedFormulaSections"/,
    'formula tab renders from the combined base and modifier formula section list'
);

assert.match(
    PriceBreakdownPopover.template,
    /v-else-if="tab\.id === 'formula'"[\s\S]*combinedFormulaSections/,
    'formula tab includes modifier formulas in the formula section list'
);

assert.match(
    PriceBreakdownPopover.template,
    /!hideSectionLabel\(combinedFormulaSections, section\.label\)/,
    'formula rows continue rendering the shared section heading slot'
);

console.log('bonuses/components/PriceBreakdownPopover.formulaTab.test.mjs passed');
