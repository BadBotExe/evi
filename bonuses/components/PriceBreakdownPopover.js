import { SpriteImage } from './SpriteImage.js?v=a6508ec846';

export const PriceBreakdownPopover = {
    components: { SpriteImage },
    props: {
        src: Object,
        kind: {
            type: String,
            default: 'enhancement'
        },
        app: Object,
        showClose: {
            type: Boolean,
            default: true
        }
    },
    emits: ['close'],
    data() {
        return {
            activeTab: null,
            totalsFromLevel: 1,
            totalsToLevel: null,
            modifierValues: {}
        };
    },
    computed: {
        meta() { return this.app.getResourceBreakdownMeta(this.kind); },
        displayConfig() { return this.app.getResourceBreakdownDisplayConfig(this.src, this.kind); },
        modifierFields() { return this.app.getResourceBreakdownCostModifiers(this.src, this.kind); },
        modifierFormulaRows() { return this.app.getResourceBreakdownCostModifierFormulaRows(this.src, this.kind, this.modifierValues); },
        hasModifierFields() { return this.modifierFields.length > 0; },
        levelsView() { return this.app.getResourceBreakdownLevelsView(this.src, this.kind, this.modifierValues); },
        totalsView() { return this.app.getResourceBreakdownTotalsView(this.src, this.kind, this.modifierValues); },
        formulaView() { return this.app.getResourceBreakdownFormulaView(this.src, this.kind, this.modifierValues); },
        formulaModifierSections() {
            if (!this.hasModifierFields) return [];
            return this.modifierFormulaRows.map(row => ({
                kind: 'formula',
                label: '',
                costs: [{
                    item: row.id,
                    label: row.label,
                    image: null,
                    expression: row.expression,
                    expressionHtml: row.expressionHtml
                }]
            }));
        },
        combinedFormulaSections() {
            return [...this.formulaView.sections, ...this.formulaModifierSections];
        },
        shownLevelLimit() {
            return this.displayConfig.levels.limit ?? this.displayConfig.totals.upto_level ?? this.displayConfig.finiteMaxLevel;
        },
        maxLevelHeaderText() {
            if (this.displayConfig.infinite) return 'Max Level: not specified';
            const maxLevel = this.displayConfig.finiteMaxLevel;
            return maxLevel != null
                ? `Max Level: ${maxLevel.toLocaleString()}`
                : 'Max Level: not defined';
        },
        headerSubtitleText() {
            if (this.kind === 'disenchantment') {
                return this.levelsView.summary || 'Disenchantment returns';
            }
            if (this.displayConfig.infinite && this.shownLevelLimit != null) {
                return `Max Level: not specified, prices shown up to level ${this.shownLevelLimit.toLocaleString()}`;
            }
            return this.maxLevelHeaderText;
        },
        hasSingleLevelOneLevelsView() {
            return this.app.isSingleLevelOneBreakdown(this.levelsView.rows);
        },
        tabs() {
            const tabs = [];
            if (this.levelsView.rows.length) {
                if (this.levelsView.tabs?.length) {
                    tabs.push(...this.levelsView.tabs.map(tab => ({
                        id: tab.id,
                        label: tab.label,
                        kind: 'levels'
                    })));
                } else {
                    tabs.push({ id: 'levels', label: 'Levels', kind: 'levels' });
                }
            }
            if (this.meta.supportsTotals && this.totalsView.groups.length && !this.hasSingleLevelOneLevelsView) {
                tabs.push({ id: 'totals', label: 'Totals' });
            }
            if (this.formulaView.sections.length) tabs.push({ id: 'formula', label: 'Formula' });
            return tabs;
        },
        resolvedActiveTab() {
            if (this.activeTab && this.tabs.some(tab => tab.id === this.activeTab)) return this.activeTab;
            if (this.displayConfig.initial_tab && this.tabs.some(tab => tab.id === this.displayConfig.initial_tab)) {
                return this.displayConfig.initial_tab;
            }
            return this.tabs[0]?.id ?? null;
        },
        visibleLevelsRows() {
            const activeTab = this.tabs.find(tab => tab.id === this.resolvedActiveTab);
            if (activeTab?.kind !== 'levels') return [];
            if (!this.levelsView.tabs?.length) return this.levelsView.rows ?? [];
            return this.levelsView.tabs.find(tab => tab.id === this.resolvedActiveTab)?.rows ?? [];
        },
        columnCount() { return this.app.priceBreakdownColumnCount(this.visibleLevelsRows); },
        columnClass() {
            return `price-breakdown-columns-${this.columnCount}`;
        },
        totalsRangeMaxLevel() {
            return this.displayConfig.finiteMaxLevel
                ?? this.displayConfig.totals.upto_level
                ?? this.displayConfig.levels.limit
                ?? 1;
        },
        normalizedTotalsFromLevel() {
            return this.clampLevelInput(this.totalsFromLevel, 1);
        },
        normalizedTotalsToLevel() {
            return this.clampLevelInput(this.totalsToLevel, this.normalizedTotalsFromLevel);
        },
        customTotalsCosts() {
            if (!this.meta.supportsTotals) return [];
            return this.app.getResourceBreakdown(
                this.src,
                this.kind,
                this.normalizedTotalsFromLevel,
                this.normalizedTotalsToLevel,
                this.modifierValues
            ).totals;
        },
        customTotalsLabel() {
            const fromLevel = this.normalizedTotalsFromLevel;
            const toLevel = this.normalizedTotalsToLevel;
            return fromLevel === toLevel
                ? `Lvl ${fromLevel.toLocaleString()}`
                : `Lvl ${fromLevel.toLocaleString()}-${toLevel.toLocaleString()}`;
        },
        customTotalsSummary() {
            const maxLevel = this.totalsRangeMaxLevel;
            if (this.displayConfig.finiteMaxLevel != null) {
                return `Upgrade cost for the selected level range up to ${maxLevel.toLocaleString()}.`;
            }
            return `Upgrade cost for the selected level range within the displayed limit of ${maxLevel.toLocaleString()}.`;
        }
    },
    watch: {
        src: {
            immediate: true,
            handler() {
                this.activeTab = null;
                this.resetModifierValues();
                this.resetTotalsRange();
            }
        },
        kind() {
            this.activeTab = null;
            this.resetModifierValues();
            this.resetTotalsRange();
        },
        totalsRangeMaxLevel() {
            this.resetTotalsRange();
        }
    },
    methods: {
        selectTab(tabId) {
            this.activeTab = tabId;
        },
        levelsRowsForTab(tab) {
            if (tab.kind !== 'levels') return [];
            if (!this.levelsView.tabs?.length) return this.levelsView.rows ?? [];
            return this.levelsView.tabs.find(levelTab => levelTab.id === tab.id)?.rows ?? [];
        },
        columnClassForTab(tab) {
            return `price-breakdown-columns-${this.app.priceBreakdownColumnCount(this.levelsRowsForTab(tab))}`;
        },
        isTabActive(tabId) {
            return this.resolvedActiveTab === tabId;
        },
        isSingleLevelOneRows(rows) {
            return this.app.isSingleLevelOneBreakdown(rows);
        },
        hideSectionLabel(entries, label) {
            return this.app.shouldHideResourceBreakdownSectionLabel(entries, label);
        },
        clampLevelInput(value, minimum = 1) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return minimum;
            return Math.min(this.totalsRangeMaxLevel, Math.max(minimum, Math.floor(numeric)));
        },
        clampModifierInput(modifier, value) {
            const numeric = Number(value);
            const fallback = Number(modifier?.default ?? 0);
            const resolved = Number.isFinite(numeric) ? numeric : fallback;
            const min = Number(modifier?.min ?? 0);
            const maxValue = modifier?.max;
            const max = maxValue == null ? null : Number(maxValue);
            const clamped = Number.isFinite(max)
                ? Math.min(max, Math.max(min, resolved))
                : Math.max(min, resolved);
            const precision = this.app._resourceBreakdownModifierPrecision(modifier?.step);
            return precision == null ? clamped : Number(clamped.toFixed(precision));
        },
        resetModifierValues() {
            this.modifierValues = this.app.getResourceBreakdownModifierState(this.src, this.kind);
        },
        normalizeModifierValue(modifier) {
            const normalized = this.clampModifierInput(modifier, this.modifierValues[modifier.id]);
            this.modifierValues = {
                ...this.modifierValues,
                [modifier.id]: normalized
            };
            this.app.setResourceBreakdownModifierValue(this.src, this.kind, modifier.id, normalized);
            this.app.syncUrl();
        },
        modifierFormulaRow(modifierId) {
            return this.modifierFormulaRows.find(row => row.id === modifierId) ?? null;
        },
        resetTotalsRange() {
            this.totalsFromLevel = 1;
            this.totalsToLevel = this.totalsRangeMaxLevel;
        },
        normalizeTotalsRange() {
            const fromLevel = this.clampLevelInput(this.totalsFromLevel, 1);
            const toLevel = this.clampLevelInput(this.totalsToLevel, fromLevel);
            this.totalsFromLevel = fromLevel;
            this.totalsToLevel = toLevel;
        },
        focusAndSelect(event) {
            event?.target?.select?.();
        }
    },
    template: `
        <div class="price-breakdown-popover-content">
            <div class="item-popover-header price-breakdown-popover-header">
                <div class="item-popover-img price-breakdown-popover-icon">
                    <sprite-image :image="src.image" :alt="app.sourceName(src)"></sprite-image>
                </div>
                <div>
                    <div class="item-popover-name">{{ app.sourceName(src) }}</div>
                    <div class="item-popover-type">{{ headerSubtitleText }}</div>
                </div>
                <button v-if="showClose" class="popover-close" @click="$emit('close')">&times;</button>
            </div>
            <div v-if="tabs?.length > 1" class="price-breakdown-tabbar">
                <button v-for="tab in tabs"
                        :key="tab.id"
                        type="button"
                        class="price-breakdown-tab"
                        :class="{ active: isTabActive(tab.id) }"
                        @click="selectTab(tab.id)">
                    {{ tab.label }}
                </button>
            </div>
            <div class="price-breakdown-popover-body">
                <div v-if="!tabs?.length" class="item-popover-empty">
                    {{ meta.emptyText }}
                </div>
                <div v-else class="price-breakdown-tabpanel">
                    <div v-if="!isTabActive('formula')">
                        <div v-if="hasModifierFields" class="price-breakdown-range-card">
                            <div class="price-breakdown-range-head">
                                <div class="price-breakdown-range-title">Cost Modifiers</div>
                                <div class="price-breakdown-range-note">Applied to every shown price in the listed order.</div>
                            </div>
                            <div class="price-breakdown-range-controls">
                                <label v-for="modifier in modifierFields" :key="modifier.id" class="price-breakdown-range-field">
                                    <span>{{ modifier.label }}</span>
                                    <input class="engineering-input price-breakdown-range-input"
                                           type="number"
                                           :min="modifier.min"
                                           :max="modifier.max ?? undefined"
                                           :step="modifier.step"
                                           v-model.number="modifierValues[modifier.id]"
                                           @change="normalizeModifierValue(modifier)"
                                           @focus="focusAndSelect">
                                    <span v-if="modifierFormulaRow(modifier.id)"
                                          class="price-breakdown-note"
                                          v-html="modifierFormulaRow(modifier.id).expressionHtml || modifierFormulaRow(modifier.id).expression"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div v-for="tab in tabs"
                         :key="tab.id"
                         class="price-breakdown-tab-content"
                         v-show="isTabActive(tab.id)">
                        <template v-if="tab.kind === 'levels'">
                            <div v-if="levelsView.summary" class="price-breakdown-note">{{ levelsView.summary }}</div>
                            <div class="price-breakdown-columns" :class="columnClassForTab(tab)">
                                <div v-for="row in levelsRowsForTab(tab)"
                                     :key="tab.id + ':' + row.level"
                                     class="price-breakdown-row"
                                     :class="{ 'price-breakdown-row-no-label': isSingleLevelOneRows(levelsRowsForTab(tab)) }">
                                    <div v-if="!isSingleLevelOneRows(levelsRowsForTab(tab))" class="price-breakdown-level">Lvl {{ row.level }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in row.costs" :key="cost.item + ':' + row.level" class="price-breakdown-cost">
                                            <div class="price-breakdown-cost-icon">
                                                <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                            </div>
                                            <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                                            <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="tab.id === 'totals'">
                            <div v-if="totalsView.summary" class="price-breakdown-note">{{ totalsView.summary }}</div>
                            <div class="price-breakdown-range-card">
                                <div class="price-breakdown-range-head">
                                    <div class="price-breakdown-range-title">Upgrade Calculator</div>
                                    <div class="price-breakdown-range-note">{{ customTotalsSummary }}</div>
                                </div>
                                <div class="price-breakdown-range-controls">
                                    <label class="price-breakdown-range-field">
                                        <span>Level from</span>
                                        <input class="engineering-input price-breakdown-range-input"
                                               type="number"
                                               min="1"
                                               :max="totalsRangeMaxLevel"
                                               v-model.number="totalsFromLevel"
                                               @change="normalizeTotalsRange"
                                               @focus="focusAndSelect">
                                    </label>
                                    <label class="price-breakdown-range-field">
                                        <span>Level to</span>
                                        <input class="engineering-input price-breakdown-range-input"
                                               type="number"
                                               :min="normalizedTotalsFromLevel"
                                               :max="totalsRangeMaxLevel"
                                               v-model.number="totalsToLevel"
                                               @change="normalizeTotalsRange"
                                               @focus="focusAndSelect">
                                    </label>
                                </div>
                                <div class="price-breakdown-totals price-breakdown-totals-custom">
                                    <div class="price-breakdown-totals-label">{{ customTotalsLabel }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in customTotalsCosts" :key="'custom:' + cost.item" class="price-breakdown-cost">
                                            <div class="price-breakdown-cost-icon">
                                                <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                            </div>
                                            <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                                            <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                                        </div>
                                        <div v-if="!customTotalsCosts?.length" class="item-popover-empty price-breakdown-range-empty">
                                            No resources for this level range.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="price-breakdown-total-groups">
                                <div v-for="group in totalsView.groups" :key="group.label" class="price-breakdown-totals">
                                    <div v-if="!hideSectionLabel(totalsView.groups, group.label)" class="price-breakdown-totals-label">{{ group.label }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in group.costs" :key="group.label + ':' + cost.item" class="price-breakdown-cost">
                                            <div class="price-breakdown-cost-icon">
                                                <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                            </div>
                                            <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                                            <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="tab.id === 'formula'">
                            <div v-if="formulaView.summary" class="price-breakdown-note">{{ formulaView.summary }}</div>
                            <div class="price-breakdown-formula-list">
                                <div v-for="section in combinedFormulaSections" :key="section.label + ':' + section.kind" class="price-breakdown-formula-row">
                                    <div v-if="!hideSectionLabel(combinedFormulaSections, section.label)" class="price-breakdown-formula-label">{{ section.label }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in section.costs"
                                             :key="section.label + ':' + cost.item"
                                             :class="section.kind === 'static' ? 'price-breakdown-cost' : 'item-popover-row item-popover-row-formula price-breakdown-cost-formula'">
                                            <template v-if="section.kind === 'static'">
                                                <div class="price-breakdown-cost-icon">
                                                    <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                                </div>
                                                <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                                                <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                                            </template>
                                            <template v-else>
                                                <span class="item-popover-bonus-label">
                                                    <span v-if="cost.image" class="price-breakdown-cost-icon">
                                                        <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                                    </span>
                                                    <span class="item-popover-bonus-label-text">{{ cost.label }}</span>
                                                </span>
                                                <span class="item-popover-bonus-val price-breakdown-cost-formula-amount">
                                                    <div class="max-panel-breakdown item-popover-breakdown">
                                                        <span class="price-breakdown-cost-formula-text" v-html="cost.expressionHtml || cost.expression"></span>
                                                    </div>
                                                </span>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `
};
