import assert from 'node:assert/strict';

import { SmithCalculatorPanel } from './SmithCalculatorPanel.js';

const template = SmithCalculatorPanel.template;

assert.match(
    template,
    /<sprite-image v-if="item\.image" :image="item\.image" :alt="item\.name" img-class="tools-picker-option-image"><\/sprite-image>/,
    'picker rows should pass item images through the SpriteImage image prop'
);

assert.match(
    template,
    /<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="smith-item-image"><\/sprite-image>/,
    'selected rows should pass item images through the SpriteImage image prop'
);

assert.match(
    template,
    /<sprite-image v-if="section\.row\.item\?\.image" :image="section\.row\.item\.image" :alt="section\.row\.item\.name" img-class="smith-item-image"><\/sprite-image>/,
    'per-item sections should pass item images through the SpriteImage image prop'
);

assert.match(
    template,
    /<div class="tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection\(section\.row\.id\)">[\s\S]*?<div class="smith-cell-frame tools-selected-thumb tools-per-item-head-thumb">[\s\S]*?<\/div>[\s\S]*?<div class="tools-per-item-main">[\s\S]*?<div class="tools-selected-name">\{\{ section\.row\.item\?\.name \?\? section\.row\.itemId \}\}<\/div>[\s\S]*?<div class="smith-ingredient-hint">\{\{ formatQty\(section\.row\.quantity\) \}\} item\(s\)<\/div>[\s\S]*?<\/div>[\s\S]*?<div class="tools-per-item-head-spacer" aria-hidden="true"><\/div>[\s\S]*?<div class="tools-per-item-head-control">\s*<span class="section-chev" :class="\{ collapsed: isPerItemSectionCollapsed\(section\.row\.id\) \}">&#x25BC;<\/span>\s*<\/div>/,
    'per-item headers should use the same four-track layout as tree rows, including the fixed metrics spacer and chevron control track'
);

assert.match(
    template,
    /<tr v-for="row in combinedRows"[\s\S]*?<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="smith-item-image"><\/sprite-image>/,
    'combined resources rows should render item images'
);

assert.match(
    template,
    /<th aria-label="Item"><\/th>\s*<th class="tools-number-col">Required<\/th>\s*<th class="tools-number-col tools-owned-col-head">Owned<\/th>\s*<th class="tools-number-col tools-needed-col">Needed<\/th>\s*<th class="tools-number-col tools-percent-col" aria-label="% Covered"><\/th>[\s\S]*?<tr v-for="row in combinedRows"[\s\S]*?<td class="tools-number-col">\s*<span class="tools-ratio-value">\{\{ formatQty\(row\.required\) \}\}<\/span>\s*<\/td>[\s\S]*?<td class="tools-number-col">[\s\S]*?<div class="tools-number-input-actions">[\s\S]*?@click="setOwnedMin\(row\.itemId\)">Min<\/button>[\s\S]*?:value="state\.owned\[row\.itemId\] \?\? 0"[\s\S]*?@click="setOwnedMax\(row\)">Max<\/button>[\s\S]*?<\/div>[\s\S]*?<\/td>[\s\S]*?<td class="tools-number-col tools-needed-col">\s*<span class="tools-ratio-value">\{\{ formatQty\(row\.missing\) \}\}<\/span>\s*<\/td>[\s\S]*?<td class="tools-number-col tools-percent-col">[\s\S]*?<span class="tools-summary-badge tools-inline-summary-badge tools-percent-badge"[\s\S]*?:class="percentBadgeClasses\(row\)">\{\{ row\.percentLabel \}\}<\/span>/,
    'combined resources should render Required, Owned, Needed, mark the Owned header for left alignment, expose a dedicated Needed column for mobile control, keep min/input/max in the owned column, and pin coverage to a fixed percent column'
);

assert.doesNotMatch(
    template,
    /<div class="tools-result-card-head">[\s\S]*?<div class="smith-section-label">Combined Resources<\/div>[\s\S]*?<div class="tools-summary-badge">\{\{ combinedCoverageSummary\(\) \}\}<\/div>/,
    'combined resources header should not render the overall % covered badge'
);

assert.match(
    template,
    /<tr v-for="row in combinedTimingRows"[\s\S]*?<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="smith-item-image"><\/sprite-image>/,
    'timing rows should render item images'
);

assert.match(
    template,
    /<div v-for="resource in section\.rows"[\s\S]*?:class="\{ 'is-craftable': resource\.hasChildren, 'tools-per-item-tree-toggle': resource\.hasChildren \}"[\s\S]*?<sprite-image v-if="resource\.item\?\.image" :image="resource\.item\.image" :alt="resource\.item\.name" img-class="smith-ingredient-image"><\/sprite-image>/,
    'per-item resource rows should render item images'
);

