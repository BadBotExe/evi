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
        filteredItems() { return this.app.filteredSmithCalculatorItems(); },
        selectedRows() { return this.app.smithCalculatorSelectedRows(); },
        combinedRows() { return this.app.smithCalculatorCombinedRows(); },
        combinedTimingRows() { return this.app.smithCalculatorCombinedTimingRows(); },
        perItemSections() { return this.app.smithCalculatorPerItemSections(); },
        multicraftOptions() { return this.app.smithCalculatorMulticraftOptions(); },
        gemshopOptions() { return this.app.smithCalculatorGemshopOptions(); }
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
            this.state.pickerOpen = false;
            this.state.search = '';
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
                <div class="engineering-planner-controls">
                    <label class="engineering-field engineering-field-select">
                        <span class="engineering-field-label">Multicraft</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input" v-model.number="state.smelteryMulticraftLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in multicraftOptions" :key="'mc-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field engineering-field-select">
                        <span class="engineering-field-label">Gemshop Speed</span>
                        <span class="engineering-field-control">
                            <select class="engineering-input" v-model.number="state.smelteryGemshopLevel" @change="app.persistSmithCalculatorState()">
                                <option v-for="option in gemshopOptions" :key="'gs-' + option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </span>
                    </label>
                    <label class="engineering-field">
                        <span class="engineering-field-label">Smeltery Speed %</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input" type="number" step="1" :value="state.smelterySpeedPercent" @input="app.setSmithCalculatorSmelterySpeed($event.target.value)">
                        </span>
                    </label>
                </div>

                <div ref="pickerWrap" class="bonus-select-wrap tools-compact-picker tools-picker-wrap">
                    <div class="bonus-select-box" :class="{ open: state.pickerOpen }" @click="togglePicker()">
                        <span class="bonus-select-label">Select smith recipe</span>
                        <span class="bonus-select-chevron">&#x25BC;</span>
                    </div>
                    <div class="bonus-dropdown" :class="{ open: state.pickerOpen }" @click.stop>
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
                                            <span class="tools-ratio-value">{{ formatQty(row.required) }}</span>
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
                                            <span class="tools-ratio-value">{{ formatQty(row.missing) }}</span>
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
                                        <td class="tools-number-col">{{ formatQty(row.craftCount) }}</td>
                                        <td class="tools-number-col">{{ formatQty(row.requiredQuantity) }}</td>
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
                                <div class="smith-ingredient-hint">{{ formatQty(section.row.quantity) }} item(s)</div>
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
                                    <span class="tools-per-item-tree-metric tools-per-item-tree-metric-ratio">{{ formatQty(resource.ownedUsed) }}/{{ formatQty(resource.required) }}</span>
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
            </div>
        </section>
    `
};
