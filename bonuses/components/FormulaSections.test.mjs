import assert from 'node:assert/strict';
import { FormulaSections } from './FormulaSections.js';

assert.match(
    FormulaSections.template,
    /class="price-breakdown-formula-list"/,
    'formula sections render the existing formula list container'
);

assert.match(
    FormulaSections.template,
    /section\.kind === 'static'/,
    'formula sections preserve the existing static resource row branch'
);

assert.match(
    FormulaSections.template,
    /price-breakdown-cost-formula-text" v-html="cost\.expressionHtml \|\| cost\.expression"/,
    'formula sections preserve formatted expression rendering'
);

assert.equal(
    FormulaSections.methods.showSectionLabel.call(
        {
            sections: [{ label: 'Only', costs: [] }],
            hideSingleLabel: true,
            app: null
        },
        { label: 'Only' }
    ),
    false,
    'formula sections can hide a single data-table label'
);

assert.equal(
    FormulaSections.methods.costClasses.call({ costClass: 'data-table-cost-formula' }, { kind: 'formula' }),
    'item-popover-row item-popover-row-formula price-breakdown-cost-formula data-table-cost-formula',
    'formula sections append caller-specific cost classes'
);

console.log('bonuses/components/FormulaSections.test.mjs passed');
