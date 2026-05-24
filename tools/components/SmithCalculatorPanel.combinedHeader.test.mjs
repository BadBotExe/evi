import assert from 'node:assert/strict';

import { SmithCalculatorPanel } from './SmithCalculatorPanel.js';

const template = SmithCalculatorPanel.template;

assert.doesNotMatch(
    template,
    /<template v-if="selectedRows\.length && isCombinedMode\(\)">[\s\S]*?<div class="smith-section-label">Combined Resources<\/div>/,
    'combined resources table should not render its header label'
);

console.log('tools/components/SmithCalculatorPanel.combinedHeader.test.mjs passed');
