export const PriceBreakdownPopover = {
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
            activeTab: null
        };
    },
    computed: {
        meta() { return this.app.getResourceBreakdownMeta(this.kind); },
        displayConfig() { return this.app.getResourceBreakdownDisplayConfig(this.src, this.kind); },
        levelsView() { return this.app.getResourceBreakdownLevelsView(this.src, this.kind); },
        totalsView() { return this.app.getResourceBreakdownTotalsView(this.src, this.kind); },
        formulaView() { return this.app.getResourceBreakdownFormulaView(this.src, this.kind); },
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
    },
    watch: {
        src: {
            immediate: true,
            handler() {
                this.activeTab = null;
            }
        },
        kind() {
            this.activeTab = null;
        }
    },
    methods: {
        imgError(e) {
            const img = e.target;
            img.parentElement.innerHTML = '<div class="src-img-ph"></div>';
        },
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
    },
    template: `
        <div class="price-breakdown-popover-content">
            <div class="item-popover-header price-breakdown-popover-header">
                <div class="item-popover-img price-breakdown-popover-icon">
                    <img v-if="src.image" :src="src.image" :alt="app.sourceName(src)" @error="imgError">
                    <div v-else class="src-img-ph"></div>
                </div>
                <div>
                    <div class="item-popover-name">{{ app.sourceName(src) }}</div>
                    <div class="item-popover-type">{{ headerSubtitleText }}</div>
                </div>
                <button v-if="showClose" class="popover-close" @click="$emit('close')">&times;</button>
            </div>
            <div v-if="tabs.length > 1" class="price-breakdown-tabbar">
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
                <div v-if="!tabs.length" class="item-popover-empty">
                    {{ meta.emptyText }}
                </div>
                <div v-else class="price-breakdown-tabpanel">
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
                                                <img v-if="cost.image" :src="cost.image" :alt="cost.label" @error="imgError">
                                                <div v-else class="src-img-ph"></div>
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
                            <div class="price-breakdown-total-groups">
                                <div v-for="group in totalsView.groups" :key="group.label" class="price-breakdown-totals">
                                    <div v-if="!hideSectionLabel(totalsView.groups, group.label)" class="price-breakdown-totals-label">{{ group.label }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in group.costs" :key="group.label + ':' + cost.item" class="price-breakdown-cost">
                                            <div class="price-breakdown-cost-icon">
                                                <img v-if="cost.image" :src="cost.image" :alt="cost.label" @error="imgError">
                                                <div v-else class="src-img-ph"></div>
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
                                <div v-for="section in formulaView.sections" :key="section.label + ':' + section.kind" class="price-breakdown-formula-row">
                                    <div v-if="!hideSectionLabel(formulaView.sections, section.label)" class="price-breakdown-formula-label">{{ section.label }}</div>
                                    <div class="price-breakdown-costs">
                                        <div v-for="cost in section.costs"
                                             :key="section.label + ':' + cost.item"
                                             :class="section.kind === 'static' ? 'price-breakdown-cost' : 'item-popover-row item-popover-row-formula price-breakdown-cost-formula'">
                                            <template v-if="section.kind === 'static'">
                                                <div class="price-breakdown-cost-icon">
                                                    <img v-if="cost.image" :src="cost.image" :alt="cost.label" @error="imgError">
                                                    <div v-else class="src-img-ph"></div>
                                                </div>
                                                <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                                                <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                                            </template>
                                            <template v-else>
                                                <span class="item-popover-bonus-label">
                                                    <span class="price-breakdown-cost-icon">
                                                        <img v-if="cost.image" :src="cost.image" :alt="cost.label" @error="imgError">
                                                        <div v-else class="src-img-ph"></div>
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
