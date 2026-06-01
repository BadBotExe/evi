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
        this._toolsPickerKeydownHandler = (event) => {
            if (event.key === 'Escape' && this.state.pickerOpen) {
                this.closePicker();
            }
        };
        window.addEventListener('pointerdown', this._toolsPickerOutsideHandler);
        window.addEventListener('keydown', this._toolsPickerKeydownHandler);
    },
    beforeUnmount() {
        if (this._toolsPickerOutsideHandler) {
            window.removeEventListener('pointerdown', this._toolsPickerOutsideHandler);
        }
        if (this._toolsPickerKeydownHandler) {
            window.removeEventListener('keydown', this._toolsPickerKeydownHandler);
        }
    },
    computed: {
        state() { return this.app.smithCalculatorState; },
        smelteryCalculator() { return this.app.smithSmelteryCalculator; },
        filteredItems() { return this.app.filteredSmithCalculatorItems(); },
        selectedRows() { return this.app.smithCalculatorSelectedRows(); },
        combinedRows() { return this.app.smithCalculatorCombinedRows(); },
        visibleCombinedRows() {
            return this.combinedRows.filter(row =>
                (this.state.showCompletedCombinedRows !== false || row?.isComplete !== true)
                && (this.state.showCompositeCombinedRows !== false || row?.hasRecipe !== true)
            );
        },
        combinedTimingRows() { return this.app.smithCalculatorCombinedTimingRows(); },
        perItemSections() { return this.app.smithCalculatorPerItemSections(); },
        visiblePerItemSections() {
            if (this.state.showCompletedPerItemRows !== false) return this.perItemSections;
            return this.perItemSections.map(section => ({
                ...section,
                rows: (section.rows ?? []).filter(row => row?.isComplete !== true)
            }));
        },
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
        setShowCompletedCombinedRows(value) {
            this.app.setSmithCalculatorShowCompletedCombinedRows(value);
        },
        setShowCompositeCombinedRows(value) {
            this.app.setSmithCalculatorShowCompositeCombinedRows(value);
        },
        setShowCompletedPerItemRows(value) {
            this.app.setSmithCalculatorShowCompletedPerItemRows(value);
        },
        selectedItemQuantity(itemId) {
            return this.app.smithCalculatorSelectedItemQuantity(itemId);
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
                'tools-percent-badge-complete': entry?.isComplete === true
            };
        },
        showCompletedCombinedRows() {
            return this.state.showCompletedCombinedRows !== false;
        },
        showCompositeCombinedRows() {
            return this.state.showCompositeCombinedRows !== false;
        },
        showCompletedPerItemRows() {
            return this.state.showCompletedPerItemRows !== false;
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
                <div class="tools-smeltery-control-shell">
                <div class="tools-smeltery-control-row">
                    <label class="engineering-field engineering-field-select tools-smeltery-field">
                        <span class="engineering-field-label">Multicraft</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input tools-input-surface tools-input-filled tools-input-full tools-smeltery-multicraft-input" v-model.number="state.smelteryMulticraftLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in multicraftOptions" :key="'mc-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field engineering-field-select tools-smeltery-field">
                        <span class="engineering-field-label">Gemshop Speed</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input tools-input-surface tools-input-filled tools-input-full tools-smeltery-gemshop-input" v-model.number="state.smelteryGemshopLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in gemshopOptions" :key="'gs-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field tools-smeltery-field">
                        <span class="engineering-field-label">Speed %</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input tools-input-surface tools-input-filled tools-input-full" type="number" step="1" :value="state.smelterySpeedPercent" @input="app.setSmithCalculatorSmelterySpeed($event.target.value)">
                        </span>
                    </label>
                    <div class="engineering-field tools-smeltery-action-field">
                        <button type="button"
                                class="tools-smeltery-calc-toggle"
                                id="tools-smith-smeltery-calc-toggle"
                                aria-label="Open smeltery speed calculator"
                                @click="app.openSmithSmelteryCalculator('tools-smith-smeltery-calc-toggle')">🧮</button>
                    </div>
                </div>
                </div>

                <div ref="pickerWrap" class="tools-calculator-select-wrap tools-picker-wrap">
                    <div class="tools-calculator-select-box" :class="{ open: state.pickerOpen }" @click.stop="togglePicker()" @pointerdown.stop>
                        <span class="tools-calculator-select-label">Select smith recipe</span>
                        <span class="tools-calculator-select-chevron">&#x25BC;</span>
                    </div>
                    <div class="tools-calculator-dropdown" :class="{ open: state.pickerOpen }" @click.stop @pointerdown.stop>
                        <div class="tools-calculator-search-wrap">
                            <input class="tools-calculator-search" type="search" placeholder="Search smith recipes" autocomplete="off" spellcheck="false" v-model="state.search">
                        </div>
                        <div class="tools-calculator-options">
                            <button v-for="item in filteredItems" :key="item.id" type="button" class="tools-calculator-option tools-picker-option" @click="addItem(item.id)">
                                <span class="tools-picker-option-frame">
                                    <sprite-image v-if="item.image" :image="item.image" :alt="item.name" img-class="tools-picker-option-image"></sprite-image>
                                    <span v-else class="tools-item-fallback">{{ item.name.slice(0, 1).toUpperCase() }}</span>
                                </span>
                                <span class="tools-picker-option-name">{{ item.name }}</span>
                                <span v-if="selectedItemQuantity(item.id)" class="tools-picker-option-status">
                                    Added<span v-if="selectedItemQuantity(item.id) > 1" class="tools-picker-option-status-count"> ×{{ selectedItemQuantity(item.id) }}</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                </div>

                <div v-show="smelteryCalculator.open && !app.isMobileViewport"
                     class="tools-smeltery-calc-popover"
                     id="tools-smith-smeltery-calc-popover">
                    <div class="tools-smeltery-calc-popover-header" @mousedown="app.markSmithSmelteryCalculatorDragged($event)">
                        <div>
                            <div class="tools-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                            <div class="tools-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
                        </div>
                        <button type="button"
                                class="tools-smeltery-calc-close"
                                aria-label="Close smeltery speed calculator"
                                @click="app.closeSmithSmelteryCalculator()">&times;</button>
                    </div>
                    <div class="tools-smeltery-calc-form">
                        <select class="engineering-input tools-smeltery-calc-field"
                                v-model="smelteryCalculator.itemId"
                                aria-label="Smeltery item">
                            <option v-for="item in smelteryCalculatorItems" :key="'calc-' + item.id" :value="item.id">{{ item.name }}</option>
                        </select>
                        <div class="tools-smeltery-calc-time-row">
                            <input class="engineering-input tools-smeltery-calc-field"
                                   v-model="smelteryCalculator.hours"
                                   type="number"
                                   min="0"
                                   step="1"
                                   inputmode="numeric"
                                   placeholder="hh"
                                   aria-label="Hours">
                            <input class="engineering-input tools-smeltery-calc-field"
                                   v-model="smelteryCalculator.minutes"
                                   type="number"
                                   min="0"
                                   max="59"
                                   step="1"
                                   inputmode="numeric"
                                   placeholder="mm"
                                   aria-label="Minutes">
                            <input class="engineering-input tools-smeltery-calc-field"
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
                                class="tools-smeltery-calc-apply"
                                @click="app.applySmithSmelteryCalculator()">Calculate</button>
                    </div>
                </div>

                <div v-if="smelteryCalculator.open && app.isMobileViewport"
                     class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                     @click="app.closeSmithSmelteryCalculator()"></div>
                <div v-if="smelteryCalculator.open && app.isMobileViewport"
                     class="mobile-drawer tools-smeltery-calc-sheet open">
                    <div class="mobile-drawer-header">
                        <div class="mobile-drawer-handle"></div>
                        <button type="button"
                                class="mobile-drawer-close"
                                aria-label="Close smeltery speed calculator"
                                @click="app.closeSmithSmelteryCalculator()">&times;</button>
                    </div>
                    <div class="mobile-drawer-body">
                        <div class="tools-smeltery-calc-sheet-card">
                            <div class="tools-smeltery-calc-popover-header">
                                <div>
                                    <div class="tools-smeltery-calc-popover-title">Smeltery Speed Calculator</div>
                                    <div class="tools-smeltery-calc-popover-subtitle">Uses the selected gemshop tier as the base and writes the remaining % speed</div>
                                </div>
                            </div>
                            <div class="tools-smeltery-calc-form">
                                <select class="engineering-input tools-smeltery-calc-field"
                                        v-model="smelteryCalculator.itemId"
                                        aria-label="Smeltery item">
                                    <option v-for="item in smelteryCalculatorItems" :key="'m-calc-' + item.id" :value="item.id">{{ item.name }}</option>
                                </select>
                                <div class="tools-smeltery-calc-time-row">
                                    <input class="engineering-input tools-smeltery-calc-field"
                                           v-model="smelteryCalculator.hours"
                                           type="number"
                                           min="0"
                                           step="1"
                                           inputmode="numeric"
                                           placeholder="hh"
                                           aria-label="Hours">
                                    <input class="engineering-input tools-smeltery-calc-field"
                                           v-model="smelteryCalculator.minutes"
                                           type="number"
                                           min="0"
                                           max="59"
                                           step="1"
                                           inputmode="numeric"
                                           placeholder="mm"
                                           aria-label="Minutes">
                                    <input class="engineering-input tools-smeltery-calc-field"
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
                                        class="tools-smeltery-calc-apply"
                                        @click="app.applySmithSmelteryCalculator()">Calculate</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="selectedRows.length" class="tools-result-card" style="margin-top:16px">
                    <div class="tools-recipe-section-label">Selected Recipes</div>
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
                                            <div class="tools-item-frame tools-selected-thumb">
                                                <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="tools-item-image"></sprite-image>
                                                <span v-else class="tools-item-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
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
                                        <th class="tools-composite-head-col">
                                            <button type="button"
                                                    class="tools-composite-visibility-btn"
                                                    :aria-label="showCompositeCombinedRows() ? 'Hide composite items' : 'Show composite items'"
                                                    :title="showCompositeCombinedRows() ? 'Hide composite items' : 'Show composite items'"
                                                    @click="setShowCompositeCombinedRows(!showCompositeCombinedRows())">{{ showCompositeCombinedRows() ? 'Hide composite' : 'Show composite' }}</button>
                                        </th>
                                        <th class="tools-number-col">Required</th>
                                        <th class="tools-number-col tools-owned-col-head">Owned</th>
                                        <th class="tools-number-col tools-needed-col">Needed</th>
                                        <th class="tools-number-col tools-percent-col tools-percent-head-col">
                                            <button type="button"
                                                    class="tools-percent-visibility-btn"
                                                    :aria-label="showCompletedCombinedRows() ? 'Hide fully covered items' : 'Show fully covered items'"
                                                    :title="showCompletedCombinedRows() ? 'Hide fully covered items' : 'Show fully covered items'"
                                                    @click="setShowCompletedCombinedRows(!showCompletedCombinedRows())">
                                                <svg v-if="showCompletedCombinedRows()" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96C21.27 14.89 17.23 19 12 19S2.73 14.89 1.44 12.98a1.7 1.7 0 0 1 0-1.96C2.73 9.11 6.77 5 12 5Zm0 2C7.76 7 4.32 10.22 3.15 12 4.32 13.78 7.76 17 12 17s7.68-3.22 8.85-5C19.68 10.22 16.24 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" fill="currentColor"/>
                                                </svg>
                                                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M3.28 2.22 21.78 20.72l-1.06 1.06-3.41-3.4A12.84 12.84 0 0 1 12 19c-5.23 0-9.27-4.11-10.56-6.02a1.7 1.7 0 0 1 0-1.96A16.9 16.9 0 0 1 7.1 6.31L2.22 3.28l1.06-1.06ZM8.8 7.37A14.6 14.6 0 0 0 3.15 12C4.32 13.78 7.76 17 12 17a10.9 10.9 0 0 0 3.94-.71l-2.08-2.08a3.5 3.5 0 0 1-4.07-4.07L8.8 7.37Zm3.92-.36A10.5 10.5 0 0 0 12 7c-.51 0-1 .05-1.49.13l-1.7-1.05A12.96 12.96 0 0 1 12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96 16.82 16.82 0 0 1-3.83 3.84l-1.43-1.43A14.64 14.64 0 0 0 20.85 12C19.89 10.54 17.31 8.03 13.9 7.31l-1.18-.3Zm-.3 3.03a1.97 1.97 0 0 1 1.54 1.54l-1.54-1.54Zm-1.88 1.88 2.5 2.5a2 2 0 0 1-2.5-2.5Z" fill="currentColor"/>
                                                </svg>
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="row in visibleCombinedRows" :key="'combined-' + row.itemId">
                                        <td>
                                            <div class="tools-selected-item">
                                                <div class="tools-item-frame tools-selected-thumb">
                                                    <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="tools-item-image"></sprite-image>
                                                    <span v-else class="tools-item-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
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
                        <div class="tools-recipe-section-label">Smeltery Time</div>
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
                                                <div class="tools-item-frame tools-selected-thumb">
                                                    <sprite-image v-if="row.item?.image" :image="row.item.image" :alt="row.item.name" img-class="tools-item-image"></sprite-image>
                                                    <span v-else class="tools-item-fallback">{{ (row.item?.name ?? row.itemId).slice(0, 1).toUpperCase() }}</span>
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
                    <article v-for="section in visiblePerItemSections" :key="'per-' + section.row.id" class="tools-per-item-card">
                        <div class="tools-per-item-head tools-per-item-toggle" @click="togglePerItemSection(section.row.id)">
                            <div class="tools-item-frame tools-selected-thumb tools-per-item-head-thumb">
                                <sprite-image v-if="section.row.item?.image" :image="section.row.item.image" :alt="section.row.item.name" img-class="tools-item-image"></sprite-image>
                                <span v-else class="tools-item-fallback">{{ (section.row.item?.name ?? section.row.itemId).slice(0, 1).toUpperCase() }}</span>
                            </div>
                            <div class="tools-per-item-main">
                                <div class="tools-selected-name">{{ section.row.item?.name ?? section.row.itemId }}</div>
                                <div class="tools-resource-hint">
                                    <button v-if="isCompactQty(section.row.quantity)"
                                            type="button"
                                            class="tools-compact-value tools-compact-value-inline"
                                            :aria-label="'Show exact quantity for ' + (section.row.item?.name ?? section.row.itemId)"
                                            @click.stop="openValuePopover((section.row.item?.name ?? section.row.itemId) + ' Quantity', section.row.quantity)">{{ formatDisplayQty(section.row.quantity) }}</button>
                                    <span v-else>{{ formatFullQty(section.row.quantity) }}</span>
                                    item(s)
                                </div>
                            </div>
                            <div class="tools-per-item-head-percent tools-percent-head-col">
                                <button type="button"
                                        class="tools-percent-visibility-btn"
                                        :aria-label="showCompletedPerItemRows() ? 'Hide fully covered items' : 'Show fully covered items'"
                                        :title="showCompletedPerItemRows() ? 'Hide fully covered items' : 'Show fully covered items'"
                                        @click.stop="setShowCompletedPerItemRows(!showCompletedPerItemRows())">
                                    <svg v-if="showCompletedPerItemRows()" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96C21.27 14.89 17.23 19 12 19S2.73 14.89 1.44 12.98a1.7 1.7 0 0 1 0-1.96C2.73 9.11 6.77 5 12 5Zm0 2C7.76 7 4.32 10.22 3.15 12 4.32 13.78 7.76 17 12 17s7.68-3.22 8.85-5C19.68 10.22 16.24 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" fill="currentColor"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M3.28 2.22 21.78 20.72l-1.06 1.06-3.41-3.4A12.84 12.84 0 0 1 12 19c-5.23 0-9.27-4.11-10.56-6.02a1.7 1.7 0 0 1 0-1.96A16.9 16.9 0 0 1 7.1 6.31L2.22 3.28l1.06-1.06ZM8.8 7.37A14.6 14.6 0 0 0 3.15 12C4.32 13.78 7.76 17 12 17a10.9 10.9 0 0 0 3.94-.71l-2.08-2.08a3.5 3.5 0 0 1-4.07-4.07L8.8 7.37Zm3.92-.36A10.5 10.5 0 0 0 12 7c-.51 0-1 .05-1.49.13l-1.7-1.05A12.96 12.96 0 0 1 12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96 16.82 16.82 0 0 1-3.83 3.84l-1.43-1.43A14.64 14.64 0 0 0 20.85 12C19.89 10.54 17.31 8.03 13.9 7.31l-1.18-.3Zm-.3 3.03a1.97 1.97 0 0 1 1.54 1.54l-1.54-1.54Zm-1.88 1.88 2.5 2.5a2 2 0 0 1-2.5-2.5Z" fill="currentColor"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="tools-per-item-head-control">
                                <span class="section-chev" :class="{ collapsed: isPerItemSectionCollapsed(section.row.id) }">&#x25BC;</span>
                            </div>
                        </div>
                            <div v-show="!isPerItemSectionCollapsed(section.row.id)" class="tools-per-item-tree">
                            <div v-for="resource in section.rows"
                                 :key="section.row.id + ':' + resource.path"
                                 class="tools-resource-row tools-per-item-tree-row"
                                 :class="{ 'is-craftable': resource.hasChildren, 'tools-per-item-tree-toggle': resource.hasChildren }"
                                 @click="resource.hasChildren ? togglePerItemTreeRow(section.row.id, resource.path) : null"
                                 :style="{ '--tools-recipe-depth': String(resource.depth) }">
                                <div class="tools-resource-icon">
                                    <sprite-image v-if="resource.item?.image" :image="resource.item.image" :alt="resource.item.name" img-class="tools-resource-image"></sprite-image>
                                    <span v-else class="tools-resource-fallback">{{ (resource.item?.name ?? resource.itemId).slice(0, 1).toUpperCase() }}</span>
                                </div>
                                <div class="tools-resource-body tools-per-item-tree-body">
                                    <div class="tools-resource-name">{{ resource.item?.name ?? resource.itemId }}</div>
                                </div>
                                <div class="tools-resource-quantity tools-per-item-tree-quantity">
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
                                </div>
                                <div class="tools-per-item-tree-percent">
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
