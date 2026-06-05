import assert from 'node:assert/strict';

import { SmithCalculatorPanel } from './SmithCalculatorPanel.js';

const template = SmithCalculatorPanel.template;
const addItemSource = String(SmithCalculatorPanel.methods.addItem);
const mountedSource = String(SmithCalculatorPanel.mounted);
const beforeUnmountSource = String(SmithCalculatorPanel.beforeUnmount);

assert.match(
    template,
    /<sprite-image v-if="item\.image" :image="item\.image" :alt="item\.name" img-class="tools-picker-option-image"><\/sprite-image>/,
    'picker rows should pass item images through the SpriteImage image prop'
);

assert.match(
    addItemSource,
    /addSmithCalculatorRow\(itemId\)/,
    'picker item selection should leave the dropdown open and preserve the current search so multiple recipes can be chosen in sequence'
);

assert.doesNotMatch(
    addItemSource,
    /pickerOpen|search/,
    'picker item selection should not close the dropdown or clear the search field'
);

assert.match(
    mountedSource,
    /event\.key === 'Escape' && this\.state\.pickerOpen[\s\S]*?this\.closePicker\(\)/,
    'smith recipe picker should close on Escape when the dropdown is open'
);

assert.match(
    beforeUnmountSource,
    /removeEventListener\('keydown', this\._toolsPickerKeydownHandler\)/,
    'smith recipe picker should remove its Escape key handler on unmount'
);

assert.match(
    template,
    /<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="tools-item-image"><\/sprite-image>/,
    'selected rows should pass item images through the SpriteImage image prop'
);

assert.match(
    template,
    /<sprite-image v-if="section\.row\.item\?\.image" :image="section\.row\.item\.image" :alt="section\.row\.item\.name" img-class="tools-item-image"><\/sprite-image>/,
    'per-item sections should pass item images through the SpriteImage image prop'
);

assert.match(
    template,
    /tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection\(section\.row\.id\)"/,
    'per-item headers should keep the row-id collapse entry point'
);

assert.match(
    template,
    /<tr v-for="row in visibleCombinedRows"[\s\S]*?<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="tools-item-image"><\/sprite-image>/,
    'combined resources rows should render item images'
);

assert.match(
    template,
    /<th class="tools-composite-head-col">[\s\S]*?class="tools-composite-visibility-btn"[\s\S]*?showCompositeCombinedRows\(\) \? 'Hide composite items' : 'Show composite items'[\s\S]*?@click="setShowCompositeCombinedRows\(!showCompositeCombinedRows\(\)\)"[\s\S]*?Hide composite[\s\S]*?Show composite/,
    'combined resources should expose an item-column button to hide or show composite items'
);

assert.match(
    template,
    /formatDisplayQty\(row\.required\)[\s\S]*?formatDisplayQty\(row\.missing\)/,
    'combined resources should render compact-aware Required and Needed values'
);

assert.match(
    template,
    /class="tools-number-col tools-percent-col tools-percent-head-col"[\s\S]*?class="tools-percent-visibility-btn"[\s\S]*?showCompletedCombinedRows\(\) \? 'Hide fully covered items' : 'Show fully covered items'[\s\S]*?@click="setShowCompletedCombinedRows\(!showCompletedCombinedRows\(\)\)"/,
    'combined resources should expose a percent-column eye toggle to hide or show fully covered items'
);

assert.match(
    String(SmithCalculatorPanel.computed.visibleCombinedRows),
    /showCompletedCombinedRows !== false[\s\S]*?row\?\.isComplete !== true[\s\S]*?showCompositeCombinedRows !== false[\s\S]*?row\?\.hasRecipe !== true/,
    'combined resources should filter out complete and composite rows only when their toggles are disabled'
);

assert.match(
    String(SmithCalculatorPanel.computed.visiblePerItemSections),
    /showCompletedPerItemRows !== false[\s\S]*?section\.rows[\s\S]*?row\?\.isComplete !== true/,
    'per-item resources should filter out complete rows only when the eye toggle is disabled'
);

assert.doesNotMatch(
    template,
    /<div class="tools-result-card-head">[\s\S]*?<div class="tools-recipe-section-label">Combined Resources<\/div>[\s\S]*?<div class="tools-summary-badge">\{\{ combinedCoverageSummary\(\) \}\}<\/div>/,
    'combined resources header should not render the overall % covered badge'
);

assert.match(
    template,
    /<tr v-for="row in combinedTimingRows"[\s\S]*?<sprite-image v-if="row\.item\?\.image" :image="row\.item\.image" :alt="row\.item\.name" img-class="tools-item-image"><\/sprite-image>/,
    'timing rows should render item images'
);

