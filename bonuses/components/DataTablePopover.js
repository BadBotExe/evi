export const DataTablePopover = {
    props: ['entry', 'app', 'showClose'],
    data() {
        return {
            activeTab: null,
            isCompactLayout: false
        };
    },
    computed: {
        title() { return this.entry?.action?.title ?? ''; },
        subtitle() { return this.entry?.action?.subtitle ?? ''; },
        description() { return this.entry?.action?.description ?? ''; },
        tables() { return this.entry?.action?.tables ?? []; },
        tableGridClass() { return this.entry?.action?.tableGridClass ?? ''; },
        formulaSections() { return this.entry?.action?.formulaSections ?? []; },
        tabs() {
            const tabs = [];
            if (!!this.entry?.action?.tabbed && this.tables.length > 1) {
                tabs.push(...this.tables.map((table, index) => ({
                    id: table.id ?? `table-${index}`,
                    label: table.tabLabel ?? table.title ?? `Table ${index + 1}`,
                    kind: 'table',
                    tableId: table.id ?? `table-${index}`
                })));
            } else if (this.tables.length && this.formulaSections.length) {
                tabs.push({
                    id: 'tables',
                    label: this.entry?.action?.tablesTabLabel ?? 'Levels',
                    kind: 'tables'
                });
            }
            if (this.formulaSections.length) {
                tabs.push({
                    id: 'formula',
                    label: 'Formula',
                    kind: 'formula'
                });
            }
            return tabs;
        },
        useTabs() { return this.tabs.length > 1; },
        resolvedActiveTab() {
            if (this.activeTab && this.tabs.some(tab => tab.id === this.activeTab)) return this.activeTab;
            return this.tabs[0]?.id ?? null;
        },
        normalizedTables() {
            return this.tables.flatMap(table => {
                if (!Array.isArray(table?.splitTables)) return [table];
                if (!this.isCompactLayout) return table.splitTables;
                return [this.mergeSplitTable(table)];
            });
        },
        visibleTables() {
            if (!this.useTabs) return this.normalizedTables;
            const activeTab = this.tabs.find(tab => tab.id === this.resolvedActiveTab);
            if (!activeTab || activeTab.kind === 'formula') return [];
            if (activeTab.kind === 'tables') return this.normalizedTables;
            return this.tables
                .filter(table => (table.id ?? `table-${this.tables.indexOf(table)}`) === activeTab.tableId)
                .flatMap(table => {
                    if (!Array.isArray(table?.splitTables)) return [table];
                    if (!this.isCompactLayout) return table.splitTables;
                    return [this.mergeSplitTable(table)];
                });
        },
        visibleFormulaSections() {
            if (!this.formulaSections.length) return [];
            if (!this.useTabs) return this.formulaSections;
            return this.resolvedActiveTab === 'formula' ? this.formulaSections : [];
        }
    },
    watch: {
        entry: {
            immediate: true,
            handler() {
                this.activeTab = null;
            }
        }
    },
    methods: {
        mergeSplitTable(table) {
            const splitTables = Array.isArray(table?.splitTables) ? table.splitTables.filter(Boolean) : [];
            const firstSplit = splitTables[0] ?? {};
            return {
                ...table,
                columns: table?.columns ?? firstSplit.columns ?? [],
                rows: splitTables.flatMap(splitTable => Array.isArray(splitTable?.rows) ? splitTable.rows : [])
            };
        },
        syncCompactLayout() {
            this.isCompactLayout = window.innerWidth <= 900;
        },
        selectTab(tabId) {
            this.activeTab = tabId;
        },
        isTabActive(tabId) {
            return this.resolvedActiveTab === tabId;
        },
        showFormulaSectionLabel(section) {
            return this.visibleFormulaSections.length > 1 && !!section.label;
        }
    },
    mounted() {
        this.syncCompactLayout();
        window.addEventListener('resize', this.syncCompactLayout);
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.syncCompactLayout);
    },
    template: `
        <div class="price-breakdown-popover-content">
            <div class="item-popover-header price-breakdown-popover-header">
                <div class="item-popover-img price-breakdown-popover-icon">
                    <div class="src-img-ph"></div>
                </div>
                <div>
                    <div class="item-popover-name">{{ title }}</div>
                    <div class="item-popover-type">{{ subtitle }}</div>
                </div>
                <button v-if="showClose" class="popover-close" @click="$emit('close')">&times;</button>
            </div>
            <div v-if="useTabs || description" class="popover-table-toolbar">
                <div v-if="useTabs" class="price-breakdown-tabbar">
                    <button v-for="tab in tabs"
                            :key="tab.id"
                            type="button"
                            class="price-breakdown-tab"
                            :class="{ active: isTabActive(tab.id) }"
                            @click="selectTab(tab.id)">
                        {{ tab.label }}
                    </button>
                </div>
                <div v-if="description" class="price-breakdown-tabbar price-breakdown-tabbar-static">
                    <div class="price-breakdown-note popover-table-note">{{ description }}</div>
                </div>
            </div>
            <div class="price-breakdown-popover-body popover-table-body">
                <div class="price-breakdown-tabpanel">
                    <div v-if="visibleTables.length" class="price-breakdown-tab-content">
                        <div class="popover-table-layout popover-table-content" :class="tableGridClass">
                            <section v-for="table in visibleTables" :key="table.id" class="popover-table-section">
                                <div v-if="table.title || table.description" class="popover-table-head">
                                    <div v-if="table.title" class="popover-table-title">{{ table.title }}</div>
                                    <div v-if="table.description" class="popover-table-desc">{{ table.description }}</div>
                                </div>
                                <div class="popover-table-shell">
                                    <div class="popover-table-sticky-head" :style="{ '--popover-table-columns': (table.columns ?? []).length }">
                                        <div class="popover-table-grid popover-table-grid-head" role="rowgroup">
                                            <div class="popover-table-grid-row popover-table-grid-row-head" role="row">
                                                <div v-for="column in (table.columns ?? [])"
                                                     :key="column.key"
                                                     class="popover-table-grid-cell popover-table-grid-cell-head"
                                                     role="columnheader">
                                                    {{ column.label }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="popover-table-frame" :style="{ '--popover-table-columns': (table.columns ?? []).length }">
                                        <div class="popover-table-grid popover-table-grid-body" role="rowgroup">
                                            <div v-for="(row, ri) in (table.rows ?? [])"
                                                 :key="table.id + ':' + ri"
                                                 class="popover-table-grid-row"
                                                 role="row">
                                                <div v-for="column in (table.columns ?? [])"
                                                     :key="column.key"
                                                     class="popover-table-grid-cell"
                                                     role="cell">
                                                    {{ row[column.key] }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                    <div v-else-if="visibleFormulaSections.length" class="price-breakdown-tab-content">
                        <div class="price-breakdown-formula-list popover-table-content data-table-formula-list">
                            <div v-for="section in visibleFormulaSections"
                                 :key="section.label"
                                 class="price-breakdown-formula-row"
                                 :class="{ 'price-breakdown-formula-row-no-label': !showFormulaSectionLabel(section) }">
                                <div v-if="showFormulaSectionLabel(section)" class="price-breakdown-formula-label">{{ section.label }}</div>
                                <div class="price-breakdown-costs">
                                    <div v-for="cost in section.costs"
                                         :key="section.label + ':' + cost.label"
                                         class="item-popover-row item-popover-row-formula price-breakdown-cost-formula data-table-cost-formula">
                                        <span class="item-popover-bonus-label">
                                            <span class="item-popover-bonus-label-text">{{ cost.label }}</span>
                                        </span>
                                        <span class="item-popover-bonus-val price-breakdown-cost-formula-amount">
                                            <div class="max-panel-breakdown item-popover-breakdown">
                                                <span class="price-breakdown-cost-formula-text" v-html="cost.expressionHtml || cost.expression"></span>
                                            </div>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    `
};
