import { SpriteImage } from '../../bonuses/components/SpriteImage.js?v=a6508ec846';

export const SmithCalculatorPanel = {
    props: ['app'],
    components: { SpriteImage },
    mounted() {
        this._toolsPickerOutsideHandler = (event) => {
            const picker = this.$refs.pickerWrap;
            if (!picker) return;
            if (picker.contains(event.target)) return;
            this.closePicker();
        };
        window.addEventListener('pointerdown', this._toolsPickerOutsideHandler);
    },
    beforeUnmount() {
        if (this._toolsPickerOutsideHandler) {
            window.removeEventListener('pointerdown', this._toolsPickerOutsideHandler);
        }
    },
    computed: {
        state() { return this.app.smithCalculatorState; },
        smelteryCalculator() { return this.app.smithSmelteryCalculator; },
        filteredItems() { return this.app.filteredSmithCalculatorItems(); },
        selectedRows() { return this.app.smithCalculatorSelectedRows(); },
        combinedRows() { return this.app.smithCalculatorCombinedRows(); },
        combinedTimingRows() { return this.app.smithCalculatorCombinedTimingRows(); },
        perItemSections() { return this.app.smithCalculatorPerItemSections(); },
        multicraftOptions() { return this.app.smithCalculatorMulticraftOptions(); },
        gemshopOptions() { return this.app.smithCalculatorGemshopOptions(); },
        smelteryCalculatorItems() { return this.app.smithCalculatorSmelteryItems(); }
    },
    methods: {
        togglePicker() {
            this.state.pickerOpen = !this.state.pickerOpen;
        },
        closePicker() {
            this.state.pickerOpen = false;
        },
        addItem(itemId) {
            this.app.addSmithCalculatorRow(itemId);
        },
        setQuantity(rowId, value) {
            this.app.updateSmithCalculatorRowQuantity(rowId, value);
        },
        setOwned(itemId, value) {
            this.app.setSmithCalculatorOwnedAmount(itemId, value);
        },
        setOwnedMin(itemId) {
            this.setOwned(itemId, 0);
        },
        setOwnedMax(row) {
            this.setOwned(row?.itemId, row?.required ?? 0);
        },
        togglePerItemSection(rowId) {
            this.app.toggleSmithCalculatorPerItemSection(rowId);
        },
        isPerItemSectionCollapsed(rowId) {
            return this.app.isSmithCalculatorPerItemSectionCollapsed(rowId);
        },
        togglePerItemTreeRow(rowId, path) {
            this.app.toggleSmithCalculatorTreeRow(rowId, path);
        },
        formatQty(value) {
            return this.app.formatSmithCalculatorQuantity(value);
        },
        formatDisplayQty(value) {
            return this.app.formatSmithCalculatorDisplayQuantity(value);
        },
        formatFullQty(value) {
            return this.app.formatSmithCalculatorExactQuantity(value);
        },
        isCompactQty(value) {
            return this.app.smithCalculatorValueIsCompacted(value);
        },
        openValuePopover(label, value) {
            this.app.openSmithCalculatorValuePopover(label, value);
        },
        percentBadgeClasses(entry) {
            return {
                'tools-percent-badge-complete': String(entry?.percentLabel ?? '') === '100%'
            };
        },
        isCombinedMode() {
            return this.state.breakdownMode === 'combined';
        },
        isTimingMode() {
            return this.state.breakdownMode === 'timing';
        }
    },
    template: `
        <section class="source-section engineering-planner-panel tools-smith-calculator-panel" :style="{ '--section-color': app.typeColor('engineering_production') }">
            <div class="section-header engineering-planner-header">
                <span>Smith Recipe Calculator</span>
            </div>
            <div class="engineering-planner-body">
                <div class="tools-compact-panel">
                <div class="smith-smeltery-control-shell">
                <div class="smith-smeltery-control-row">
                    <label class="engineering-field engineering-field-select smith-smeltery-field">
                        <span class="engineering-field-label">Multicraft</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input smith-smeltery-input smith-smeltery-multicraft-input" v-model.number="state.smelteryMulticraftLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in multicraftOptions" :key="'mc-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field engineering-field-select smith-smeltery-field">
                        <span class="engineering-field-label">Gemshop Speed</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input smith-smeltery-input smith-smeltery-gemshop-input" v-model.number="state.smelteryGemshopLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in gemshopOptions" :key="'gs-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field smith-smeltery-field">
                        <span class="engineering-field-label">Speed %</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input smith-smeltery-input" type="number" step="1" :value="state.smelterySpeedPercent" @input="app.setSmithCalculatorSmelterySpeed($event.target.value)">
                        </span>
                    </label>
                    <div class="engineering-field smith-smeltery-action-field">
                        <button type="button"
                                class="smith-smeltery-calc-toggle"
                                id="tools-smith-smeltery-calc-toggle"
                                aria-label="Open smeltery speed calculator"
                                @click="app.openSmithSmelteryCalculator('tools-smith-smeltery-calc-toggle')">🧮</button>
                    </div>
                </div>
                </div>

                <div ref="pickerWrap" class="bonus-select-wrap tools-picker-wrap">
                    <div class="bonus-select-box" :class="{ open: state.pickerOpen }" @click.stop="togglePicker()" @pointerdown.stop>
                        <span class="bonus-select-label">Select smith recipe</span>
                        <span class="bonus-select-chevron">&#x25BC;</span>
                    </div>
                    <div class="bonus-dropdown" :class="{ open: state.pickerOpen }" @click.stop @pointerdown.stop>
                        <div class="bonus-search-wrap">
                            <input class="bonus-search" type="search" placeholder="Search smith recipes" autocomplete="off" spellcheck="false" v-model="state.search">
                        </div>
                        <div class="bonus-options">
                            <button v-for="item in filteredItems" :key="item.id" type="button" class="bonus-option tools-picker-option" @click="addItem(item.id)">
                                <span class="tools-picker-option-frame">
                                    <sprite-image v-if="item.image" :image="item.image" :alt="item.name" img-class="tools-picker-option-image"></sprite-image>
                                    <span v-else class="smith-cell-fallback">{{ item.name.slice(0, 1).toUpperCase() }}</span>
                                </span>
                                <span class="tools-picker-option-name">{{ item.name }}</span>
                            </button>
                        </div>
                    </div>
                </div>
                </div>

                <div v-show="smelteryCalculator.open && !app.isMobileViewport"
                     class="smith-smeltery-calc-popover"
                     id="tools-smith-smeltery-calc-popover">
                    <div class="smith-smeltery-calc-popover-header" @mousedown="app.markSmithSmelteryCalculatorDragged($event)">
                        <div>
                            <div class="smith-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                            <div class="smith-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
                        </div>
                        <button type="button"
                                class="smith-smeltery-calc-close"
                                aria-label="Close smeltery speed calculator"
                                @click="app.closeSmithSmelteryCalculator()">&times;</button>
                    </div>
                    <div class="smith-smeltery-calc-form">
                        <select class="engineering-input smith-smeltery-calc-field"
                                v-model="smelteryCalculator.itemId"
                                aria-label="Smeltery item">
                            <option v-for="item in smelteryCalculatorItems" :key="'calc-' + item.id" :value="item.id">{{ item.name }}</option>
                        </select>
                        <div class="smith-smeltery-calc-time-row">
                            <input class="engineering-input smith-smeltery-calc-field"
                                   v-model="smelteryCalculator.hours"
                                   type="number"
                                   min="0"
                                   step="1"
                                   inputmode="numeric"
                                   placeholder="hh"
                                   aria-label="Hours">
                            <input class="engineering-input smith-smeltery-calc-field"
                                   v-model="smelteryCalculator.minutes"
                                   type="number"
                                   min="0"
                                   max="59"
                                   step="1"
                                   inputmode="numeric"
                                   placeholder="mm"
                                   aria-label="Minutes">
                            <input class="engineering-input smith-smeltery-calc-field"
                                   v-model="smelteryCalculator.seconds"
                                   type="number"
                                   min="0"
                                   max="59"
                                   step="1"
                                   inputmode="numeric"
                                   placeholder="ss"
                                   aria-label="Seconds">
                        </div>
                        <button type="button"
                                class="smith-smeltery-calc-apply"
                                @click="app.applySmithSmelteryCalculator()">Calculate</button>
                    </div>
                </div>

                <div v-if="smelteryCalculator.open && app.isMobileViewport"
                     class="mobile-drawer-overlay smith-smeltery-calc-overlay open"
                     @click="app.closeSmithSmelteryCalculator()"></div>
                <div v-if="smelteryCalculator.open && app.isMobileViewport"
                     class="mobile-drawer smith-smeltery-calc-sheet open">
                    <div class="mobile-drawer-header">
                        <div class="mobile-drawer-handle"></div>
                        <button type="button"
                                class="mobile-drawer-close"
                                aria-label="Close smeltery speed calculator"
                                @click="app.closeSmithSmelteryCalculator()">&times;</button>
                    </div>
                    <div class="mobile-drawer-body">
                        <div class="smith-smeltery-calc-sheet-card">
                            <div class="smith-smeltery-calc-popover-header">
                                <div>
                                    <div class="smith-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                                    <div class="smith-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
                                </div>
                            </div>
                            <div class="smith-smeltery-calc-form">
                                <select class="engineering-input smith-smeltery-calc-field"
                                        v-model="smelteryCalculator.itemId"
                                        aria-label="Smeltery item">
                                    <option v-for="item in smelteryCalculatorItems" :key="'m-calc-' + item.id" :value="item.id">{{ item.name }}</option>
                                </select>
                                <div class="smith-smeltery-calc-time-row">
                                    <input class="engineering-input smith-smeltery-calc-field"
                                           v-model="smelteryCalculator.hours"
                                           type="number"
                                           min="0"
                                           step="1"
                                           inputmode="numeric"
                                           placeholder="hh"
                                           aria-label="Hours">
                                    <input class="engineering-input smith-smeltery-calc-field"
                                           v-model="smelteryCalculator.minutes"
                                           type="number"
                                           min="0"
                                           max="59"
                                           step="1"
                                           inputmode="numeric"
                                           placeholder="mm"
                                           aria-label="Minutes">
                                    <input class="engineering-input smith-smeltery-calc-field"
                                           v-model="smelteryCalculator.seconds"
                                           type="number"
                                           min="0"
                                           max="59"
                                           step="1"
                                           inputmode="numeric"
                                           placeholder="ss"
                                           aria-label="Seconds">
                                </div>
                                <button type="button"
                                        class="smith-smeltery-calc-apply"
                                        @click="app.applySmithSmelteryCalculator()">Calculate</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="selectedRows.length" class="tools-result-card" style="margin-top:16px">
                    <div class="smith-section-label">Selected Recipes</div>
                    <div class="tools-selected-table-wrap">
                        <table class="tools-selected-table">
                            <thead>
                                <tr>
                                    <th aria-label="Item"></th>
                                    <th class="tools-selected-col-qty">Qty</th>
                                    <th class="tools-selected-col-remove" aria-label="Remove"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in selectedRows" :key="row.id">
                                    <td>
                                        <div class="tools-selected-item">
                                            <div class="smith-cell-frame tools-selected-thumb">
                                                <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="smith-item-image"></sprite-image>
                                                <span v-else class="smith-cell-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
                                            </div>
                                            <div class="tools-selected-name">{{ row.item?.name ?? row.itemId }}</div>
                                        </div>
                                    </td>
                                    <td class="tools-selected-col-qty">
                                        <input class="engineering-input tools-number-input" type="number" min="1" step="1" :value="row.quantity" @input="setQuantity(row.id, $event.target.value)">
                                    </td>
                                    <td class="tools-selected-col-remove">
                                        <button type="button"
                                                class="engineering-card-badge tools-remove-badge"
                                                aria-label="Remove recipe"
                                                @click="app.removeSmithCalculatorRow(row.id)">×</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div v-else class="empty-state item-empty-state">
                    <div class="empty-title">No recipes selected</div>
                    <div class="empty-sub">Choose smith recipes above.</div>
                </div>

                <div v-if="selectedRows.length" class="engineering-mode-switch" role="tablist" aria-label="Smith calculator breakdown mode" style="margin-top:16px">
                    <button type="button" class="engineering-mode-btn" :class="{ active: isCombinedMode() }" @click="app.setSmithCalculatorBreakdownMode('combined')">Combined</button>
                    <button type="button" class="engineering-mode-btn" :class="{ active: !isCombinedMode() && !isTimingMode() }" @click="app.setSmithCalculatorBreakdownMode('per-item')">Per Item</button>
                    <button type="button" class="engineering-mode-btn" :class="{ active: isTimingMode() }" @click="app.setSmithCalculatorBreakdownMode('timing')">Smeltery Time</button>
                </div>

                <template v-if="selectedRows.length && isCombinedMode()">
                    <div class="tools-result-card">
                        <div class="tools-results-table-wrap">
                            <table class="tools-results-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Item"></th>
                                        <th class="tools-number-col">Required</th>
                                        <th class="tools-number-col tools-owned-col-head">Owned</th>
                                        <th class="tools-number-col tools-needed-col">Needed</th>
                                        <th class="tools-number-col tools-percent-col" aria-label="% Covered"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="row in combinedRows" :key="'combined-' + row.itemId">
                                        <td>
                                            <div class="tools-selected-item">
                                                <div class="smith-cell-frame tools-selected-thumb">
                                                    <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="smith-item-image"></sprite-image>
                                                    <span v-else class="smith-cell-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
                                                </div>
                                                <div class="tools-selected-name">{{ row.item?.name ?? row.itemId }}</div>
                                            </div>
                                        </td>
                                        <td class="tools-number-col">
                                            <button v-if="isCompactQty(row.required)"
                                                    type="button"
                                                    class="tools-compact-value"
                                                    :aria-label="'Show exact required value for ' + (row.item?.name ?? row.itemId)"
                                                    @click="openValuePopover((row.item?.name ?? row.itemId) + ' Required', row.required)">{{ formatDisplayQty(row.required) }}</button>
                                            <span v-else class="tools-ratio-value">{{ formatFullQty(row.required) }}</span>
                                        </td>
                                        <td class="tools-number-col">
                                            <div class="tools-number-input-actions">
                                                <button type="button"
                                                        class="engineering-card-badge tools-inline-action"
                                                        aria-label="Set owned amount to zero"
                                                        @click="setOwnedMin(row.itemId)">Min</button>
                                                <input class="engineering-input tools-number-input" type="number" min="0" step="1" :value="state.owned[row.itemId] ?? 0" @input="setOwned(row.itemId, $event.target.value)">
                                                <button type="button"
                                                        class="engineering-card-badge tools-inline-action"
                                                        aria-label="Set owned amount to required quantity"
                                                        @click="setOwnedMax(row)">Max</button>
                                            </div>
                                        </td>
                                        <td class="tools-number-col tools-needed-col">
                                            <button v-if="isCompactQty(row.missing)"
                                                    type="button"
                                                    class="tools-compact-value"
                                                    :aria-label="'Show exact needed value for ' + (row.item?.name ?? row.itemId)"
                                                    @click="openValuePopover((row.item?.name ?? row.itemId) + ' Needed', row.missing)">{{ formatDisplayQty(row.missing) }}</button>
                                            <span v-else class="tools-ratio-value">{{ formatFullQty(row.missing) }}</span>
                                        </td>
                                        <td class="tools-number-col tools-percent-col">
                                            <span class="tools-summary-badge tools-inline-summary-badge tools-percent-badge"
                                                  :class="percentBadgeClasses(row)">{{ row.percentLabel }}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>

                <template v-if="selectedRows.length && isTimingMode()">
                    <div class="tools-result-card">
                        <div class="smith-section-label">Smeltery Time</div>
                        <div class="tools-results-table-wrap">
                            <table class="tools-results-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Item"></th>
                                        <th class="tools-number-col">Crafts</th>
                                        <th class="tools-number-col">Out</th>
                                        <th class="tools-number-col">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="row in combinedTimingRows" :key="'timing-' + row.itemId">
                                        <td>
                                            <div class="tools-selected-item">
                                                <div class="smith-cell-frame tools-selected-thumb">
                                                    <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="smith-item-image"></sprite-image>
                                                    <span v-else class="smith-cell-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
                                                </div>
                                                <div class="tools-selected-name">{{ row.item?.name ?? row.itemId }}</div>
                                            </div>
                                        </td>
                                        <td class="tools-number-col">
                                            <button v-if="isCompactQty(row.craftCount)"
                                                    type="button"
                                                    class="tools-compact-value"
                                                    :aria-label="'Show exact crafts value for ' + (row.item?.name ?? row.itemId)"
                                                    @click="openValuePopover((row.item?.name ?? row.itemId) + ' Crafts', row.craftCount)">{{ formatDisplayQty(row.craftCount) }}</button>
                                            <span v-else>{{ formatFullQty(row.craftCount) }}</span>
                                        </td>
                                        <td class="tools-number-col">
                                            <button v-if="isCompactQty(row.outputQuantity)"
                                                    type="button"
                                                    class="tools-compact-value"
                                                    :aria-label="'Show exact output value for ' + (row.item?.name ?? row.itemId)"
                                                    @click="openValuePopover((row.item?.name ?? row.itemId) + ' Out', row.outputQuantity)">{{ formatDisplayQty(row.outputQuantity) }}</button>
                                            <span v-else>{{ formatFullQty(row.outputQuantity) }}</span>
                                        </td>
                                        <td class="tools-number-col">{{ row.totalTimeLabel }}</td>
                                    </tr>
                                    <tr v-if="!combinedTimingRows.length">
                                        <td colspan="4">No timed smith crafts in the current selection.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>

                <template v-if="selectedRows.length && !isCombinedMode() && !isTimingMode()">
                    <div class="tools-per-item-list">
                    <article v-for="section in perItemSections" :key="'per-' + section.row.id" class="tools-per-item-card">
                        <div class="tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection(section.row.id)">
                            <div class="smith-cell-frame tools-selected-thumb tools-per-item-head-thumb">
                                <sprite-image v-if="section.row.item?.image" :image="section.row.item.image" :alt="section.row.item.name" img-class="smith-item-image"></sprite-image>
                                <span v-else class="smith-cell-fallback">{{ (section.row.item?.name ?? section.row.itemId).slice(0, 1).toUpperCase() }}</span>
                            </div>
                            <div class="tools-per-item-main">
                                <div class="tools-selected-name">{{ section.row.item?.name ?? section.row.itemId }}</div>
                                <div class="smith-ingredient-hint">
                                    <button v-if="isCompactQty(section.row.quantity)"
                                            type="button"
                                            class="tools-compact-value tools-compact-value-inline"
                                            :aria-label="'Show exact quantity for ' + (section.row.item?.name ?? section.row.itemId)"
                                            @click.stop="openValuePopover((section.row.item?.name ?? section.row.itemId) + ' Quantity', section.row.quantity)">{{ formatDisplayQty(section.row.quantity) }}</button>
                                    <span v-else>{{ formatFullQty(section.row.quantity) }}</span>
                                    item(s)
                                </div>
                            </div>
                            <div class="tools-per-item-head-spacer" aria-hidden="true"></div>
                            <div class="tools-per-item-head-control">
                                <span class="section-chev" :class="{ collapsed: isPerItemSectionCollapsed(section.row.id) }">&#x25BC;</span>
                            </div>
                        </div>
                            <div v-show="!isPerItemSectionCollapsed(section.row.id)" class="tools-per-item-tree">
                            <div v-for="resource in section.rows"
                                 :key="section.row.id + ':' + resource.path"
                                 class="smith-ingredient tools-per-item-tree-row"
                                 :class="{ 'is-craftable': resource.hasChildren, 'tools-per-item-tree-toggle': resource.hasChildren }"
                                 @click="resource.hasChildren ? togglePerItemTreeRow(section.row.id, resource.path) : null"
                                 :style="{ '--smith-recipe-depth': String(resource.depth) }">
                                <div class="smith-ingredient-icon">
                                    <sprite-image v-if="resource.item?.image" :image="resource.item.image" :alt="resource.item.name" img-class="smith-ingredient-image"></sprite-image>
                                    <span v-else class="smith-ingredient-fallback">{{ (resource.item?.name ?? resource.itemId).slice(0, 1).toUpperCase() }}</span>
                                </div>
                                <div class="smith-ingredient-body tools-per-item-tree-body">
                                    <div class="smith-ingredient-name">{{ resource.item?.name ?? resource.itemId }}</div>
                                </div>
                                <div class="smith-ingredient-quantity tools-per-item-tree-metrics">
                                    <span class="tools-per-item-tree-metric tools-per-item-tree-metric-ratio">
                                        <button v-if="isCompactQty(resource.ownedUsed)"
                                                type="button"
                                                class="tools-compact-value tools-compact-value-inline"
                                                :aria-label="'Show exact owned-used value for ' + (resource.item?.name ?? resource.itemId)"
                                                @click.stop="openValuePopover((resource.item?.name ?? resource.itemId) + ' Owned Used', resource.ownedUsed)">{{ formatDisplayQty(resource.ownedUsed) }}</button>
                                        <span v-else>{{ formatFullQty(resource.ownedUsed) }}</span>/<button v-if="isCompactQty(resource.required)"
                                                type="button"
                                                class="tools-compact-value tools-compact-value-inline"
                                                :aria-label="'Show exact required value for ' + (resource.item?.name ?? resource.itemId)"
                                                @click.stop="openValuePopover((resource.item?.name ?? resource.itemId) + ' Required', resource.required)">{{ formatDisplayQty(resource.required) }}</button>
                                        <span v-else>{{ formatFullQty(resource.required) }}</span>
                                    </span>
                                    <span class="tools-summary-badge tools-inline-summary-badge tools-percent-badge"
                                          :class="percentBadgeClasses(resource)">{{ resource.percentLabel }}</span>
                                </div>
                                <div class="tools-per-item-tree-control">
                                    <span v-if="resource.hasChildren"
                                          class="section-chev tools-per-item-tree-chev"
                                          :class="{ collapsed: resource.isCollapsed }">&#x25BC;</span>
                                </div>
                            </div>
                        </div>
                    </article>
                    </div>
                </template>

                <div v-if="app.smithValuePopover.open && app.isMobileViewport"
                     class="mobile-drawer-overlay tools-value-sheet-overlay open"
                     @click="app.closeSmithCalculatorValuePopover()"></div>
                <div v-if="app.smithValuePopover.open && app.isMobileViewport"
                     class="mobile-drawer tools-value-sheet open">
                    <div class="mobile-drawer-header">
                        <div class="mobile-drawer-handle"></div>
                        <button type="button"
                                class="mobile-drawer-close"
                                aria-label="Close exact value popover"
                                @click="app.closeSmithCalculatorValuePopover()">&times;</button>
                    </div>
                    <div class="mobile-drawer-body">
                        <div class="tools-value-sheet-card">
                            <div class="tools-value-sheet-label">{{ app.smithValuePopover.label }}</div>
                            <div class="tools-value-sheet-value">{{ app.smithValuePopover.value }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `
};