assert.match(
    template,
    /<div v-show="!isPerItemSectionCollapsed\(section\.row\.id\)" class="tools-per-item-tree">[\s\S]*?class="smith-ingredient tools-per-item-tree-row"[\s\S]*?:class="\{ 'is-craftable': resource\.hasChildren, 'tools-per-item-tree-toggle': resource\.hasChildren \}"[\s\S]*?@click="resource\.hasChildren \? togglePerItemTreeRow\(section\.row\.id, resource\.path\) : null"[\s\S]*?<div class="smith-ingredient-body tools-per-item-tree-body">[\s\S]*?<div class="smith-ingredient-quantity tools-per-item-tree-metrics">[\s\S]*?<span class="tools-per-item-tree-metric tools-per-item-tree-metric-ratio">\{\{ formatQty\(resource\.ownedUsed\) \}\}\/\{\{ formatQty\(resource\.required\) \}\}<\/span>[\s\S]*?<span class="tools-summary-badge tools-inline-summary-badge tools-percent-badge"[\s\S]*?:class="percentBadgeClasses\(resource\)">\{\{ resource\.percentLabel \}\}<\/span>[\s\S]*?<\/div>[\s\S]*?<div class="tools-per-item-tree-control">\s*<span v-if="resource\.hasChildren"[\s\S]*?class="section-chev tools-per-item-tree-chev"[\s\S]*?:class="\{ collapsed: resource\.isCollapsed \}">&#x25BC;<\/span>\s*<\/div>/,
    'per-item resources should keep the smith-style tree, allow collapse from the full craftable row, and place the chevron in its own fixed control column'
);

assert.match(
    template,
    /<th aria-label="Item"><\/th>\s*<th class="tools-selected-col-qty">Qty<\/th>\s*<th class="tools-selected-col-remove" aria-label="Remove"><\/th>/,
    'selected recipe table should omit the visible Item and Remove column labels'
);

assert.match(
    template,
    /<td class="tools-selected-col-remove">\s*<button type="button"\s*class="engineering-card-badge tools-remove-badge"\s*aria-label="Remove recipe"\s*@click="app\.removeSmithCalculatorRow\(row\.id\)">×<\/button>\s*<\/td>/,
    'selected recipe rows should render a dedicated destructive × button pinned to the right-aligned remove column'
);

assert.match(
    template,
    /setSmithCalculatorBreakdownMode\('combined'\).*setSmithCalculatorBreakdownMode\('per-item'\).*setSmithCalculatorBreakdownMode\('timing'\)/s,
    'smith calculator should expose Combined, Per Item, and then Smeltery Time modes'
);

assert.match(
    template,
    /<template v-if="selectedRows\.length && isTimingMode\(\)">[\s\S]*?<div class="smith-section-label">Smeltery Time<\/div>[\s\S]*?<\/template>/,
    'Smeltery Time should render in its own dedicated mode'
);

assert.match(
    template,
    /<template v-if="selectedRows\.length && isTimingMode\(\)">[\s\S]*?<th aria-label="Item"><\/th>\s*<th class="tools-number-col">Crafts<\/th>\s*<th class="tools-number-col">Out<\/th>\s*<th class="tools-number-col">Time<\/th>[\s\S]*?<tr v-for="row in combinedTimingRows"[\s\S]*?<td[\s\S]*?<\/td>\s*<td class="tools-number-col">\{\{ formatQty\(row\.craftCount\) \}\}<\/td>\s*<td class="tools-number-col">\{\{ formatQty\(row\.requiredQuantity\) \}\}<\/td>\s*<td class="tools-number-col">\{\{ row\.totalTimeLabel \}\}<\/td>/,
    'Smeltery Time should keep the hidden item column and only swap Crafts with Out'
);

assert.match(
    template,
    /tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection\(section\.row\.id\)"/,
    'per-item cards should toggle collapse from their header'
);

assert.match(
    template,
    /<span class="section-chev" :class="\{ collapsed: isPerItemSectionCollapsed\(section\.row\.id\) \}">&#x25BC;<\/span>/,
    'per-item cards should use the shared section chevron collapse pattern'
);

assert.match(
    template,
    /<div v-show="!isPerItemSectionCollapsed\(section\.row\.id\)" class="tools-per-item-tree">/,
    'per-item tree should collapse per item'
);

console.log('tools/components/SmithCalculatorPanel.test.mjs passed');