assert.match(
    template,
    /<article v-for="section in visiblePerItemSections"[\s\S]*?<div v-for="resource in section\.rows"[\s\S]*?:class="\{ 'is-craftable': resource\.hasChildren, 'tools-per-item-tree-toggle': resource\.hasChildren \}"[\s\S]*?<sprite-image v-if="resource\.item\?\.image" :image="resource\.item\.image" :alt="resource\.item\.name" img-class="tools-resource-image"><\/sprite-image>/,
    'per-item resource rows should render item images'
);

assert.match(
    template,
    /<div class="tools-resource-quantity tools-per-item-tree-quantity">[\s\S]*?formatDisplayQty\(resource\.ownedUsed\)[\s\S]*?formatDisplayQty\(resource\.required\)[\s\S]*?<\/div>\s*<div class="tools-per-item-tree-percent">[\s\S]*?\{\{ resource\.percentLabel \}\}[\s\S]*?<\/div>/,
    'per-item resources should render quantity and percent as separate columns'
);

assert.match(
    template,
    /<div class="tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection\(section\.row\.id\)">[\s\S]*?<div class="tools-per-item-head-percent tools-percent-head-col">[\s\S]*?class="tools-percent-visibility-btn"[\s\S]*?@click\.stop="setShowCompletedPerItemRows\(!showCompletedPerItemRows\(\)\)"[\s\S]*?<\/div>\s*<div class="tools-per-item-head-control">/,
    'per-item resources should place the eye toggle in the existing card header percent column'
);

assert.match(
    String(SmithCalculatorPanel.methods.percentBadgeClasses),
    /entry\?\.isComplete === true/,
    'percent badges should style completion from the exact completion flag instead of the rounded label'
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
    /<div class="tools-smeltery-control-shell">[\s\S]*?<div class="engineering-planner-controls tools-smeltery-control-row">[\s\S]*?class="engineering-input tools-input-surface tools-input-filled tools-input-full tools-smeltery-multicraft-input"[\s\S]*?class="engineering-input tools-input-surface tools-input-filled tools-input-full tools-smeltery-gemshop-input"[\s\S]*?class="engineering-input tools-input-surface tools-input-filled tools-input-full"[\s\S]*?id="tools-smith-smeltery-calc-toggle"[\s\S]*?aria-label="Open smeltery speed calculator"[\s\S]*?>🧮<\/button>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    'smith calculator should reuse the engineering planner controls template for smeltery controls'
);

assert.match(
    template,
    /id="tools-smith-smeltery-calc-popover"[\s\S]*?Smeltery Speed Calculator[\s\S]*?Uses the selected gemshop tier as the base and writes the remaining % speed[\s\S]*?aria-label="Smeltery item"[\s\S]*?placeholder="hh"[\s\S]*?placeholder="mm"[\s\S]*?placeholder="ss"[\s\S]*?@click="app\.applySmithSmelteryCalculator\(\)">Calculate<\/button>/,
    'smith calculator should render the desktop smeltery speed calculator popover with tools-local class names'
);

assert.match(
    template,
    /<template v-if="selectedRows\.length && isTimingMode\(\)">[\s\S]*?<div class="tools-recipe-section-label">Smeltery Time<\/div>[\s\S]*?<\/template>/,
    'Smeltery Time should render in its own dedicated mode'
);

assert.match(
    template,
    /formatDisplayQty\(row\.craftCount\)[\s\S]*?formatDisplayQty\(row\.outputQuantity\)/,
    'Smeltery Time should render compact-aware Crafts and Out values'
);

assert.match(
    template,
    /<div class="tools-calculator-select-box" :class="\{ open: state\.pickerOpen \}" @click\.stop="togglePicker\(\)" @pointerdown\.stop>/,
    'smith recipe picker trigger should stop propagation so repeated clicks can toggle the dropdown closed'
);

assert.match(
    template,
    /<span v-if="selectedItemQuantity\(item\.id\)" class="tools-picker-option-status">\s*Added<span v-if="selectedItemQuantity\(item\.id\) > 1" class="tools-picker-option-status-count"> ×\{\{ selectedItemQuantity\(item\.id\) \}\}<\/span>\s*<\/span>/,
    'smith recipe picker options should show Added and only append ×N when more than one recipe was added'
);

assert.match(
    String(SmithCalculatorPanel.methods.selectedItemQuantity),
    /smithCalculatorSelectedItemQuantity\(itemId\)/,
    'smith recipe picker should read added item quantities from the shared calculator helper'
);

assert.match(
    template,
    /<div v-if="app\.smithValuePopover\.open && app\.isMobileViewport"[\s\S]*?class="mobile-drawer tools-value-sheet open"[\s\S]*?<div class="tools-value-sheet-card">[\s\S]*?<div class="tools-value-sheet-label">\{\{ app\.smithValuePopover\.label \}\}<\/div>[\s\S]*?<div class="tools-value-sheet-value">\{\{ app\.smithValuePopover\.value \}\}<\/div>/,
    'smith calculator should render a mobile drawer for exact compact values'
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
