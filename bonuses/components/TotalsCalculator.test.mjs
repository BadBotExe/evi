import assert from 'node:assert/strict';
import { TotalsCalculator } from './TotalsCalculator.js';

assert.match(
    TotalsCalculator.template,
    /class="price-breakdown-range-card"/,
    'totals calculator reuses the existing range calculator shell'
);

assert.match(
    TotalsCalculator.template,
    /class="engineering-input price-breakdown-range-input"/,
    'totals calculator reuses the existing level range inputs'
);

assert.match(
    TotalsCalculator.template,
    /class="price-breakdown-totals price-breakdown-totals-custom"/,
    'totals calculator reuses the existing custom totals output'
);

assert.doesNotMatch(
    TotalsCalculator.template,
    /v-if="cost\.image" class="price-breakdown-cost-icon"/,
    'totals calculator keeps the icon column even when the caller has no image'
);

assert.equal(
    TotalsCalculator.methods.clampLevelInput.call({ maxLevel: 30 }, 40, 1),
    30,
    'totals calculator clamps selected levels to maxLevel'
);

assert.equal(
    TotalsCalculator.methods.costAmountText.call({ app: { formatResourceBreakdownAmount: value => `fmt:${value}` } }, { amount: 42 }),
    'fmt:42',
    'totals calculator reuses the app resource amount formatter by default'
);

assert.equal(
    TotalsCalculator.methods.costAmountText.call({ app: { formatResourceBreakdownAmount: value => `fmt:${value}` } }, { amount: 42, amountText: '42 XP' }),
    '42 XP',
    'totals calculator supports caller-formatted amounts'
);

console.log('bonuses/components/TotalsCalculator.test.mjs passed');
