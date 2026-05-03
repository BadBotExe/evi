import { createApp, ref, computed, reactive, nextTick, watch } from 'vue';
import { optimize } from './optimizer.js';

/* -- CONSTANTS -- */
const DEFAULT_UNITS = { flat: '', percent: '%', multiplier: '' };
const DEFAULT_ITEM_CATEGORY_ID = '__default__';
const DEFAULT_ITEM_CATEGORY_KEY = 'default';

/* ==========================================
   SHARED HELPERS (pure functions, no state)
========================================== */
function unitFor(bonusTypes, bonusId, unitType) {
    const bt = bonusTypes.find(b => b.id === bonusId);
    const ut = unitType || 'flat';
    if (!bt) return DEFAULT_UNITS[ut] || '';
    if (bt.units && bt.units[ut] !== undefined) return bt.units[ut];
    return DEFAULT_UNITS[ut] || '';
}

function formatVal(value, unit, unitType) {
    const v = normalizeValue(value);
    const sign = v >= 0 ? '+' : '';
    const formatted = v.toLocaleString();
    if (unitType === 'multiplier') return '×' + formatted + (unit ? ' ' + unit : '');
    if (unitType === 'percent')    return sign + formatted + unit;
    return sign + formatted + (unit ? ' ' + unit : '');
}

function formatValFixed(value, unit, unitType, decimals) {
    const v = normalizeValue(value);
    const fixed = v.toFixed(decimals);
    const sign = v >= 0 ? '+' : '';
    if (unitType === 'multiplier') return '×' + fixed + (unit ? ' ' + unit : '');
    if (unitType === 'percent')    return sign + fixed + unit;
    return sign + fixed + (unit ? ' ' + unit : '');
}

function maxDecimalsInRows(rows) {
    return rows.reduce((max, r) => {
        if (r.isEllipsis || r._rawVal == null) return max;
        const s = normalizeValue(r._rawVal).toString().split('.')[1] ?? '';
        return Math.max(max, s.length);
    }, 0);
}

function normalizeValue(value, digits = 4) {
    const coeff = Math.pow(10, digits);
    return Math.round(value * coeff) / coeff;
}

function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepCloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function deepMergeObjects(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) return deepCloneJson(override);

    const merged = { ...deepCloneJson(base) };
    for (const [key, value] of Object.entries(override)) {
        if (isPlainObject(value) && isPlainObject(merged[key])) {
            merged[key] = deepMergeObjects(merged[key], value);
        } else {
            merged[key] = deepCloneJson(value);
        }
    }
    return merged;
}

/* ==========================================
   EMPTY STATE COMPONENT
========================================== */
const EmptyState = {
    props: ['selectedBonus'],
    template: `
        <div class="empty-state" v-if="!selectedBonus">
            <div class="empty-icon">&#x2726;</div>
            <div class="empty-title">No bonus selected</div>
            <div class="empty-sub">Select a bonus from the dropdown to see all sources and maximum obtainable values</div>
        </div>
    `
};

/* ==========================================
   SOURCE ROW COMPONENT
========================================== */
const SourceRow = {
    props: ['entry', 'selectedBonus', 'openDetails', 'app', 'fromPopover'],
    emits: ['toggle-detail'],
    computed: {
        src:            function() { return this.entry.src; },
        bonuses:        function() { return this.entry.bonuses; },
        isOpen:         function() { return false; },
        hasTiers:       function() { return this.app.hasTiers(this.entry); },
        tierGroups:     function() { return this.app.getTierGroups(this.entry); },
        valueHtml:      function() { return this.app.entryValueHtml(this.entry, { includeFormulaMeta: !this.fromPopover }); },
        slotMax:        function() { return this.entry.src.slot ? this.app.slotMax(this.entry.src.slot) : null; },
        aliasBonuses: function() { const sel = this.selectedBonus; return this.entry.bonuses.filter(function(b) { return b.bonus !== sel; }); },
        conditionBonus: function() { return this.entry.bonuses.find(function(b) { return b.condition; }) ?? null; },
        ascensionBonus() {
            const ids = this.app._resolveBonusIds(this.selectedBonus);
            return this.bonuses.find(b => b._is_ascension && ids.includes(b.bonus)) ?? null;
        },
        tierLabel() { return this.app.srcTierLabel(this.src, this.ascensionBonus); },
    },
    methods: {
        bonusLabel(id)    { return this.app.bonusLabel(id); },
        scalesLabel(id)   { return this.app.scalesLabel(id); },
        condLabel(id)     { return this.app.conditionLabel(id); },
        classLabel(id)    { return this.app.classLabel(id); },
        classColor(id)    { return this.app.classColor(id); },
        toggle(e)   { if (this.hasTiers) { e.stopPropagation(); this.app.openTierPopover(this.entry, e, this.fromPopover); } },
        imgError(e) { e.target.parentElement.innerHTML = '<div class="src-img-ph"></div>'; }
    },
    template: `
        <div class="source-row-wrap" :class="{ 'has-detail': hasTiers }" :data-id="src.id">
            <div class="source-row" @click="toggle">

                <!-- Image -->
                <div class="src-img"
                     :class="{ 'src-img-clickable': app.resolveItemPopover(src) !== false }"
                     @click.stop="app.openItemPopover(src, $event, fromPopover)">
                    <img v-if="src.image" :src="src.image" :alt="src.name" @error="imgError">
                    <div v-else class="src-img-ph"></div>
                </div>

                <!-- Info -->
                <div class="src-info">
                    <div class="src-name">
                        <span class="src-name-text"
                            :title="src.name"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">{{ src.name }}</span>
                        <span v-if="tierLabel" class="tag tag-tier">{{ tierLabel }}</span>
                    </div>
                    <div class="src-tags">
                        <span v-for="b in aliasBonuses" :key="b.bonus" class="tag tag-alias"
                              :title="bonusLabel(b.bonus)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ bonusLabel(b.bonus) }}
                        </span>
                        <span v-if="bonuses[0]?.derived_from" class="tag src-derived"
                              :title="bonusLabel(bonuses[0].derived_from)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ bonusLabel(bonuses[0].derived_from) }}
                        </span>
                        <span v-if="src.available === false" class="tag tag-na"
                              title="Unavailable"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">Unavailable</span>
                        <span v-if="src.category" class="tag tag-category"
                              :title="app.categoryLabel(src.category)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :style="{ background: app.categoryColor(src.category) + '22', color: app.categoryColor(src.category) }">
                            {{ app.categoryLabel(src.category) }}
                        </span>
                        <span v-if="bonuses[0]?.scales_with" class="tag src-scales"
                              :title="scalesLabel(bonuses[0].scales_with)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">
                            {{ scalesLabel(bonuses[0].scales_with) }}
                        </span>
                        <span v-if="conditionBonus" class="tag tag-conditional"
                              :title="'&#x2691; ' + condLabel(conditionBonus.condition)"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :class="{ 'tag-conditional-fail': !app.activeConditions.has(conditionBonus.condition) }">
                            &#x2691; {{ condLabel(conditionBonus.condition) }}
                        </span>
                        <span v-for="[paramId, min] in Object.entries(bonuses[0].parameter_min ?? {})" 
                              :key="paramId" class="tag tag-conditional"
                              :title="app.paramLabel(paramId) + ' &#x8805 ' + min"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :class="{ 'tag-conditional-fail': !app.isParamMet(paramId, min) }">
                            {{ app.paramLabel(paramId) }} &#x8805 {{ min }}
                        </span>
                        <span v-if="src.slot && src.size > 1" class="tag tag-slot"
                              :title="app.slotLabel(src.slot) + (src.size > 1 ? ' &#215;' + src.size : '')"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()"
                              :style="{ background: app.slotColor(src.slot) + '22', color: app.slotColor(src.slot) }">
                            {{ app.slotLabel(src.slot) }}{{ src.size > 1 ? ' &#215;' + src.size : '' }}
                        </span>
                    </div>
                </div>

                <!-- Right -->
                <div class="src-right">
                    <div class="src-val" v-html="valueHtml"></div>
                </div>
            </div>
        </div>
    `
};

const TooltipMixin = {
    data() {
        return { tooltipText: '', tooltipX: 0, tooltipY: 0, tooltipVisible: false };
    },
    methods: {
        showTooltip(e, text = null) {
            const target = e.currentTarget || e.target;
            if (!target) return;
            if (!text && target.offsetWidth >= target.scrollWidth) return;
            this.tooltipText = text ?? target.textContent.trim();
            this.tooltipVisible = true;
            this.$nextTick(() => {
                const el = document.querySelector('.bd-tooltip-global');
                if (!el) return;
                const w = el.offsetWidth;
                let x = e.clientX + 12;
                if (x + w > window.innerWidth) x = e.clientX - w - 12;
                if (x < 8) x = 8;
                this.tooltipX = x;
                this.tooltipY = e.clientY + 12;
            });
        },
        hideTooltip() { this.tooltipVisible = false; },
    }
};

const MixedBreakdown = {
    props: ['app', 'bonusId', 'flat', 'percent', 'multiplier', 'text', 'rowsData', 'className'],
    computed: {
        rows() {
            if (Array.isArray(this.rowsData) && this.rowsData.length) {
                return this.rowsData.map(row => typeof row === 'string' ? { text: row } : row);
            }
            const rows = [];
            if (this.flat != null) {
                rows.push({ text: this.app.formatVal(this.app.normalizeValue(this.flat), this.app.unitFor(this.bonusId, 'flat'), 'flat') });
            }
            if (this.percent != null) {
                rows.push({ text: this.app.formatVal(this.app.normalizeValue(this.percent), this.app.unitFor(this.bonusId, 'percent'), 'percent') });
            }
            if (this.multiplier != null && this.multiplier !== 1) {
                rows.push({ text: this.app.formatVal(this.app.normalizeValue(this.multiplier), this.app.unitFor(this.bonusId, 'multiplier'), 'multiplier') });
            }
            if (!rows.length && this.text) rows.push({ text: this.text });
            return rows;
        }
    },
    template: `
        <div class="max-panel-breakdown" :class="className || ''">
            <span v-for="(row, i) in rows"
                  :key="i"
                  @mousemove="app.showTooltip($event)"
                  @mouseleave="app.hideTooltip()"
                  v-html="row.html || row.text"></span>
        </div>
    `
};

/* ==========================================
   MAX PANEL COMPONENT
========================================== */
const MaxPanel = {
    components: { MixedBreakdown },
    props: ['maxItems', 'maxResult', 'maxTab', 'app', 'showTabSwitcher'],
    emits: ['update-tab'],
    methods: {
        typeColor(type) { return this.app.typeColor(type); },
        formatVal(v, u, ut) { return this.app.formatVal(v, u, ut); },
        unitFor(id, ut) { return this.app.unitFor(id, ut); },
        formatTotal(r) { return this.app.formatTotal(r); },
        itemLabel(item) {
            let s = item.src.name;
            if (item.mult > 1) s += ' ×' + item.mult;
            if (item.src.available === false) s += ' (unavail.)';
            return s;
        },
        formatItemVal(item) {
            const raw = item.unit_type === 'multiplier'
                ? Math.pow(item.value, item.mult)
                : item.value * item.mult;
            const rounded = item.unit_type === 'multiplier'
                ? normalizeValue(raw)
                : raw;
            const prefix = item.unit_type === 'multiplier' && item.mult > 1 ? '~' : '';
            return prefix + this.formatVal(rounded, this.unitFor(item.src.type, item.unit_type), item.unit_type);
        },
    },
    template: `
        <div>
            <div class="max-panel-header">
                <span>{{ showTabSwitcher === false ? (maxTab === 'avail' ? 'Max (Available)' : 'Max (All)') : 'Max' }}</span>
                <div class="max-tab-switcher" v-if="showTabSwitcher !== false">
                    <button class="max-tab-btn" :class="{ active: maxTab === 'avail' }" @click="$emit('update-tab', 'avail')">Available</button>
                    <button class="max-tab-btn" :class="{ active: maxTab === 'all' }"   @click="$emit('update-tab', 'all')">All</button>
                </div>
            </div>
            <div class="max-panel-body">
                <div class="max-panel-val">{{ formatTotal(maxResult) }}</div>
                <div class="breakdown">
                    <div v-for="item in maxItems" :key="item.src.id + item.unit_type" class="bd-row" @click.stop="app.onMaxItemClick(item, $event)">
                        <div class="bd-name">
                            <span class="bd-dot" :style="{ background: typeColor(item.src.type) }"></span>
                            <span class="bd-name-text" @mousemove="app.showTooltip($event)" @mouseleave="app.hideTooltip()" :class="{ 'item-unavailable': item.src.available === false }">
                                {{ itemLabel(item) }}
                            </span>
                            <span v-if="app.srcTierLabel(item.src, item.bonus)" class="tag tag-tier">
                                {{ app.srcTierLabel(item.src, item.bonus) }}
                            </span>
                        </div>
                        <div class="bd-val">
                            {{ formatItemVal(item) }}
                        </div>
                    </div>
                    <div class="bd-total">
                        <span>Total</span>
                        <div style="text-align: right">
                            <div>{{ formatTotal(maxResult) }}</div>
                            <mixed-breakdown :app="app"
                                             :bonus-id="app.selectedBonus"
                                             :flat="maxResult.flat"
                                             :percent="maxResult.percent"
                                             :multiplier="maxResult.multiplier" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};

const ItemPopoverContent = {
    components: { MixedBreakdown },
    props: ['src', 'app', 'embedded'],
    emits: ['close'],
    computed: {
        bonusRows() { return this.app.popoverBonuses(this.src); },
        breakdownBadges() { return this.app.getResourceBreakdownBadges(this.src); },
    },
    methods: {
        imgError(e) { e.target.parentElement.innerHTML = '<div class="src-img-ph"></div>'; },
    },
    template: `
        <div class="item-popover-header" :class="{ 'item-popover-header-embedded': embedded }">
            <div class="item-popover-img">
                <img v-if="src.image" :src="src.image" :alt="src.name" @error="imgError">
                <div v-else class="src-img-ph"></div>
            </div>
            <div>
                <div class="item-popover-name-row" :class="{ 'has-breakdown-badges': embedded && breakdownBadges.length }">
                    <div class="item-popover-name"
                         :title="src.name"
                         @mousemove="app.showTooltip($event)"
                         @mouseleave="app.hideTooltip()">{{ src.name }}</div>
                    <div v-if="embedded && breakdownBadges.length" class="item-breakdown-badges">
                        <button v-for="badge in breakdownBadges"
                                :key="badge.kind"
                                type="button"
                                class="item-enhancement-badge"
                                :aria-label="badge.ariaLabel"
                                @click.stop="app.openPriceBreakdownPopover(src, $event, badge.kind)">
                            <img :src="badge.icon" alt="" class="item-enhancement-icon">
                        </button>
                    </div>
                </div>
                <div class="item-popover-type">
                    {{ app.data.types[src.type]?.label }}
                    <span v-if="src.category" class="item-popover-category" :style="{ color: app.categoryColor(src.category) }">
                        {{ app.categoryLabel(src.category) }}
                    </span>
                </div>
            </div>
            <button class="popover-close" @click="$emit('close')">&times;</button>
        </div>
        <div class="item-popover-bonuses">
            <div v-if="bonusRows.length === 0" class="item-popover-empty">
                No bonuses
            </div>
            <div v-for="(b, bi) in bonusRows" :key="b.bonus + ':' + (b.unit_type || 'flat') + ':' + bi"
                 class="item-popover-row"
                 :class="{ 'item-popover-row-tiers': app.bonusHasTiers(src, b), 'item-popover-row-formula': app.itemBonusUsesFormula(src, b) }"
                @click.stop="app.bonusHasTiers(src, b) ? app.openTierPopoverForBonus(src, b, $event) : null">
                <span class="item-popover-bonus-label">
                    <span v-if="b._is_ascension" class="tag tag-tier">{{ app.srcTierLabel(src, b) }}</span>
                    <span class="item-popover-bonus-label-text"
                          @mousemove="app.showTooltip($event)"
                          @mouseleave="app.hideTooltip()">{{ app.bonusLabel(b.bonus) }}</span>
                </span>
                <span class="item-popover-bonus-val">
                    <mixed-breakdown :app="app"
                                     :bonus-id="b.bonus"
                                     :flat="b._display.flat"
                                     :percent="b._display.percent"
                                     :multiplier="b._display.multiplier"
                                     :text="b._display.text"
                                     :rows-data="b._display.rows"
                                     class-name="item-popover-breakdown" />
                    <img v-if="b._display.icon" :src="b._display.icon" class="bonus-icon-img">
                </span>
                <div v-if="b._display.metaRows?.length" class="item-popover-row-meta">
                    <mixed-breakdown :app="app"
                                     :bonus-id="b.bonus"
                                     :rows-data="b._display.metaRows"
                                     class-name="item-popover-meta-breakdown" />
                </div>
            </div>
        </div>
    `
};

const PriceBreakdownPopover = {
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
        maxLevelHeaderText() {
            const maxLevel = this.displayConfig.finiteMaxLevel;
            return maxLevel != null
                ? `Max Level: ${maxLevel.toLocaleString()}`
                : 'Max Level: not defined';
        },
        headerSubtitleText() {
            if (this.kind === 'disenchantment') {
                return this.levelsView.summary || 'Disenchantment returns';
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
                    <img v-if="src.image" :src="src.image" :alt="src.name" @error="imgError">
                    <div v-else class="src-img-ph"></div>
                </div>
                <div>
                    <div class="item-popover-name">{{ src.name }}</div>
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

const EngineeringPlannerPanel = {
    props: ['app'],
    data() {
        return {
            activeMobileRowId: null,
            helpOpen: false,
            helpPopoverDragReady: false
        };
    },
    mounted() {
        this._engineeringHelpKeydown = (event) => {
            if (event.key === 'Escape' && this.helpOpen) {
                this.closeHelp();
            }
        };
        window.addEventListener('keydown', this._engineeringHelpKeydown);
    },
    beforeUnmount() {
        if (this._engineeringHelpKeydown) {
            window.removeEventListener('keydown', this._engineeringHelpKeydown);
        }
    },
    computed: {
        planner() { return this.app.engineeringPlannerState; },
        rows() { return this.app.engineeringPlannerRows(); },
        slots() { return this.app.engineeringPlannerSlots(); },
        config() { return this.app.engineeringPlannerConfig(); },
        slotUpgrade() { return this.app.engineeringPlannerSlotUpgrade(); },
        isCollapsed() { return this.app.engineeringPlannerCollapsed; },
        activeMobileRow() {
            return this.rows.find(row => row.id === this.activeMobileRowId) ?? null;
        },
        helpRows() {
            return [
                { field: 'Anchor Slot', description: 'The slot you care about. The planner works backward from this slot and calculates only the slots required to feed it.' },
                { field: 'Anchor Speed %', description: 'Your current production speed bonus for the selected slot. This is the reference point used to calculate the required speeds for its dependencies.' },
                { field: this.slotUpgrade?.name ?? 'Slot Upgrade', description: 'Engineer Slot Upgrade tier. It reduces the base time of the earliest slots in the chain, which changes the required dependency speeds.' },
                { field: 'Stable Dependency Ratio', description: 'Per 1 output of the default final chain target, this shows how many outputs are required from each upstream slot. This reference ratio does not depend on your current inputs.' },
                { field: 'Base Time', description: 'Base crafting time after the selected slot-upgrade tier is applied, before any production speed bonus.' },
                { field: 'Max Bonus', description: 'The maximum production speed bonus currently available in this calculator for this slot.' },
                { field: 'Recipe', description: 'The direct inputs required to craft one output of this slot.' },
                { field: 'Cap Time', description: 'The shortest achievable craft time for this slot if you reach its maximum available speed bonus.' },
                { field: 'Cap Output', description: 'The highest output rate this slot can reach at its maximum available speed bonus.' },
                { field: 'Stable Speed', description: 'The production speed bonus this slot needs in order to keep the selected slot supplied at the chosen anchor speed.' },
                { field: 'Stable Time', description: 'The craft time this slot must reach to keep the selected slot supplied at the chosen anchor speed.' },
                { field: 'Stable Output', description: 'The output rate this slot must reach to keep the selected slot supplied at the chosen anchor speed.' }
            ];
        },
        ratioText() {
            const defaultAnchor = this.app.engineeringPlannerDefaultAnchorSlot();
            const weights = this.app.engineeringPlannerWeights(defaultAnchor);
            const configSlots = this.config?.slots ?? [];
            return configSlots
                .filter(slot => Number(weights[slot.id]) > 0)
                .map(slot => `${slot.label} ${weights[slot.id]}`)
                .join(' : ');
        }
    },
    methods: {
        toggleCollapsed() {
            this.app.engineeringPlannerCollapsed = !this.app.engineeringPlannerCollapsed;
            this.app.syncUrl();
        },
        setAnchor(slotId) {
            this.planner.anchorSlot = slotId;
            this.app.syncUrl();
        },
        syncPlannerState() {
            this.app.syncUrl();
        },
        isMobileViewport() {
            return window.matchMedia('(max-width: 900px)').matches;
        },
        toggleHelp() {
            this.helpOpen = !this.helpOpen;
            if (this.helpOpen && !this.isMobileViewport()) {
                this.$nextTick(() => this.setupHelpPopover());
            }
        },
        closeHelp() {
            this.helpOpen = false;
            this.helpPopoverDragReady = false;
        },
        setupHelpPopover() {
            const popover = this.$refs.helpPopover;
            const button = this.$refs.helpButton;
            if (!popover || !button) return;

            if (!this.helpPopoverDragReady) {
                const rect = button.getBoundingClientRect();
                const width = Math.min(853, window.innerWidth - 48);
                const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.right - width));
                const top = Math.min(window.innerHeight - 120, rect.bottom + 10);
                popover.style.width = `${width}px`;
                popover.style.maxWidth = `${width}px`;
                popover.style.left = `${left}px`;
                popover.style.top = `${top}px`;
                popover.style.right = 'auto';
                makeDraggable(popover, popover.querySelector('.popover-header'), null);
                this.helpPopoverDragReady = true;
            }
        },
        openMobileDetails(rowId) {
            this.activeMobileRowId = rowId;
        },
        closeMobileDetails() {
            this.activeMobileRowId = null;
        },
        onSummaryChipClick(row) {
            if (window.matchMedia('(max-width: 900px)').matches) {
                this.openMobileDetails(row.id);
                return;
            }
            this.setAnchor(row.id);
        },
        isAboveAnchor(row) {
            const anchorIndex = this.rows.findIndex(entry => entry.id === this.planner.anchorSlot);
            const rowIndex = this.rows.findIndex(entry => entry.id === row.id);
            return anchorIndex >= 0 && rowIndex >= 0 && rowIndex > anchorIndex;
        },
        formatPercent(value, digits = 1) {
            if (!Number.isFinite(value)) return '--';
            const rounded = Number(value.toFixed(digits));
            return `${rounded.toLocaleString()}%`;
        },
        formatSeconds(value) {
            if (!Number.isFinite(value)) return '--';
            if (value >= 100) return `${value.toFixed(1)}s`;
            if (value >= 10) return `${value.toFixed(2)}s`;
            return `${value.toFixed(3)}s`;
        },
        formatRatePerHour(value) {
            if (!Number.isFinite(value)) return '--';
            const digits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
            return `${Number(value.toFixed(digits)).toLocaleString()}/hr`;
        },
        targetSpeedLabel(row) {
            if (row.inDependencyChain === false) return 'N/A';
            if (!Number.isFinite(row.targetSpeed)) return 'Enter all base times';
            if (row.targetSpeed < 0) return '0% needed';
            return this.formatPercent(row.targetSpeed);
        },
        capLabel(row) {
            if (row.inDependencyChain === false) return 'Outside slot selection';
            if (!Number.isFinite(row.targetSpeed)) return 'Enter all base times';
            if (row.targetSpeed < 0) return 'Already stable at 0% speed';
            if (row.feasible) {
                return `Cap has ${this.formatPercent(row.speedGap)} headroom`;
            }
            return `Needs ${this.formatPercent(Math.abs(row.speedGap))} more than cap`;
        }
    },
    template: `
        <section class="source-section engineering-planner-panel" :style="{ '--section-color': app.typeColor('engineering_production') }">
            <div class="section-header engineering-planner-header" @click="toggleCollapsed">
                <span>Engineering Planner</span>
                <div class="engineering-planner-header-actions">
                    <button type="button" class="engineering-planner-help-btn" ref="helpButton" @click.stop="toggleHelp">Help</button>
                    <span class="section-chev" :class="{ collapsed: isCollapsed }">&#x25BC;</span>
                </div>
            </div>
            <div v-show="!isCollapsed" class="engineering-planner-body">
                <p class="engineering-planner-note">
                    Stable dependency ratio: {{ ratioText }}.
                </p>
                <p class="engineering-planner-note">
                    Select the slot you want to produce, enter its current speed, and the planner works backward through its dependencies only. Downstream products are ignored. Required speeds are calculated with
                    Reduced Time = Base Time / (1 + Speed%).
                </p>

                <div class="engineering-planner-sticky-tools">
                    <div class="engineering-planner-controls">
                        <label class="engineering-field">
                            <span class="engineering-field-label">Anchor Slot</span>
                            <select class="engineering-input" v-model="planner.anchorSlot" @change="syncPlannerState">
                                <option v-for="slot in slots" :key="slot.id" :value="slot.id">{{ slot.label }}</option>
                            </select>
                        </label>
                        <label class="engineering-field">
                            <span class="engineering-field-label">Anchor Speed %</span>
                            <input class="engineering-input" type="number" step="0.1" v-model.number="planner.anchorSpeed" @input="syncPlannerState" @change="syncPlannerState">
                        </label>
                        <label v-if="slotUpgrade" class="engineering-field">
                            <span class="engineering-field-label">{{ slotUpgrade.name }}</span>
                            <select class="engineering-input" v-model.number="planner.slotUpgradeLevel" @change="syncPlannerState">
                                <option :value="0">Off</option>
                                <option v-for="tier in slotUpgrade.maxLevel" :key="tier" :value="tier">Tier {{ tier }}</option>
                            </select>
                        </label>
                    </div>

                    <div class="engineering-planner-summary" aria-label="Planner summary">
                        <button v-for="row in rows"
                             :key="row.id + '-summary'"
                             type="button"
                             class="engineering-summary-chip"
                             :class="{
                                 'engineering-summary-chip-anchor': row.id === planner.anchorSlot,
                                 'engineering-summary-chip-muted': isAboveAnchor(row),
                                 'engineering-summary-chip-overcap': row.feasible === false
                             }"
                             @click="onSummaryChipClick(row)">
                            <span class="engineering-summary-chip-label">{{ row.label }}</span>
                            <strong class="engineering-summary-chip-value">{{ targetSpeedLabel(row) }}</strong>
                        </button>
                    </div>
                </div>

                <div class="engineering-card-grid">
                    <article v-for="row in rows"
                             :key="row.id"
                             class="engineering-card"
                             :class="{
                                 'engineering-card-anchor': row.id === planner.anchorSlot,
                                 'engineering-card-muted': isAboveAnchor(row)
                             }">
                        <div class="engineering-card-head">
                            <div>
                                <div class="engineering-card-title">{{ row.label }}</div>
                                <div class="engineering-card-recipe">{{ row.recipe }}</div>
                            </div>
                            <button type="button"
                                    class="engineering-card-badge"
                                    @click.stop="setAnchor(row.id)">{{ row.id === planner.anchorSlot ? 'Anchor' : 'Target' }}</button>
                        </div>

                        <div class="engineering-stats">
                            <div class="engineering-stat">
                                <span>Base Time</span>
                                <strong>{{ formatSeconds(row.effectiveBaseTime) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Max Bonus</span>
                                <strong>{{ formatPercent(row.maxSpeed) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Recipe</span>
                                <strong>{{ row.recipe }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Cap Time</span>
                                <strong>{{ formatSeconds(row.maxReducedTime) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Cap Output</span>
                                <strong>{{ formatRatePerHour(row.maxRatePerHour) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Stable Speed</span>
                                <strong>{{ targetSpeedLabel(row) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Stable Time</span>
                                <strong>{{ formatSeconds(row.targetReducedTime) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Stable Output</span>
                                <strong>{{ formatRatePerHour(row.targetRatePerHour) }}</strong>
                            </div>
                        </div>

                        <div class="engineering-card-foot">
                            {{ capLabel(row) }}
                        </div>
                    </article>
                </div>

            </div>
            <div v-if="helpOpen && !isMobileViewport()"
                 ref="helpPopover"
                 class="engineering-planner-help-popover popover floating-panel"
                 v-click-outside="closeHelp"
                 @click.stop>
                <div class="popover-header engineering-planner-help-header">
                    <span>Planner Help</span>
                    <button type="button" class="popover-close" @click="closeHelp">&times;</button>
                </div>
                <div class="engineering-planner-help-body">
                    <table class="engineering-planner-help-table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in helpRows" :key="row.field">
                                <td>{{ row.field }}</td>
                                <td>{{ row.description }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <teleport to="body">
                <div class="mobile-drawer-overlay engineering-planner-help-overlay"
                     :class="{ open: helpOpen && isMobileViewport() }"
                     @click="closeHelp"></div>
                <div class="mobile-drawer item-sheet engineering-planner-help-sheet"
                     :class="{ open: helpOpen && isMobileViewport() }"
                     @click.stop>
                    <div v-if="helpOpen && isMobileViewport()" class="mobile-item-sheet">
                        <div class="mobile-drawer-header">
                            <div class="mobile-drawer-handle"></div>
                            <button type="button" class="mobile-drawer-close" @click="closeHelp">&times;</button>
                        </div>
                        <div class="mobile-drawer-body">
                            <div class="item-popover price-breakdown-popover price-breakdown-popover-sheet engineering-planner-popover-sheet">
                                <div class="item-popover-header price-breakdown-popover-header engineering-planner-sheet-head">
                                    <div>
                                        <div class="item-popover-name">Planner Help</div>
                                        <div class="item-popover-type">Fields and formulas used in this calculator</div>
                                    </div>
                                </div>
                                <div class="engineering-mobile-sheet-body">
                                    <table class="engineering-planner-help-table">
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                <th>Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="row in helpRows" :key="'mobile-' + row.field">
                                                <td>{{ row.field }}</td>
                                                <td>{{ row.description }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mobile-drawer-overlay engineering-mobile-sheet-overlay"
                     :class="{ open: !!activeMobileRow }"
                     @click="closeMobileDetails"></div>
                <div class="mobile-drawer item-sheet engineering-mobile-sheet"
                     :class="{ open: !!activeMobileRow }"
                     @click.stop>
                    <div v-if="activeMobileRow" class="mobile-item-sheet engineering-mobile-sheet-content">
                        <div class="mobile-drawer-header">
                            <div class="mobile-drawer-handle"></div>
                            <button type="button" class="mobile-drawer-close" @click="closeMobileDetails">&times;</button>
                        </div>
                        <div class="mobile-drawer-body">
                            <div class="item-popover price-breakdown-popover price-breakdown-popover-sheet engineering-planner-popover-sheet">
                                <div class="item-popover-header price-breakdown-popover-header engineering-planner-sheet-head">
                                <div>
                                    <div class="item-popover-name">{{ activeMobileRow.label }}</div>
                                    <div class="item-popover-type">{{ activeMobileRow.recipe }}</div>
                                </div>
                                </div>
                                <div class="engineering-mobile-sheet-body">
                                    <div class="engineering-stats">
                                        <div class="engineering-stat">
                                            <span>Base Time</span>
                                            <strong>{{ formatSeconds(activeMobileRow.effectiveBaseTime) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Max Bonus</span>
                                            <strong>{{ formatPercent(activeMobileRow.maxSpeed) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Recipe</span>
                                            <strong>{{ activeMobileRow.recipe }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Cap Time</span>
                                            <strong>{{ formatSeconds(activeMobileRow.maxReducedTime) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Cap Output</span>
                                            <strong>{{ formatRatePerHour(activeMobileRow.maxRatePerHour) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Stable Speed</span>
                                            <strong>{{ targetSpeedLabel(activeMobileRow) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Stable Time</span>
                                            <strong>{{ formatSeconds(activeMobileRow.targetReducedTime) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Stable Output</span>
                                            <strong>{{ formatRatePerHour(activeMobileRow.targetRatePerHour) }}</strong>
                                        </div>
                                    </div>
                                    <div class="engineering-card-foot">
                                        {{ capLabel(activeMobileRow) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </teleport>
        </section>
    `
};

function makeDraggable(el, handleEl, onFocus) {
    handleEl.style.cursor = 'grab';
    handleEl.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        onFocus?.();
        const startX = e.clientX - el.offsetLeft;
        const startY = e.clientY - el.offsetTop;
        handleEl.style.cursor = 'grabbing';

        function onMove(e) {
            let x = e.clientX - startX;
            let y = e.clientY - startY;
            x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        }

        function onUp() {
            handleEl.style.cursor = 'grab';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
}

function clampPopover(el) {
    if (!el) return;
    let x = parseFloat(el.style.left) || 0;
    let y = parseFloat(el.style.top) || 0;
    x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

function positionPopover(el, clientX, clientY) {
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    let x = clientX + 12;
    let y = clientY + 12;
    if (x + pw > window.innerWidth) x = clientX - pw - 12;
    if (y + ph > window.innerHeight) y = window.innerHeight - ph - 12;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

/* ==========================================
   MAIN APP
========================================== */
const app = createApp({
    mixins: [TooltipMixin],
    components: { SourceRow, MaxPanel, EmptyState, ItemPopoverContent, MixedBreakdown, PriceBreakdownPopover, EngineeringPlannerPanel },

    directives: {
        clickOutside: {
            mounted(el, binding) {
                el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e); };
                document.addEventListener('click', el._clickOutside);
            },
            unmounted(el) {
                document.removeEventListener('click', el._clickOutside);
            }
        }
    },

    data() {
        return {
            data: null,
            viewMode: 'bonus',
            selectedBonus: null,
            selectedClass: null,
            dropdownOpen: false,
            itemTypeDropdownOpen: false,
            bonusSearch: '',
            itemSearch: '',
            itemType: null,
            hiddenItemSections: new Set(),
            itemSectionAllMode: true,
            conditionPanelOpen: true,
            activeConditions: new Set(),
            collapsedSections: new Set(),
            openDetails: new Set(),
            maxTab: 'avail',
            popoverEntry: null,
            popoverOpenDetails: new Set(),
            parameters: [],
            mobileTab: 'sources',
            mobileSettingsOpen: false,
            itemPopoverEntry: null,
            itemSheetOpen: false,
            tierPopoverEntry: null,
            tierSheetEntry: null,
            priceBreakdownEntry: null,
            priceBreakdownSheetOpen: false,
            _resourceBreakdownCumulativeCache: new WeakMap(),
            _zCounter: 600,
            tierPopoverColThreshold: 10,
            engineeringPlannerCollapsed: false,
            engineeringPlannerState: {
                anchorSlot: null,
                anchorSpeed: 0,
                slotUpgradeLevel: 0
            }
        };
    },

    computed: {
        appRef() { return this; },

        reportUrl() {
            return `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent('[Bonuses] Issue')}&body=${encodeURIComponent('**Bonus:** ' + (this.selectedBonus ?? 'N/A') + '\n\n**Description:**\n')}`;
        },

        visibleSourceTypes() {
            if (!this.data?.sources?.length) return [];
            return Object.entries(this.data.types).filter(([type]) =>
                this.data.sources.some(src => src.type === type)
            );
        },

        filteredBonusTypes() {
            if (!this.data) return [];
            const q = this.bonusSearch.toLowerCase();
            return [...this.data.bonus_types]
                .sort((a, b) => a.label.localeCompare(b.label))
                .filter(bt => !q || bt.label.toLowerCase().includes(q));
        },

        groupedSources() {
            if (!this.data || !this.selectedBonus) return {};
            const ids = this._resolveBonusIds(this.selectedBonus);
            const groups = {};
            for (const src of this.data.sources) {
                const matching = src.bonuses.filter(b => ids.includes(b.bonus));
                if (!matching.length) continue;
                if (!groups[src.type]) groups[src.type] = [];
                groups[src.type].push({ src, bonuses: matching });
            }
            return groups;
        },

        visibleTypes() {
            if (!this.data) return [];
            return Object.entries(this.data.types).filter(([type]) => this.groupedSources[type]?.length);
        },

        itemTypeEntries() {
            if (!this.data?.sources?.length) return [];
            return this.visibleSourceTypes.map(([type, def]) => ({
                type,
                def,
                count: this.data.sources.filter(src => src.type === type).length
            }));
        },

        activeItemType() {
            return this.itemType ?? this.itemTypeEntries[0]?.type ?? null;
        },

        itemSubfilterMode() {
            const sources = this.data?.sources?.filter(src => src.type === this.activeItemType) ?? [];
            if (!sources.length) return null;
            if (sources.some(src => src.category)) return 'category';
            const slots = [...new Set(sources.map(src => src.slot).filter(Boolean))];
            return slots.length > 1 ? 'slot' : null;
        },

        itemSubfilterEntries() {
            const sources = this.filteredItemSources;
            if (!sources.length) return [];
            if (this.itemSubfilterMode === 'category') {
                const entries = (this.data.categories ?? [])
                    .map(category => ({
                        id: category.id,
                        label: category.label,
                        color: category.color,
                        count: sources.filter(src => src.category === category.id).length
                    }))
                    .filter(entry => entry.count);
                const defaultCount = sources.filter(src => !src.category).length;
                if (defaultCount) {
                    entries.push({
                        id: DEFAULT_ITEM_CATEGORY_ID,
                        label: this.itemTypeLabel(this.activeItemType),
                        color: this.typeColor(this.activeItemType),
                        count: defaultCount
                    });
                }
                return entries;
            }
            if (this.itemSubfilterMode === 'slot') {
                return [...new Set(sources.map(src => src.slot).filter(Boolean))]
                    .map(slot => ({
                        id: slot,
                        label: this.slotLabel(slot),
                        color: this.slotColor(slot),
                        count: sources.filter(src => src.slot === slot).length
                    }))
                    .filter(entry => entry.count);
            }
            return [];
        },

        filteredItemSources() {
            if (!this.data?.sources?.length || !this.activeItemType) return [];
            const q = this.itemSearch.trim().toLowerCase();
            return this.data.sources
                .filter(src => src.type === this.activeItemType)
                .filter(src => !q || src.name.toLowerCase().includes(q));
        },

        itemSections() {
            if (!this.filteredItemSources.length) return [];
            if (this.itemSubfilterMode === 'category') {
                return this.itemSubfilterEntries
                    .map(filter => ({
                        id: filter.id,
                        label: filter.label,
                        color: filter.color,
                        items: this.filteredItemSources.filter(src =>
                            filter.id === DEFAULT_ITEM_CATEGORY_ID ? !src.category : src.category === filter.id
                        )
                    }))
                    .filter(section => section.items.length);
            }
            if (this.itemSubfilterMode === 'slot') {
                return this.itemSubfilterEntries
                    .map(filter => ({
                        id: filter.id,
                        label: filter.label,
                        color: filter.color,
                        items: this.filteredItemSources.filter(src => src.slot === filter.id)
                    }))
                    .filter(section => section.items.length);
            }
            const typeDef = this.data?.types?.[this.activeItemType];
            return [{
                id: this.activeItemType,
                label: typeDef?.label ?? this.activeItemType,
                color: typeDef?.tag_style?.color ?? '#888',
                items: this.filteredItemSources
            }];
        },

        visibleItemSections() {
            if (this.itemSectionAllMode) return this.itemSections;
            return this.itemSections.filter(section => !this.hiddenItemSections.has(section.id));
        },

        allItemSectionsVisible() {
            return this.itemSectionAllMode;
        },

        maxItemsAvail() {
            if (!this.data || !this.selectedBonus) return [];
            return this._calcItems(true);
        },

        maxItemsAll() {
            if (!this.data || !this.selectedBonus) return [];
            const hasUnavailable = Object.values(this.groupedSources)
                .flat()
                .some(({ src }) => src.available === false);
            if (!hasUnavailable) return this.maxItemsAvail;
            return this._calcItems(false);
        },

        maxItems() {
            return this.maxTab === 'avail' ? this.maxItemsAvail : this.maxItemsAll;
        },

        maxResult() {
            return this._compoundTotal(this.maxItems);
        },

        showEngineeringPlanner() {
            return this.isEngineeringProductionBonus(this.selectedBonus);
        },

        relevantConditions() {
            if (!this.data || !this.selectedBonus) return this.data?.conditions ?? [];
            const ids = this._resolveBonusIds(this.selectedBonus);
            return this.data.conditions.map(cond => {
                const hasRelevant = Object.values(this.groupedSources)
                    .flat()
                    .some(({ src, bonuses }) =>
                        bonuses.some(b => ids.includes(b.bonus) && b.condition === cond.id)
                    );
                return { ...cond, disabled: !hasRelevant };
            });
        },

    },

    watch: {
        dropdownOpen(val) {
            if (val) nextTick(() => this.$refs.bonusSearchInput?.focus());
        },
        itemTypeDropdownOpen(val) {
            if (val) this.dropdownOpen = false;
        }
    },

    async mounted() {
        this._calcCache = {};
        const params = new URLSearchParams(window.location.search);

        try {
            const r = await fetch('bonuses.json?v=1');
            this.data = await r.json();

            const sourceArrays = await Promise.all(
                this.data.source_files.map(f => fetch(f).then(r => r.json()))
            );
            const resolvedSourceArrays = sourceArrays.map(file => this._resolveSourceRefs(file));
            const itemArrays = await Promise.all(
                (this.data.item_files ?? []).map(f => fetch(f).then(r => r.json()))
            );

            this.data.sources = resolvedSourceArrays.flatMap(file => {
                const sources = Array.isArray(file) ? file : (file.bonuses ?? []);
                return sources.map(src => ({
                    ...src,
                    type: src.type ?? file.type,
                    available: src.available ?? true,
                    _file_tiers_formula: file.tiers_formula ?? null,
                    _file_item_popover: file.item_popover ?? null,
                    bonuses: [
                        ...src.bonuses.map(b => {
                            const formula = this._resolveFormula({ _file_tiers_formula: file.tiers_formula ?? null, ...src }, b);
                            return { ...b, value: formula ? this._applyFormula(formula) : (b.value ?? 0) };
                        }),
                        ...(src.ascension_bonuses ?? []).map(b => {
                            const formula = this._resolveFormula({ _file_tiers_formula: file.tiers_formula ?? null, ...src }, b);
                            return { ...b, value: formula ? this._applyFormula(formula, b.unlock_at_tier ?? 0) : (b.value ?? 0), _is_ascension: true };
                        }),
                    ]
                }));
            });
            this.data.engineeringPlanner = resolvedSourceArrays.find(file =>
                !Array.isArray(file) && file.type === 'engineering_production'
            )?.planner ?? null;
            this.data.items = itemArrays
                .flatMap(file => Array.isArray(file) ? file : (file.items ?? []))
                .reduce((acc, item) => {
                    if (!item?.id) return acc;
                    acc.set(item.id, item);
                    return acc;
                }, new Map());

            this.parameters = (this.data.parameters ?? []).map(p => {
                const min = p.min ?? 0, max = p.max ?? Infinity;

                let v = Math.min(max, Math.max(min, Number(params.get(p.key) ?? p.default ?? min)));

                Object.defineProperty(p, 'value', {
                    get: () => v,
                    set: val => v = Math.min(max, Math.max(min, Number(val ?? min)))
                });

                return p;
            });

            this.engineeringPlannerState.anchorSlot =
                this.data.engineeringPlanner?.default_anchor_slot
                ?? this.data.engineeringPlanner?.slots?.[0]?.id
                ?? null;
            this.engineeringPlannerState.slotUpgradeLevel = this.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;
        } catch (e) {
            console.error(e);
            document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
            return;
        }

        const bonusKey = params.get('b');
        const bonusId = bonusKey
            ? this.data.bonus_types.find(b => b.key === bonusKey)?.id ?? bonusKey
            : null;

        const viewParam = params.get('v');
        this.viewMode = viewParam === 'i' ? 'item' : 'bonus';
        this.itemSearch = params.get('iq') ?? '';

        const classKey = params.get('c');
        this.selectedClass = classKey
            ? this.data.classes.find(c => c.key === classKey)?.id ?? classKey
            : this.data.classes[0].id;

        const condParam = params.get('cd');
        if (condParam) {
            condParam.split('-').forEach(key => {
                const cond = this.data.conditions?.find(c => c.key === key);
                if (cond) this.activeConditions.add(cond.id);
            });
        }

        const collapsedParam = params.get('s');
        if (collapsedParam) {
            collapsedParam.split('-').forEach(key => {
                const type = Object.entries(this.data.types).find(([, v]) => v.key === key)?.[0];
                if (type) this.collapsedSections.add(type);
            });
        }
        this.engineeringPlannerCollapsed = params.get('ec') === '1';

        const plannerAnchor = params.get('ea');
        if (plannerAnchor) {
            const slot = this.engineeringPlannerSlotByKey(plannerAnchor);
            if (slot) this.engineeringPlannerState.anchorSlot = slot.id;
        }

        const plannerSpeed = params.get('ev');
        if (plannerSpeed != null && plannerSpeed !== '') {
            const parsed = Number(plannerSpeed);
            if (Number.isFinite(parsed)) this.engineeringPlannerState.anchorSpeed = parsed;
        }

        const plannerUpgradeLevel = params.get('eu');
        if (plannerUpgradeLevel != null && plannerUpgradeLevel !== '') {
            const parsed = Number(plannerUpgradeLevel);
            const maxLevel = this.engineeringPlannerSlotUpgrade()?.maxLevel ?? 0;
            if (Number.isFinite(parsed)) {
                this.engineeringPlannerState.slotUpgradeLevel = Math.max(0, Math.min(parsed, maxLevel));
            }
        }

        if (bonusId) this.selectedBonus = bonusId;

        const itemTypeParam = params.get('iy');
        const itemTypeId = itemTypeParam
            ? Object.entries(this.data.types).find(([, def]) => def.key === itemTypeParam)?.[0]
            : null;
        this.itemType = itemTypeId && this.data.types[itemTypeId] ? itemTypeId : (this.itemTypeEntries[0]?.type ?? null);
        const hiddenItemSectionsParam = params.get('ih');
        const itemSubfilterParam = params.get('is');
        if (hiddenItemSectionsParam) {
            const hiddenIds = hiddenItemSectionsParam
                .split('-')
                .filter(Boolean)
                .map(id => {
                    if (this.itemSubfilterMode !== 'category') return id;
                    if (id === DEFAULT_ITEM_CATEGORY_KEY) return DEFAULT_ITEM_CATEGORY_ID;
                    return this.data.categories?.find(category => category.key === id)?.id;
                });
            this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(hiddenIds));
            this.itemSectionAllMode = this.hiddenItemSections.size === 0;
        } else if (itemSubfilterParam) {
            const visibleIds = itemSubfilterParam
                .split('-')
                .filter(Boolean)
                .map(id => {
                    if (this.itemSubfilterMode !== 'category') return id;
                    if (id === DEFAULT_ITEM_CATEGORY_KEY) return DEFAULT_ITEM_CATEGORY_ID;
                    return this.data.categories?.find(category => category.key === id)?.id;
                })
                .filter(Boolean);
            const selectedId = visibleIds.find(id =>
                this.itemSubfilterEntries.some(entry => entry.id === id)
            );
            const visible = new Set(selectedId ? [selectedId] : []);
            const hidden = this.itemSubfilterEntries
                .map(entry => entry.id)
                .filter(id => !visible.has(id));
            this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(hidden));
            this.itemSectionAllMode = visible.size === 0 || this.hiddenItemSections.size === 0;
        } else {
            this.itemSectionAllMode = true;
        }

        this._bindMobileScroll();

        const tabParam = params.get('t');
        if (tabParam) {
            const tab = tabParam === 'a' ? 'avail' : tabParam === 'l' ? 'all' : 'sources';
            this.mobimaxleTab = tab;
            nextTick(() => this._scrollTo?.(['sources', 'avail', 'all'].indexOf(tab)));
        }

        window.addEventListener('resize', () => {
            clampPopover(document.getElementById('item-popover'));
            clampPopover(document.getElementById('popover'));
            clampPopover(document.getElementById('price-breakdown-popover'));
        });

        document.addEventListener('click', (e) => {
            const desktop = document.querySelector('.sidebar-left .bonus-select-wrap');
            const mobile = document.querySelector('.mobile-bonus-wrap');
            if (!desktop?.contains(e.target) && !mobile?.contains(e.target)) {
                this.dropdownOpen = false;
                this.itemTypeDropdownOpen = false;
            }
            this.popoverEntry = null;
            if (!document.getElementById('item-popover')?.contains(e.target)) {
                this.itemPopoverEntry = null;
            }
            if (!document.getElementById('tier-popover')?.contains(e.target)) {
                this.tierPopoverEntry = null;
            }
            if (!document.getElementById('price-breakdown-popover')?.contains(e.target)) {
                this.priceBreakdownEntry = null;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.tierPopoverEntry) { this.closeTierPopover(); return; }
            if (this.priceBreakdownEntry) { this.closePriceBreakdownPopover(); return; }
            if (this.itemPopoverEntry) { this.closeItemPopover(); return; }
            if (this.popoverEntry) { this.closePopover(); return; }
        });
    },

    methods: {
        /* -- ACTIONS -- */
        setMobileTab(val) {
            this.mobileTab = val;
            this.syncUrl();
            let idx;
            switch (val) {
                case 'sources': idx = 0; break;
                case 'avail':   idx = 1; break;
                case 'all':     idx = 2; break;
            }
            if (this._scrollTo) this._scrollTo(idx);
        },

        _bindMobileScroll() {
            const scroller = this.$refs.mobileScroll;
            if (!scroller) {
                this._scrollTo = null;
                return;
            }
            if (this._mobileScrollEl === scroller) return;
            if (this._mobileScrollEl && this._mobileScrollEndHandler) {
                this._mobileScrollEl.removeEventListener('scrollend', this._mobileScrollEndHandler);
            }
            this._mobileScrollEl = scroller;
            this._scrollTo = (idx) => {
                scroller.scrollTo({ left: idx * window.innerWidth, behavior: 'smooth' });
            };
            this._mobileScrollEndHandler = () => {
                const idx = Math.round(scroller.scrollLeft / window.innerWidth);
                this.mobileTab = ['sources', 'avail', 'all'][idx] ?? 'sources';
            };
            scroller.addEventListener('scrollend', this._mobileScrollEndHandler);
        },

        selectBonus(id) {
            this.viewMode = 'bonus';
            this.selectedBonus = id;
            this.itemTypeDropdownOpen = false;
            this.openDetails = new Set();
            this.syncUrl();
        },

        setViewMode(mode) {
            this.viewMode = mode;
            this.dropdownOpen = false;
            this.itemTypeDropdownOpen = false;
            if (mode === 'item' && !this.itemType) {
                this.itemType = this.itemTypeEntries[0]?.type ?? null;
            }
            if (mode === 'bonus') {
                nextTick(() => {
                    this._bindMobileScroll();
                    this._scrollTo?.(['sources', 'avail', 'all'].indexOf(this.mobileTab));
                });
            } else {
                this._scrollTo = null;
            }
            this.syncUrl();
        },

        selectItemType(type) {
            this.itemType = type;
            this.itemTypeDropdownOpen = false;
            this.hiddenItemSections = new Set();
            this.itemSectionAllMode = true;
            this.syncUrl();
        },

        normalizeHiddenItemSections(hiddenIds) {
            const validIds = new Set(this.itemSubfilterEntries.map(entry => entry.id));
            const normalized = new Set(
                [...hiddenIds].filter(id => validIds.has(id))
            );
            if (validIds.size && normalized.size >= validIds.size) {
                return new Set();
            }
            return normalized;
        },

        toggleItemSection(id) {
            if (this.itemSectionAllMode) {
                this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(
                    this.itemSubfilterEntries
                        .map(entry => entry.id)
                        .filter(entryId => entryId !== id)
                ));
                this.itemSectionAllMode = false;
                this.syncUrl();
                return;
            }
            this.hiddenItemSections = this.normalizeHiddenItemSections(new Set(
                this.itemSubfilterEntries
                    .map(entry => entry.id)
                    .filter(entryId => entryId !== id)
            ));
            this.itemSectionAllMode = false;
            this.syncUrl();
        },

        showAllItemSections() {
            this.hiddenItemSections = new Set();
            this.itemSectionAllMode = true;
            this.syncUrl();
        },

        isItemSectionVisible(id) {
            return this.itemSectionAllMode || !this.hiddenItemSections.has(id);
        },

        isItemSectionSelected(id) {
            return !this.itemSectionAllMode && !this.hiddenItemSections.has(id);
        },

        toggleSection(type) {
            const s = new Set(this.collapsedSections);
            s.has(type) ? s.delete(type) : s.add(type);
            this.collapsedSections = s;
            this.syncUrl();
        },

        itemSectionKey(section) {
            return `item:${this.activeItemType}:${section.id}`;
        },

        toggleDetail(srcId) {
            const s = new Set(this.openDetails);
            s.has(srcId) ? s.delete(srcId) : s.add(srcId);
            this.openDetails = s;
        },

        toggleCondition(condId) {
            const s = new Set(this.activeConditions);
            s.has(condId) ? s.delete(condId) : s.add(condId);
            this.activeConditions = s;
        },

        isParamMet(paramId, min) {
            const p = this.parameters.find(p => p.id === paramId);
            return p && p.value >= min;
        },
        paramLabel(id) {
            return this.parameters.find(p => p.id === id)?.label ?? id;
        },

        columnEntries(type) {
            return this.groupedSources[type] ?? [];
        },

        itemSectionStyle(section) {
            return { '--section-color': section.color };
        },

        syncUrl() {
            if (!this.data) return;
            const params = new URLSearchParams();
            if (this.viewMode === 'item') {
                params.set('v', 'i');
            }
            if (this.selectedBonus) {
                const bt = this.data.bonus_types.find(b => b.id === this.selectedBonus);
                if (bt?.key) params.set('b', bt.key);
            }
            if (this.selectedClass) {
                const cls = this.data.classes.find(c => c.id === this.selectedClass);
                if (cls?.key) params.set('c', cls.key);
            }
            this.parameters.forEach(p => {
                const def = p.default ?? p.min ?? 0;
                p.value !== def
                    ? params.set(p.key, p.value)
                    : params.delete(p.key);
            });
            if (this.activeConditions.size) {
                params.set('cd', [...this.activeConditions].map(id =>
                    this.data.conditions?.find(c => c.id === id)?.key ?? id
                ).join('-'));
            }
            const visCollapsed = [...this.collapsedSections].filter(t => !!this.groupedSources[t]);
            if (visCollapsed.length) {
                params.set('s', visCollapsed.map(t => this.data.types[t]?.key ?? t).join('-'));
            }
            if (this.engineeringPlannerCollapsed) {
                params.set('ec', '1');
            }
            const plannerAnchor = this.engineeringPlannerSlotById(this.engineeringPlannerState.anchorSlot);
            if (plannerAnchor?.key && this.engineeringPlannerState.anchorSlot !== this.engineeringPlannerDefaultAnchorSlot()) {
                params.set('ea', plannerAnchor.key);
            }
            if (this.engineeringPlannerState.anchorSpeed) {
                params.set('ev', this.normalizeValue(this.engineeringPlannerState.anchorSpeed, 3));
            }
            const plannerSlotUpgrade = this.engineeringPlannerSlotUpgrade();
            if (this.engineeringPlannerState.slotUpgradeLevel !== (plannerSlotUpgrade?.defaultLevel ?? 0)) {
                params.set('eu', this.engineeringPlannerState.slotUpgradeLevel);
            }
            if (this.mobileTab !== 'sources') {
                params.set('t', this.mobileTab === 'avail' ? 'a' : 'l');
            }
            if (this.itemSearch) params.set('iq', this.itemSearch);
            if (this.itemType) params.set('iy', this.data.types[this.itemType]?.key);
            const visibleItemSections = this.itemSubfilterEntries
                .map(entry => entry.id)
                .filter(id => !this.hiddenItemSections.has(id));
            if (!this.itemSectionAllMode && visibleItemSections.length) {
                const selectedItemSectionKey = (() => {
                    const id = visibleItemSections[0];
                    if (this.itemSubfilterMode !== 'category') return id;
                    if (id === DEFAULT_ITEM_CATEGORY_ID) return DEFAULT_ITEM_CATEGORY_KEY;
                    return this.data.categories?.find(category => category.id === id)?.key;
                })();
                if (selectedItemSectionKey) params.set('is', selectedItemSectionKey);
            }
            history.replaceState(null, '', '?' + params.toString());
        },

        /* -- DISPLAY HELPERS (also used by child components via :app="appRef") -- */
        bonusLabel(id)     { return this.data?.bonus_types.find(b => b.id === id)?.label ?? id; },
        scalesLabel(id)    {
            const p = this.parameters.find(b => b.id === id);
            return p?.badge_label ?? p?.label ?? id;
        },
        classLabel(id)     { return this.data?.classes.find(c => c.id === id)?.label ?? id; },
        classColor(id)     { return this.data?.classes.find(c => c.id === id)?.color ?? '#6090c0'; },
        conditionLabel(id) { return this.data?.conditions?.find(c => c.id === id)?.label ?? id; },
        typeColor(type)    { return this.data?.types[type]?.tag_style?.color ?? '#888'; },
        slotMax(slotId)    { return this.data?.slot_types.find(s => s.id === slotId)?.max ?? 1; },
        slotLabel(slotId)  { return this.data?.slot_types.find(s => s.id === slotId)?.label ?? slotId; },
        slotColor(slotId)  { return this.data?.slot_types.find(s => s.id === slotId)?.color ?? '#888'; },
        categoryLabel(id)  { return this.data?.categories?.find(c => c.id === id)?.label ?? id; },
        categoryColor(id)  { return this.data?.categories?.find(c => c.id === id)?.color ?? '#888'; },
        unitFor(bonusId, unitType) { return unitFor(this.data?.bonus_types ?? [], bonusId, unitType); },
        formatVal(value, unit, unitType) { return formatVal(value, unit, unitType); },
        normalizeValue(value, digits) { return normalizeValue(value, digits); },
        itemTypeLabel(type) { return this.data?.types?.[type]?.label ?? type; },
        engineeringPlannerConfig() { return this.data?.engineeringPlanner ?? null; },
        engineeringPlannerSlotUpgrade() {
            const config = this.engineeringPlannerConfig()?.slot_upgrade;
            if (!config?.source_id) return null;
            const src = this.data?.sources?.find(source => source.id === config.source_id) ?? null;
            if (!src) return null;
            const multiplier = Number(src.bonuses?.find(b => b.bonus === 'engineer_production_speed' && b.unit_type === 'multiplier')?.value ?? 1);
            const maxLevel = src.bonuses?.filter(b => b.format === 'plain' && /^Cost \(Tier \d+\)$/.test(b.bonus)).length ?? 0;
            return {
                sourceId: config.source_id,
                defaultLevel: Number(config.default_level ?? 0),
                name: src.name,
                multiplier,
                maxLevel
            };
        },
        engineeringPlannerDefaultAnchorSlot() {
            return this.engineeringPlannerConfig()?.default_anchor_slot
                ?? this.engineeringPlannerConfig()?.slots?.[0]?.id
                ?? null;
        },
        engineeringPlannerSlotById(slotId) {
            return this.engineeringPlannerConfig()?.slots?.find(slot => slot.id === slotId) ?? null;
        },
        engineeringPlannerSlotByKey(slotKey) {
            return this.engineeringPlannerConfig()?.slots?.find(slot => slot.key === slotKey) ?? null;
        },
        engineeringPlannerSlots() {
            const slots = this.engineeringPlannerConfig()?.slots ?? [];
            const weights = this.engineeringPlannerWeights();
            return slots.map(slot => ({
                ...slot,
                weight: weights[slot.id] ?? null,
                recipe: this.engineeringRecipeLabel(slot)
            }));
        },
        isEngineeringProductionBonus(bonusId) {
            if (!bonusId) return false;
            if (bonusId === 'engineer_production_speed') return !!this.engineeringPlannerConfig();
            return this.engineeringPlannerSlots().some(slot => slot.bonus === bonusId);
        },
        engineeringRecipeLabel(slot) {
            const consumes = Object.entries(slot.consumes ?? {});
            if (!consumes.length) return 'Time only';
            return consumes.map(([itemId, amount]) => `${amount} ${this.engineeringItemLabel(itemId, amount)}`).join(' + ');
        },
        engineeringItemLabel(itemId, amount = 1) {
            const base = this.data?.items?.get(itemId)?.name
                ?? this.categoryLabel(itemId)
                ?? itemId;
            return amount === 1 ? base : `${base}${base.endsWith('s') ? '' : 's'}`;
        },
        engineeringPlannerWeights(anchorSlotId = this.engineeringPlannerState.anchorSlot) {
            const slots = this.engineeringPlannerConfig()?.slots ?? [];
            if (!slots.length) return {};

            const producers = new Map();
            for (const slot of slots) {
                const produceEntries = Object.entries(slot.produces ?? {});
                if (!produceEntries.length) continue;
                const [itemId, amount] = produceEntries[0];
                producers.set(itemId, { slot, amount: Number(amount) || 1 });
            }

            const anchorSlot = slots.find(slot => slot.id === anchorSlotId) ?? null;
            const [anchorItemId] = Object.keys(anchorSlot?.produces ?? {});
            if (!anchorItemId) return {};

            const requirements = { [anchorItemId]: 1 };
            const expandRequirements = (itemId, amountNeeded) => {
                const producer = producers.get(itemId);
                if (!producer) return;
                const producedAmount = producer.amount || 1;
                for (const [inputId, inputAmount] of Object.entries(producer.slot.consumes ?? {})) {
                    const inputRequired = amountNeeded * (Number(inputAmount) || 0) / producedAmount;
                    requirements[inputId] = (requirements[inputId] ?? 0) + inputRequired;
                    expandRequirements(inputId, inputRequired);
                }
            };
            expandRequirements(anchorItemId, 1);

            const weights = {};
            for (const slot of slots) {
                const [producedItemId] = Object.keys(slot.produces ?? {});
                if (!producedItemId) continue;
                if (requirements[producedItemId] > 0) {
                    weights[slot.id] = requirements[producedItemId];
                }
            }
            return weights;
        },
        engineeringProductionMaxPercent(bonusId) {
            if (!this.data?.sources?.length) return 0;
            return this.data.sources
                .filter(src => src.type === 'engineering_production')
                .reduce((total, src) => total + src.bonuses
                    .filter(b => b.bonus === bonusId && (b.unit_type ?? 'flat') === 'percent')
                    .reduce((sum, b) => sum + this._resolveValue(b), 0), 0);
        },
        engineeringPlannerRows() {
            const planner = this.engineeringPlannerState;
            const anchorSlot = planner.anchorSlot;
            const weights = this.engineeringPlannerWeights(anchorSlot);
            const slots = this.engineeringPlannerSlots().map(slot => ({
                ...slot,
                weight: weights[slot.id] ?? null
            }));
            const slotUpgrade = this.engineeringPlannerSlotUpgrade();
            const slotUpgradeLevel = Math.max(0, Math.min(Number(planner.slotUpgradeLevel ?? 0), slotUpgrade?.maxLevel ?? 0));
            const slotById = new Map(slots.map(slot => [slot.id, slot]));
            const anchorConfig = slotById.get(anchorSlot);
            const anchorIndex = slots.findIndex(slot => slot.id === anchorSlot);
            const anchorMultiplier = anchorIndex >= 0 && anchorIndex < slotUpgradeLevel ? Number(slotUpgrade?.multiplier ?? 1) : 1;
            const anchorBaseTime = Number(anchorConfig?.base_time ?? 0) / Math.max(anchorMultiplier, 1);
            const anchorSpeed = Number(planner.anchorSpeed ?? 0);
            const anchorWeight = Number(anchorConfig?.weight) || null;
            const anchorProducedAmount = Number(Object.values(anchorConfig?.produces ?? {})[0]) || 1;
            const anchorRatePerSecond = anchorBaseTime > 0 && anchorWeight
                ? ((1 + anchorSpeed / 100) / anchorBaseTime) * anchorProducedAmount
                : null;
            const chainScale = Number.isFinite(anchorRatePerSecond) && anchorRatePerSecond > 0
                ? anchorRatePerSecond / anchorWeight
                : null;

            return slots.map(slot => {
                const slotIndex = slots.findIndex(entry => entry.id === slot.id);
                const rawBaseTime = Number(slot.base_time);
                const slotUpgradeMultiplier = slotIndex >= 0 && slotIndex < slotUpgradeLevel ? Number(slotUpgrade?.multiplier ?? 1) : 1;
                const effectiveBaseTime = rawBaseTime / Math.max(slotUpgradeMultiplier, 1);
                const producedAmount = Number(Object.values(slot.produces ?? {})[0]) || 1;
                const maxSpeed = this.engineeringProductionMaxPercent(slot.bonus);
                const maxReducedTime = effectiveBaseTime > 0 ? effectiveBaseTime / (1 + maxSpeed / 100) : null;
                const maxRatePerHour = Number.isFinite(maxReducedTime) && maxReducedTime > 0
                    ? (3600 / maxReducedTime) * producedAmount
                    : null;
                const inDependencyChain = Number(slot.weight) > 0;

                let targetRatePerSecond = null;
                let targetReducedTime = null;
                let targetSpeed = null;
                let feasible = null;
                let speedGap = null;

                if (inDependencyChain && chainScale && effectiveBaseTime > 0) {
                    targetRatePerSecond = chainScale * slot.weight;
                    const targetCyclesPerSecond = targetRatePerSecond / producedAmount;
                    const rawTargetReducedTime = targetCyclesPerSecond > 0 ? 1 / targetCyclesPerSecond : null;
                    const rawTargetSpeed = targetCyclesPerSecond > 0 ? ((effectiveBaseTime * targetCyclesPerSecond) - 1) * 100 : null;
                    targetReducedTime = rawTargetReducedTime;
                    targetSpeed = rawTargetSpeed;

                    if (Number.isFinite(targetSpeed)) {
                        const requiredSpeed = Math.max(0, targetSpeed);
                        if (targetSpeed < 0) {
                            targetSpeed = 0;
                            targetReducedTime = effectiveBaseTime;
                            targetRatePerSecond = producedAmount / effectiveBaseTime;
                        }
                        feasible = maxSpeed >= requiredSpeed;
                        speedGap = maxSpeed - requiredSpeed;
                    }
                }

                return {
                    ...slot,
                    rawBaseTime,
                    effectiveBaseTime,
                    slotUpgradeMultiplier,
                    inDependencyChain,
                    maxSpeed,
                    maxReducedTime,
                    maxRatePerHour,
                    targetSpeed,
                    targetReducedTime,
                    targetRatePerHour: Number.isFinite(targetRatePerSecond) ? targetRatePerSecond * 3600 : null,
                    feasible,
                    speedGap
                };
            });
        },

        itemBonusGroups(src, ascensionOnly = false) {
            const visible = (src.bonuses ?? []).filter(b => !!b._is_ascension === ascensionOnly);
            const grouped = [];
            const byKey = new Map();

            for (const b of visible) {
                const key = `${b.bonus}:${b._is_ascension ? 1 : 0}:${b.format === 'plain' ? grouped.length : 'value'}`;
                if (!byKey.has(key)) {
                    const first = { ...b, _groupBonuses: [b] };
                    byKey.set(key, first);
                    grouped.push(first);
                } else {
                    byKey.get(key)._groupBonuses.push(b);
                }
            }

            return grouped;
        },

        itemBonusRange(src, bonus) {
            const rows = this._getTierRows(src, bonus, bonus.bonus);
            if (!rows?.length) {
                const value = this._resolveValue(bonus);
                return value == null ? null : { min: value, max: value };
            }
            const values = rows
                .map(row => row?.[bonus.bonus])
                .filter(value => value != null);
            if (!values.length) return null;
            return {
                min: Math.min(...values),
                max: Math.max(...values)
            };
        },

        formatBonusValueRange(bonusId, unitType, min, max) {
            const ut = unitType || 'flat';
            const unit = this.unitFor(bonusId, ut);
            const from = formatVal(this.normalizeValue(min, 2), unit, ut);
            const to = formatVal(this.normalizeValue(max, 2), unit, ut);
            return from === to ? from : `${from} → ${to}`;
        },

        _itemBonusDisplayLegacy(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            const icon = group.find(entry => entry.icon)?.icon ?? null;
            if (group.length === 1 && group[0].format === 'plain') {
                return { text: group[0].value, rows: null, flat: null, percent: null, multiplier: null, icon };
            }

            const totals = {
                flat: { min: 0, max: 0, seen: false },
                percent: { min: 0, max: 0, seen: false },
                multiplier: { min: 1, max: 1, seen: false }
            };
            for (const entry of group) {
                if (entry.format === 'plain') continue;
                const range = this.itemBonusRange(src, entry);
                if (!range) continue;
                const unitType = entry.unit_type || 'flat';
                const bucket = totals[unitType];
                bucket.seen = true;
                if (unitType === 'multiplier') {
                    bucket.min *= range.min;
                    bucket.max *= range.max;
                } else {
                    bucket.min += range.min;
                    bucket.max += range.max;
                }
            }

            if (!items.length) return { text: this.itemBonusRange(src, bonus) ?? '—', flat: null, percent: null, multiplier: null, icon };

            const result = this._compoundTotal(items);
            if (!result.isMixed) {
                const ut = result.unit_type || 'flat';
                return {
                    text: formatVal(this.normalizeValue(result.value), this.unitFor(bonus.bonus, ut), ut),
                    flat: null,
                    percent: null,
                    multiplier: null,
                    icon
                };
            }

            return {
                text: null,
                flat: result.flat ? this.normalizeValue(result.flat) : null,
                percent: result.percent ? this.normalizeValue(result.percent) : null,
                multiplier: result.multiplier !== 1 ? this.normalizeValue(result.multiplier) : null,
                icon
            };
        },

        itemBonusHasDetails(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            return group.some(entry => !!this._getTierRows(src, entry, entry.bonus));
        },

        itemBonusUsesFormula(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            return this.viewMode === 'item' && group.some(entry => entry.format !== 'plain' && !!entry.scales_with);
        },

        itemBonusDisplay(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            const icon = group.find(entry => entry.icon)?.icon ?? null;
            if (group.length === 1 && group[0].format === 'plain') {
                return { text: group[0].value, rows: null, flat: null, percent: null, multiplier: null, icon };
            }

            if (this.viewMode === 'item') {
                const valueRows = group
                    .filter(entry => entry.format !== 'plain')
                    .map(entry => entry.scales_with
                        ? this._formatScaledBonusRangeRow(src, entry)
                        : { text: this._formatItemFormulaValueRange(src, entry) })
                    .filter(row => row && row.text);

                return {
                    text: valueRows.length ? null : '-',
                    rows: valueRows.length ? valueRows : null,
                    metaRows: null,
                    flat: null,
                    percent: null,
                    multiplier: null,
                    icon
                };
            }

            const totals = {
                flat: { min: 0, max: 0, seen: false },
                percent: { min: 0, max: 0, seen: false },
                multiplier: { min: 1, max: 1, seen: false }
            };

            for (const entry of group) {
                if (entry.format === 'plain') continue;
                const range = this.itemBonusRange(src, entry);
                if (!range) continue;
                const unitType = entry.unit_type || 'flat';
                const bucket = totals[unitType];
                bucket.seen = true;
                if (unitType === 'multiplier') {
                    bucket.min *= range.min;
                    bucket.max *= range.max;
                } else {
                    bucket.min += range.min;
                    bucket.max += range.max;
                }
            }

            const rows = [];
            if (totals.flat.seen) {
                rows.push(this.formatBonusValueRange(bonus.bonus, 'flat', totals.flat.min, totals.flat.max));
            }
            if (totals.percent.seen) {
                rows.push(this.formatBonusValueRange(bonus.bonus, 'percent', totals.percent.min, totals.percent.max));
            }
            if (totals.multiplier.seen) {
                rows.push(this.formatBonusValueRange(bonus.bonus, 'multiplier', totals.multiplier.min, totals.multiplier.max));
            }

            const metaRows = group
                .filter(entry => entry.format !== 'plain')
                .flatMap(entry => this._formatItemFormulaRows(src, entry).slice(1))
                .filter(Boolean);

            return {
                text: rows[0] ?? '-',
                rows: rows.length > 1 ? rows : null,
                metaRows: metaRows.length ? metaRows : null,
                flat: null,
                percent: null,
                multiplier: null,
                icon
            };
        },

        openItemBonusTiers(src, bonus, event) {
            if (!this.itemBonusHasDetails(src, bonus)) return;
            this.openTierPopover({ src, bonuses: bonus._groupBonuses ?? [bonus] }, event, false);
        },

        formatTotal(result) {
            if (!result) return '—';
            let ut = result.unit_type || 'flat';

            if (result.value === 0 && this.selectedBonus) {
                const unitTypes = new Set();
                for (const entries of Object.values(this.groupedSources)) {
                    for (const { bonuses } of entries) {
                        for (const b of bonuses) {
                            unitTypes.add(b.unit_type || 'flat');
                        }
                    }
                }
                if (unitTypes.size === 1) ut = [...unitTypes][0];
            }

            const u = this.unitFor(this.selectedBonus, ut);
            return formatVal(Math.round(result.value * 10) / 10, u, result.isMixed ? 'flat' : ut);
        },

        _scaleMeta(val, scalesWith, scaleFormula = null) {
            const param = this.parameters?.find(p => p.id === scalesWith);
            if (!param) return null;

            const baseVal = Number(val ?? 0);
            if (scaleFormula?.type === 'param_over_base_minus_value') {
                const operand = Number(scaleFormula.base ?? 0) - baseVal;
                const total = operand === 0 ? 0 : param.value / operand;
                return { param, operand, operator: '/', total };
            }

            return { param, operand: baseVal, operator: '*', total: param.value * baseVal };
        },

        _scaleNumberDecimals(value) {
            const s = this.normalizeValue(Number(value ?? 0)).toString().split('.')[1] ?? '';
            return s.length;
        },

        _formatScaleNumber(value, decimals = null) {
            const normalized = this.normalizeValue(Number(value ?? 0));
            if (decimals == null) return normalized.toLocaleString();
            return normalized.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        _formatScaledContext(meta, options = {}) {
            const { scaleFormulaType = null, decimals = null } = options;
            const paramLabel = meta.param.label ?? this.scalesLabel(meta.param.id);
            const operand = this._formatScaleNumber(meta.operand, decimals);

            if (scaleFormulaType === 'param_over_base_minus_value') {
                return `1 per ${operand} ${paramLabel}`;
            }

            return `${paramLabel} x ${operand}`;
        },

        _escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        _tokenizeFormulaExpression(expression) {
            const source = String(expression ?? '')
                .trim()
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            const tokens = [];
            let i = 0;

            while (i < source.length) {
                const ch = source[i];
                if (/\s/.test(ch)) {
                    i += 1;
                    continue;
                }
                if (/[0-9.]/.test(ch)) {
                    let j = i + 1;
                    while (j < source.length) {
                        const next = source[j];
                        if (/[0-9.]/.test(next)) {
                            j += 1;
                            continue;
                        }
                        if (
                            next === ','
                            && /[0-9]/.test(source[j - 1] ?? '')
                            && /[0-9]/.test(source[j + 1] ?? '')
                        ) {
                            j += 1;
                            continue;
                        }
                        break;
                    }
                    tokens.push({ type: 'number', value: source.slice(i, j) });
                    i = j;
                    continue;
                }
                if ('()+-*/^,[]'.includes(ch)) {
                    tokens.push({ type: ch, value: ch });
                    i += 1;
                    continue;
                }
                if (/[A-Za-z_]/.test(ch)) {
                    let j = i + 1;
                    while (j < source.length) {
                        if (/[A-Za-z0-9_]/.test(source[j])) {
                            j += 1;
                            continue;
                        }
                        if (/\s/.test(source[j])) {
                            let k = j;
                            while (k < source.length && /\s/.test(source[k])) k += 1;
                            if (k < source.length && /[A-Za-z0-9_]/.test(source[k])) {
                                j = k + 1;
                                while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j += 1;
                                continue;
                            }
                        }
                        break;
                    }
                    tokens.push({ type: 'identifier', value: source.slice(i, j).trim() });
                    i = j;
                    continue;
                }
                return null;
            }

            return tokens;
        },

        _parseFormulaExpression(expression) {
            const tokens = this._tokenizeFormulaExpression(expression);
            if (!tokens) return null;

            let index = 0;
            const peek = () => tokens[index] ?? null;
            const consume = expected => {
                const token = peek();
                if (!token || (expected && token.type !== expected)) return null;
                index += 1;
                return token;
            };

            const parsePrimary = () => {
                const token = peek();
                if (!token) return null;

                if (token.type === 'number') {
                    consume();
                    return { type: 'literal', value: token.value };
                }
                if (token.type === 'identifier') {
                    consume();
                    if (peek()?.type === '(') {
                        consume('(');
                        const args = [];
                        if (peek()?.type !== ')') {
                            while (true) {
                                const arg = parseAdditive();
                                if (!arg) return null;
                                args.push(arg);
                                if (peek()?.type === ',') {
                                    consume(',');
                                    continue;
                                }
                                break;
                            }
                        }
                        if (!consume(')')) return null;
                        return { type: 'call', name: token.value, args };
                    }
                    return { type: 'identifier', value: token.value };
                }
                if (token.type === '(') {
                    consume('(');
                    const expr = parseAdditive();
                    if (!expr || !consume(')')) return null;
                    return { type: 'group', expr };
                }
                if (token.type === '[') {
                    consume('[');
                    const values = [];
                    if (peek()?.type !== ']') {
                        while (true) {
                            const item = parseAdditive();
                            if (!item) return null;
                            values.push(item);
                            if (peek()?.type === ',') {
                                consume(',');
                                continue;
                            }
                            break;
                        }
                    }
                    if (!consume(']')) return null;
                    return { type: 'list', values };
                }
                if (token.type === '+' || token.type === '-') {
                    consume();
                    const operand = parsePrimary();
                    if (!operand) return null;
                    return { type: 'unary', op: token.type, operand };
                }

                return null;
            };

            const parsePower = () => {
                let left = parsePrimary();
                if (!left) return null;
                while (peek()?.type === '^') {
                    consume('^');
                    const right = parsePower();
                    if (!right) return null;
                    left = { type: 'binary', op: '^', left, right };
                }
                return left;
            };

            const parseMultiplicative = () => {
                let left = parsePower();
                if (!left) return null;
                while (peek() && (peek().type === '*' || peek().type === '/')) {
                    const op = consume().type;
                    const right = parsePower();
                    if (!right) return null;
                    left = { type: 'binary', op, left, right };
                }
                return left;
            };

            const parseAdditive = () => {
                let left = parseMultiplicative();
                if (!left) return null;
                while (peek() && (peek().type === '+' || peek().type === '-')) {
                    const op = consume().type;
                    const right = parseMultiplicative();
                    if (!right) return null;
                    left = { type: 'binary', op, left, right };
                }
                return left;
            };

            const root = parseAdditive();
            if (!root || index !== tokens.length) return null;
            return root;
        },

        _formulaNodePrecedence(node) {
            if (!node) return 0;
            if (node.type === 'binary') {
                if (node.op === '+' || node.op === '-') return 1;
                if (node.op === '*' || node.op === '/') return 2;
                if (node.op === '^') return 3;
            }
            if (node.type === 'unary') return 4;
            return 5;
        },

        _renderFormulaNodeHtml(node, parentPrecedence = 0, position = null) {
            if (!node) return '';

            const wrapGrouped = html => `<span class="price-breakdown-formula-group-wrap"><span class="price-breakdown-formula-group">(</span>${html}<span class="price-breakdown-formula-group">)</span></span>`;
            const wrapIfNeeded = (html, needsParens) => needsParens
                ? wrapGrouped(html)
                : html;

            if (node.type === 'literal') {
                return `<span class="price-breakdown-formula-atom">${this._escapeHtml(node.value)}</span>`;
            }

            if (node.type === 'identifier') {
                return `<span class="price-breakdown-formula-symbol">${this._escapeHtml(node.value)}</span>`;
            }

            if (node.type === 'group') {
                const inner = this._renderFormulaNodeHtml(node.expr, 0);
                return wrapGrouped(inner);
            }

            if (node.type === 'list') {
                const items = node.values.map(item => this._renderFormulaNodeHtml(item, 0)).join('<span class="price-breakdown-formula-punct">, </span>');
                return `<span class="price-breakdown-formula-group">[</span>${items}<span class="price-breakdown-formula-group">]</span>`;
            }

            if (node.type === 'call') {
                const args = node.args.map(arg => this._renderFormulaNodeHtml(arg, 0)).join('<span class="price-breakdown-formula-punct">, </span>');
                if (node.args.length === 1 && (node.name === 'floor' || node.name === 'ceil')) {
                    const leftBracket = node.name === 'floor' ? '&lfloor;' : '&lceil;';
                    const rightBracket = node.name === 'floor' ? '&rfloor;' : '&rceil;';
                    return `<span class="price-breakdown-formula-bracketed"><span class="price-breakdown-formula-bracket">${leftBracket}</span>${args}<span class="price-breakdown-formula-bracket">${rightBracket}</span></span>`;
                }
                return `<span class="price-breakdown-formula-call"><span class="price-breakdown-formula-fn">${this._escapeHtml(node.name)}</span><span class="price-breakdown-formula-group">(</span>${args}<span class="price-breakdown-formula-group">)</span></span>`;
            }

            if (node.type === 'unary') {
                const operand = this._renderFormulaNodeHtml(node.operand, this._formulaNodePrecedence(node), 'right');
                const html = `<span class="price-breakdown-formula-op">${this._escapeHtml(node.op)}</span>${operand}`;
                return wrapIfNeeded(html, this._formulaNodePrecedence(node) < parentPrecedence);
            }

            if (node.type === 'binary') {
                const precedence = this._formulaNodePrecedence(node);

                if (node.op === '/') {
                    const leftNeedsParens = this._formulaNodePrecedence(node.left) < precedence;
                    const rightNeedsParens = this._formulaNodePrecedence(node.right) < precedence
                        || this._formulaNodePrecedence(node.right) === precedence;
                    const numerator = wrapIfNeeded(this._renderFormulaNodeHtml(node.left, precedence, 'left'), leftNeedsParens);
                    const denominator = wrapIfNeeded(this._renderFormulaNodeHtml(node.right, precedence, 'right'), rightNeedsParens);
                    const html = `${numerator}<span class="price-breakdown-formula-op">/</span>${denominator}`;
                    return wrapIfNeeded(html, precedence < parentPrecedence);
                }

                if (node.op === '^') {
                    const baseNeedsParens = ['binary', 'unary'].includes(node.left?.type) && node.left?.type !== 'group';
                    const exponent = this._renderFormulaNodeHtml(node.right, 0);
                    const base = this._renderFormulaNodeHtml(node.left, precedence, 'left');
                    const html = `${wrapIfNeeded(base, baseNeedsParens)}<sup class="price-breakdown-formula-sup">${exponent}</sup>`;
                    return wrapIfNeeded(html, precedence < parentPrecedence);
                }

                const leftNeedsParens = this._formulaNodePrecedence(node.left) < precedence;
                const rightNeedsParens = this._formulaNodePrecedence(node.right) < precedence
                    || ((node.op === '-' || node.op === '*') && this._formulaNodePrecedence(node.right) === precedence)
                    || (node.op === '+' && node.right?.op === '-');
                const left = wrapIfNeeded(this._renderFormulaNodeHtml(node.left, precedence, 'left'), leftNeedsParens);
                const right = wrapIfNeeded(this._renderFormulaNodeHtml(node.right, precedence, 'right'), rightNeedsParens);
                const op = node.op === '*' ? '&times;' : this._escapeHtml(node.op);
                const html = `${left}<span class="price-breakdown-formula-op">${op}</span>${right}`;
                return wrapIfNeeded(html, precedence < parentPrecedence);
            }

            return '';
        },

        _formatFormulaExpressionHtml(expression) {
            const parsed = this._parseFormulaExpression(expression);
            if (!parsed) {
                return this._escapeHtml(expression)
                    .replace(/\*/g, '&times;')
                    .replace(/\//g, '&divide;');
            }
            return `<span class="price-breakdown-formula-math">${this._renderFormulaNodeHtml(parsed)}</span>`;
        },

        _formatScaledContextHtml(meta, options = {}) {
            const { scaleFormulaType = null, decimals = null } = options;
            const paramLabel = this._escapeHtml(meta.param.label ?? this.scalesLabel(meta.param.id));
            const operand = this._escapeHtml(this._formatScaleNumber(meta.operand, decimals));

            if (scaleFormulaType === 'param_over_base_minus_value') {
                return `<span class="item-formula-context">1 per </span><span class="item-formula-value">${operand}</span><span class="item-formula-context"> ${paramLabel}</span>`;
            }

            return `<span class="item-formula-context">${paramLabel} x </span><span class="item-formula-value">${operand}</span>`;
        },

        _formatScaledBonus(bonusEntry, options = {}) {
            const {
                includeTotal = true,
                paramMode = 'value',
                bonusId = bonusEntry.bonus,
            } = options;
            const meta = this._scaleMeta(bonusEntry.value, bonusEntry.scales_with, bonusEntry.scale_formula);
            if (!meta) {
                const ut = bonusEntry.unit_type || 'flat';
                return formatVal(this._resolveValue(bonusEntry), this.unitFor(bonusId, ut), ut);
            }

            const expr = this._formatScaledContext(meta, {
                paramMode,
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            });
            if (!includeTotal) return expr;

            const ut = bonusEntry.unit_type || 'flat';
            const total = formatVal(meta.total, this.unitFor(bonusId, ut), ut);
            return `${total} (${expr})`;
        },

        _formatScaledBonusHtml(bonusEntry, options = {}) {
            const { bonusId = bonusEntry.bonus } = options;
            const meta = this._scaleMeta(bonusEntry.value, bonusEntry.scales_with, bonusEntry.scale_formula);
            if (!meta) {
                const ut = bonusEntry.unit_type || 'flat';
                return formatVal(this._resolveValue(bonusEntry), this.unitFor(bonusId, ut), ut);
            }

            const ut = bonusEntry.unit_type || 'flat';
            const total = formatVal(meta.total, this.unitFor(bonusId, ut), ut);
            const context = this._formatScaledContext(meta, {
                paramMode: 'value',
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            });
            return `<span class="src-val-main">${total}</span><span class="src-val-meta">${context}</span>`;
        },

        _scaledBonusFormulaValues(src, bonusEntry) {
            const formula = this._resolveFormula(src, bonusEntry);
            if (!formula || formula.type !== 'linear') {
                const value = Number(bonusEntry.value ?? 0);
                return [value, value];
            }

            const startTier = bonusEntry.unlock_at_tier ?? 1;
            const first = this._applyFormula({ ...formula, max_tier: startTier }, startTier);
            const last = this._applyFormula(formula, startTier);
            return [first, last];
        },

        _formatScaledBonusRange(src, bonusEntry) {
            const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
            const firstExpr = this._formatScaledBonus({ ...bonusEntry, value: firstVal }, { includeTotal: false, paramMode: 'label' });
            const lastExpr = this._formatScaledBonus({ ...bonusEntry, value: lastVal }, { includeTotal: false, paramMode: 'label' });
            return firstExpr === lastExpr ? firstExpr : `${firstExpr} → ${lastExpr}`;
        },

        _formatScaledBonusRangeRow(src, bonusEntry) {
            const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
            const firstMeta = this._scaleMeta(firstVal, bonusEntry.scales_with, bonusEntry.scale_formula);
            if (!firstMeta) {
                const text = this._formatScaledBonusRange(src, bonusEntry);
                return text ? { text } : null;
            }

            const firstText = this._formatScaledBonus({ ...bonusEntry, value: firstVal }, { includeTotal: false, paramMode: 'label' });
            const firstHtml = this._formatScaledContextHtml(firstMeta, {
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            });

            if (firstVal === lastVal) {
                return { text: firstText, html: firstHtml };
            }

            const lastMeta = this._scaleMeta(lastVal, bonusEntry.scales_with, bonusEntry.scale_formula);
            if (!lastMeta) return { text: firstText, html: firstHtml };

            const lastText = this._formatScaledBonus({ ...bonusEntry, value: lastVal }, { includeTotal: false, paramMode: 'label' });
            const lastHtml = this._formatScaledContextHtml(lastMeta, {
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            });

            return {
                text: `${firstText} → ${lastText}`,
                html: `${firstHtml}<span class="item-formula-context"> &#x2192; </span>${lastHtml}`
            };
        },

        _formatItemFormulaValueRange(src, bonusEntry) {
            const formula = this._resolveFormula(src, bonusEntry);
            const ut = bonusEntry.unit_type || 'flat';

            if (formula?.type === 'linear') {
                const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
                return this.formatBonusValueRange(bonusEntry.bonus, ut, firstVal, lastVal);
            }

            if (bonusEntry.value == null) return null;

            const value = this._resolveValue({ ...bonusEntry, scales_with: null, scale_formula: null });
            const unit = this.unitFor(bonusEntry.bonus, ut);
            return formatVal(value, unit, ut);
        },

        _formatItemFormula(src, bonusEntry) {
            if (bonusEntry.format === 'plain') return bonusEntry.value ?? '-';
            if (bonusEntry.scales_with) return this._formatScaledBonusRange(src, bonusEntry);

            const ut = bonusEntry.unit_type || 'flat';
            const unit = this.unitFor(bonusEntry.bonus, ut);
            const formula = this._resolveFormula(src, bonusEntry);

            if (!formula) {
                return formatVal(this._resolveValue(bonusEntry), unit, ut);
            }

            if (formula.type === 'linear') {
                const coeff = formatVal(formula.coeff ?? 0, unit, ut);
                const step = formula.step ?? 1;
                const label = (formula.label_prefix || 'Tier').toLowerCase();
                const startTier = bonusEntry.unlock_at_tier ?? 1;
                const tierRange = startTier === formula.max_tier
                    ? `${label} ${startTier}`
                    : `${label}s ${startTier}-${formula.max_tier}`;

                if (step > 1) return `${coeff} every ${step} ${label}s (${tierRange})`;
                return `${coeff} per ${label} (${tierRange})`;
            }

            return formatVal(this._resolveValue(bonusEntry), unit, ut);
        },

        _formatItemFormulaRows(src, bonusEntry) {
            const rows = [];
            const valueRange = this._formatItemFormulaValueRange(src, bonusEntry);
            if (valueRange) rows.push(valueRange);

            if (bonusEntry.scales_with) {
                const scaledRange = this._formatScaledBonusRange(src, bonusEntry);
                if (scaledRange && scaledRange !== valueRange) rows.push(scaledRange);
                return rows.length ? rows : [this._formatItemFormula(src, bonusEntry)];
            }

            if (rows.length) return rows;

            const fallback = this._formatItemFormula(src, bonusEntry);
            return fallback ? [fallback] : [];
        },

        entryValueHtml(entry, options = {}) {
            const { includeFormulaMeta = false } = options;
            const scaledParts = [];
            const sums = {};
            for (const b of entry.bonuses) {
                if (includeFormulaMeta && b.scales_with) {
                    scaledParts.push(this._formatScaledBonusHtml(b, { bonusId: b.bonus }));
                    continue;
                }
                const key = b.bonus + ':' + (b.unit_type || 'flat');
                sums[key] = (sums[key] || 0) + this._resolveValue(b);
            }
            const summedParts = Object.entries(sums).map(([key, sum]) => {
                const [bonusId, ut] = key.split(':');
                return formatVal(sum, this.unitFor(bonusId, ut), ut);
            });
            return [...scaledParts, ...summedParts].join('');
        },

        hasTiers(entry) {
            return entry.bonuses.some(b => !!this._getTierRows(entry.src, b, this.selectedBonus));
        },

        bonusHasTiers(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            return group.some(b => !!this._getTierRows(src, b, b.bonus));
        },

        openTierPopoverForBonus(src, bonus, event) {
            const entry = { src, bonuses: bonus._groupBonuses ?? [bonus] };
            this.openTierPopover(entry, event, true);
        },

        _tierFormulaMetaDecimals(src, bonusEntry, tierRow) {
            const formula = this._resolveFormula(src, bonusEntry);
            if (!formula || tierRow?._formulaValue == null) return 0;
            if (!bonusEntry.scales_with) return 0;

            const meta = this._scaleMeta(
                tierRow._formulaValue,
                bonusEntry.scales_with,
                bonusEntry.scale_formula
            );
            if (!meta) return 0;

            return this._scaleNumberDecimals(meta.operand);
        },

        _formatTierFormulaMeta(src, bonusEntry, tierRow, decimals = null) {
            const formula = this._resolveFormula(src, bonusEntry);
            if (!formula || tierRow?._formulaValue == null) return null;
            if (!bonusEntry.scales_with) return null;

            const meta = this._scaleMeta(
                tierRow._formulaValue,
                bonusEntry.scales_with,
                bonusEntry.scale_formula
            );
            if (!meta) return null;

            return this._formatScaledContext(meta, {
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
                decimals
            });
        },

        _formatTierFormulaMetaHtml(src, bonusEntry, tierRow, decimals = null) {
            const formula = this._resolveFormula(src, bonusEntry);
            if (!formula || tierRow?._formulaValue == null) return null;
            if (!bonusEntry.scales_with) return null;

            const meta = this._scaleMeta(
                tierRow._formulaValue,
                bonusEntry.scales_with,
                bonusEntry.scale_formula
            );
            if (!meta) return null;

            return this._formatScaledContextHtml(meta, {
                scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
                decimals
            });
        },

        getTierGroups(entry) {
            const allTierRows = entry.bonuses
                .map(b => ({ b, rows: this._getTierRows(entry.src, b, b.bonus) }))
                .filter(x => x.rows);

            const groups = allTierRows.map(({ b, rows }, gi) => {
                const label = allTierRows.length > 1 ? (b.label || 'Node ' + (gi + 1)) : null;
                const total = rows.length;

                const maxVisible = this.data.tier_preview_limit ?? 5;
                const headCount = maxVisible - 2; // keep space for "..." and last item
                const indices =
                    total <= maxVisible
                        ? rows.map((_, i) => i)
                        : [...Array(headCount).keys(), null, total - 1];

                const displayRows = indices.map(idx => {
                    if (idx === null) return { isEllipsis: true };
                    const tier = rows[idx];
                    const ut = b.unit_type || 'flat';
                    const tierVal = tier[b.bonus];
                    return {
                        isEllipsis: false,
                        label: tier.label,
                        _tierRow: tier,
                        _rawVal: tierVal,
                        metaText: null,
                        metaHtml: null,
                        valHtml: null,
                        valText: '-'
                    };
                });

                const decimals = maxDecimalsInRows(displayRows);
                const ut = b.unit_type || 'flat';
                const unit = this.unitFor(b.bonus, ut);
                displayRows.forEach(r => {
                    if (!r.isEllipsis && r._rawVal != null) {
                        r.valText = formatValFixed(r._rawVal, unit, ut, decimals);
                        r.valHtml = this._escapeHtml(r.valText);
                    }
                });
                const formulaDecimals = displayRows.reduce((max, r) => {
                    if (r.isEllipsis || !r._tierRow) return max;
                    return Math.max(max, this._tierFormulaMetaDecimals(entry.src, b, r._tierRow));
                }, 0);
                displayRows.forEach(r => {
                    if (r.isEllipsis || !r._tierRow) return;
                    r.metaText = this._formatTierFormulaMeta(entry.src, b, r._tierRow, formulaDecimals);
                    r.metaHtml = this._formatTierFormulaMetaHtml(entry.src, b, r._tierRow, formulaDecimals);
                });
                if (this.viewMode === 'item') {
                    displayRows.forEach(r => {
                        if (!r.isEllipsis && r.metaText) {
                            r.valText = r.metaText;
                            r.valHtml = r.metaHtml;
                            r.metaText = null;
                            r.metaHtml = null;
                        }
                    });
                }
                const visualRowCount = displayRows.reduce((sum, row) => {
                    if (row.isEllipsis) return sum + 1;
                    return sum + (row.metaText ? 2 : 1);
                }, 0);
                return { label, rows: displayRows, visualRowCount, gridRowCount: Math.ceil(displayRows.length / 2) };
            });

            const useTwoCol = groups.some(group => group.visualRowCount >= this.tierPopoverColThreshold);
            return groups.map(group => ({ ...group, useTwoCol }));
        },

        openPopover(item, event) {
            const entry = this.groupedSources[item.src.type]?.find(e => e.src.id === item.src.id);
            if (!entry) return;
            this.closeItemPopover();
            this.closeTierPopover();
            this.popoverOpenDetails = new Set();
            this.popoverEntry = { entry, type: item.src.type };
            nextTick(() => this._setupPopover('popover', '.popover-header', event.clientX, event.clientY));
        },

        closePopover() {
            this.popoverEntry = null;
        },

        resolveItemPopover(src) {
            const file = src._file_item_popover ?? null;
            const entity = src.item_popover ?? null;
            if (entity !== null) return entity;
            if (file !== null) return file;
            return true;
        },

        resolveBonusPopover(src, bonus) {
            const entity = this.resolveItemPopover(src);
            const bonusLevel = bonus.item_popover ?? null;
            if (bonusLevel !== null) return bonusLevel;
            return entity;
        },

        popoverBonuses(src) {
            const visible = (src.bonuses ?? []).filter(b => this.resolveBonusPopover(src, b) !== false);
            const grouped = [];
            const byKey = new Map();

            for (const b of visible) {
                const isPlain = b.format === 'plain';
                // Group by bonus id (not unit type) so mixed flat/percent shows on one row.
                const key = isPlain
                    ? `${b.bonus}:plain:${grouped.length}`
                    : `${b.bonus}:${b._is_ascension ? 1 : 0}`;

                if (!byKey.has(key)) {
                    const first = { ...b, _groupBonuses: [b] };
                    byKey.set(key, first);
                    grouped.push(first);
                } else {
                    byKey.get(key)._groupBonuses.push(b);
                }
            }

            for (const b of grouped) {
                b._display = this.itemPopoverBonusResult(src, b);
            }

            return grouped;
        },

        openItemPopover(src, event, fromPopover = false) {
            if (this.resolveItemPopover(src) === false) return;
            if (!fromPopover) this.closePopover();
            this.closeTierPopover();
            this.closePriceBreakdownPopover();
            event.stopPropagation();
            const isMobile = window.innerWidth <= 900;
            if (isMobile) {
                this.itemPopoverEntry = src;
                this.itemSheetOpen = true;
                return;
            }
            this.itemPopoverEntry = src;
            this.$nextTick(() => this._setupPopover('item-popover', '.item-popover-header', event.clientX, event.clientY));
        },

        closeItemPopover() {
            this.itemPopoverEntry = null;
            this.itemSheetOpen = false;
        },

        getResourceBreakdownMeta(kind = 'enhancement') {
            const meta = {
                enhancement: {
                    kind: 'enhancement',
                    icon: '/items/images/gold.png',
                    ariaLabel: 'Open enhancement price breakdown popover',
                    emptyText: 'No enhancement prices',
                    supportsTotals: true
                },
                disenchantment: {
                    kind: 'disenchantment',
                    icon: './images/salvage.png',
                    ariaLabel: 'Open disenchantment return breakdown popover',
                    emptyText: 'No disenchantment returns',
                    supportsTotals: false
                }
            };
            return meta[kind] ?? meta.enhancement;
        },

        _resourceBreakdownAliases(kind = 'enhancement') {
            if (kind === 'disenchantment') return ['disenchantment', 'disenchantement'];
            return [kind];
        },

        _resourceBreakdownKey(src, kind = 'enhancement') {
            if (!src || typeof src !== 'object') return null;
            return this._resourceBreakdownAliases(kind).find(key => key in src) ?? null;
        },

        _resourceBreakdownData(src, kind = 'enhancement') {
            const key = this._resourceBreakdownKey(src, kind);
            return key ? src?.[key] ?? null : null;
        },

        hasPriceBreakdown(src, kind = 'enhancement') {
            const breakdown = this._resourceBreakdownData(src, kind);
            if (!Array.isArray(breakdown?.segments) || !breakdown.segments.length) return false;
            const config = this.getResourceBreakdownDisplayConfig(src, kind);
            const meta = this.getResourceBreakdownMeta(kind);
            return !!(
                (config.levels.enabled && config.levels.limit) ||
                (meta.supportsTotals && config.totals.enabled && config.totals.upto_level) ||
                config.formula.enabled
            );
        },

        getResourceBreakdownBadges(src) {
            return ['enhancement', 'disenchantment']
                .filter(kind => this.hasPriceBreakdown(src, kind))
                .map(kind => {
                    const meta = this.getResourceBreakdownMeta(kind);
                    return {
                        kind,
                        icon: meta.icon,
                        ariaLabel: meta.ariaLabel
                    };
                });
        },

        openPriceBreakdownPopover(src, event, kind = 'enhancement') {
            if (!this.hasPriceBreakdown(src, kind)) return;
            event.stopPropagation();
            this.closePopover();
            this.closeTierPopover();
            this.closeItemPopover();
            const isMobile = window.innerWidth <= 900;
            if (isMobile) {
                this.priceBreakdownEntry = { src, kind };
                this.priceBreakdownSheetOpen = true;
                return;
            }
            this.priceBreakdownSheetOpen = false;
            this.priceBreakdownEntry = { src, kind };
            this.$nextTick(() => this._setupPopover('price-breakdown-popover', '.price-breakdown-popover-header', event.clientX, event.clientY));
        },

        closePriceBreakdownPopover() {
            this.priceBreakdownEntry = null;
            this.priceBreakdownSheetOpen = false;
        },

        _enhancementPositiveInt(value) {
            const num = Number(value);
            return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
        },

        _resolveLocalRef(root, ref) {
            if (typeof ref !== 'string') return null;
            const trimmed = ref.trim();
            if (!trimmed) return null;

            let segments = null;
            if (trimmed.startsWith('#/')) {
                segments = trimmed
                    .slice(2)
                    .split('/')
                    .map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
            } else if (trimmed.startsWith('/')) {
                segments = trimmed
                    .slice(1)
                    .split('/')
                    .filter(Boolean);
            } else {
                segments = trimmed
                    .split('.')
                    .map(part => part.trim())
                    .filter(Boolean);
            }

            let current = root;
            for (const segment of segments) {
                if (current == null || typeof current !== 'object' || !(segment in current)) {
                    return null;
                }
                current = current[segment];
            }
            return current;
        },

        _resolveResourceBreakdownRef(file, src, kind = 'enhancement') {
            const key = this._resourceBreakdownKey(src, kind);
            const breakdown = key ? src?.[key] : null;
            if (!isPlainObject(breakdown) || typeof breakdown.$ref !== 'string') return breakdown;

            const target = this._resolveLocalRef(file, breakdown.$ref);
            if (!isPlainObject(target)) {
                console.warn(`Failed to resolve ${kind} ref "${breakdown.$ref}" for source "${src?.id ?? 'unknown'}".`);
                return breakdown;
            }

            const { $ref, ...overrides } = breakdown;
            if (!Object.keys(overrides).length) return deepCloneJson(target);
            return deepMergeObjects(target, overrides);
        },

        _resolveSourceRefs(file) {
            if (Array.isArray(file)) return file;
            if (!Array.isArray(file?.bonuses) || !file.bonuses.length) return file;

            return {
                ...file,
                bonuses: file.bonuses.map(src => ({
                    ...src,
                    enhancement: this._resolveResourceBreakdownRef(file, src, 'enhancement'),
                    disenchantment: this._resolveResourceBreakdownRef(file, src, 'disenchantment')
                }))
            };
        },

        _enhancementAmountType(amountSpec) {
            if (amountSpec == null) return 'fixed';
            if (typeof amountSpec === 'number') return 'fixed';
            if (typeof amountSpec === 'string') {
                const trimmed = amountSpec.trim();
                if (trimmed === '') return null;
                return Number.isFinite(Number(trimmed)) ? 'fixed' : null;
            }
            if (typeof amountSpec !== 'object') return null;
            return amountSpec.type ?? 'fixed';
        },

        _resourceBreakdownUsesSymbolicFormula(amountSpec) {
            const type = this._enhancementAmountType(amountSpec);
            return !!type && !['fixed', 'table'].includes(type);
        },

        _inferEnhancementSegmentMaxLevel(segment) {
            const fromLevel = this._enhancementPositiveInt(segment?.from_level) ?? 1;
            const explicitToLevel = this._enhancementPositiveInt(segment?.to_level);

            if (Array.isArray(segment?.per_level)) {
                const derivedToLevel = fromLevel + Math.max(0, segment.per_level.length - 1);
                if (explicitToLevel != null && explicitToLevel !== derivedToLevel) return null;
                return explicitToLevel ?? derivedToLevel;
            }

            const costs = Array.isArray(segment?.costs) ? segment.costs : [];
            const tableLengths = [];

            for (const cost of costs) {
                const type = this._enhancementAmountType(cost?.amount);
                if (!type) return null;
                if (!['fixed', 'table'].includes(type)) {
                    return explicitToLevel ?? null;
                }
                if (type === 'table') {
                    const values = Array.isArray(cost?.amount?.values) ? cost.amount.values : null;
                    if (!values?.length) return null;
                    tableLengths.push(values.length);
                }
            }

            if (tableLengths.length) {
                const expectedLength = tableLengths[0];
                if (tableLengths.some(length => length !== expectedLength)) return null;
                const derivedToLevel = fromLevel + expectedLength - 1;
                if (explicitToLevel != null && explicitToLevel !== derivedToLevel) return null;
                return explicitToLevel ?? derivedToLevel;
            }

            return explicitToLevel ?? fromLevel;
        },

        _enhancementCyclingItems(segment) {
            const items = Array.isArray(segment?.cycling_items) ? segment.cycling_items : [];
            return items
                .map(item => typeof item === 'string' ? item.trim() : '')
                .filter(Boolean);
        },

        _resolveEnhancementCyclingItem(segment, level, fallbackItem = null) {
            const items = this._enhancementCyclingItems(segment);
            if (!items.length) return fallbackItem;
            const fromLevel = Number(segment?.from_level ?? 1);
            const idx = ((level - fromLevel) % items.length + items.length) % items.length;
            return items[idx] ?? fallbackItem;
        },

        _resourceBreakdownSegments(src, kind = 'enhancement') {
            return this._resourceBreakdownData(src, kind)?.segments ?? [];
        },

        _inferEnhancementMaxLevel(enhancement) {
            const segments = Array.isArray(enhancement?.segments) ? enhancement.segments : [];
            if (!segments.length) return null;

            let maxLevel = null;
            for (const segment of segments) {
                const segmentMaxLevel = this._inferEnhancementSegmentMaxLevel(segment);
                if (segmentMaxLevel == null) return null;
                maxLevel = Math.max(maxLevel ?? segmentMaxLevel, segmentMaxLevel);
            }

            return maxLevel;
        },

        getResourceBreakdownDisplayConfig(src, kind = 'enhancement') {
            const breakdown = this._resourceBreakdownData(src, kind) ?? {};
            const display = breakdown.display ?? {};
            const levelsCfg = display.levels ?? {};
            const totalsCfg = display.totals ?? {};
            const formulaCfg = display.formula ?? {};
            const finiteMaxLevel = this._enhancementPositiveInt(breakdown.max_level)
                ?? this._inferEnhancementMaxLevel(breakdown);
            const supportsTotals = this.getResourceBreakdownMeta(kind).supportsTotals;

            return {
                initial_tab: display.initial_tab ?? null,
                levels: {
                    enabled: levelsCfg.enabled ?? true,
                    limit: this._enhancementPositiveInt(levelsCfg.limit) ?? finiteMaxLevel,
                    every: this._enhancementPositiveInt(levelsCfg.every),
                    tabs: this._enhancementPositiveInt(levelsCfg.tabs),
                    items_per_tab: this._enhancementPositiveInt(levelsCfg.items_per_tab)
                },
                totals: {
                    enabled: supportsTotals && (totalsCfg.enabled ?? (finiteMaxLevel != null)),
                    upto_level: this._enhancementPositiveInt(totalsCfg.upto_level) ?? finiteMaxLevel,
                    group_by: this._enhancementPositiveInt(totalsCfg.group_by)
                },
                formula: {
                    enabled: formulaCfg.enabled ?? true
                },
                finiteMaxLevel
            };
        },

        getEnhancementDisplayConfig(src) {
            return this.getResourceBreakdownDisplayConfig(src, 'enhancement');
        },

        formatResourceBreakdownAmount(value) {
            const normalized = this.normalizeValue(Number(value ?? 0), 2);
            return Number.isInteger(normalized) ? normalized.toLocaleString() : normalized.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        },

        formatEnhancementAmount(value) {
            return this.formatResourceBreakdownAmount(value);
        },

        priceBreakdownColumnCount(rows) {
            if (!rows?.length) return 1;

            const availableHeight = Math.max(320, (window.innerHeight || 900) - 48);
            const totalHeight = this._estimatePriceBreakdownHeight(rows);

            for (let columns = 1; columns <= 2; columns += 1) {
                if (totalHeight / columns <= availableHeight) return columns;
            }

            return 2;
        },

        _estimatePriceBreakdownRowHeight(row) {
            const costCount = row?.costs?.length ?? 0;
            return 22 + Math.max(1, costCount) * 34 + Math.max(0, costCount - 1) * 6 + 8;
        },

        _estimatePriceBreakdownHeight(rows) {
            const rowGap = Math.max(0, (rows.length - 1) * 8);
            return rows.reduce((sum, row) => sum + this._estimatePriceBreakdownRowHeight(row), 0) + rowGap;
        },

        resourceBreakdownResourceLabel(itemId) {
            if (!itemId) return 'Unknown';
            const item = this.data?.items?.get(itemId);
            if (item?.name) return item.name;
            return itemId
                .split('_')
                .filter(Boolean)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        },

        enhancementResourceLabel(itemId) {
            return this.resourceBreakdownResourceLabel(itemId);
        },

        resourceBreakdownResourceImage(itemId) {
            if (!itemId) return null;
            return this.data?.items?.get(itemId)?.icon ?? null;
        },

        enhancementResourceImage(itemId) {
            return this.resourceBreakdownResourceImage(itemId);
        },

        _roundEnhancementAmount(value, roundMode = null) {
            if (!Number.isFinite(value)) return null;
            if (roundMode === 'floor') return Math.floor(value);
            if (roundMode === 'ceil') return Math.ceil(value);
            if (roundMode === 'round') return Math.round(value);
            return value;
        },

        _resourceBreakdownCumulativeEntry(src, kind) {
            if (!src || typeof src !== 'object') return null;
            if (!(this._resourceBreakdownCumulativeCache instanceof WeakMap)) {
                this._resourceBreakdownCumulativeCache = new WeakMap();
            }

            let byKind = this._resourceBreakdownCumulativeCache.get(src);
            if (!byKind) {
                byKind = new Map();
                this._resourceBreakdownCumulativeCache.set(src, byKind);
            }

            if (!byKind.has(kind)) {
                byKind.set(kind, {
                    uptoLevel: 0,
                    prefixByItem: new Map(),
                    building: false
                });
            }

            return byKind.get(kind);
        },

        _ensureResourceBreakdownCumulativeTotals(src, kind, uptoLevel) {
            const resolvedUptoLevel = this._enhancementPositiveInt(uptoLevel);
            if (!resolvedUptoLevel) return null;

            const entry = this._resourceBreakdownCumulativeEntry(src, kind);
            if (!entry) return null;
            if (entry.uptoLevel >= resolvedUptoLevel) return entry;
            if (entry.building) return entry;

            entry.building = true;
            try {
                for (let level = entry.uptoLevel + 1; level <= resolvedUptoLevel; level += 1) {
                    const levelCosts = this._resolveEnhancementLevelCosts(src, level, kind);
                    const touchedItems = new Set();

                    for (const cost of levelCosts) {
                        if (!cost?.item) continue;
                        const amount = Number(cost.amount ?? 0);
                        if (!Number.isFinite(amount)) continue;

                        let prefix = entry.prefixByItem.get(cost.item);
                        if (!prefix) {
                            prefix = [0];
                            entry.prefixByItem.set(cost.item, prefix);
                        }

                        const previous = prefix[level - 1] ?? prefix[prefix.length - 1] ?? 0;
                        prefix[level] = previous + amount;
                        touchedItems.add(cost.item);
                    }

                    for (const [itemId, prefix] of entry.prefixByItem) {
                        if (touchedItems.has(itemId)) continue;
                        const previous = prefix[level - 1] ?? prefix[prefix.length - 1] ?? 0;
                        prefix[level] = previous;
                    }
                }

                entry.uptoLevel = resolvedUptoLevel;
            } finally {
                entry.building = false;
            }

            return entry;
        },

        _resourceBreakdownPrefixValue(prefix, level) {
            if (!Array.isArray(prefix)) return 0;
            const resolvedLevel = this._enhancementPositiveInt(level) ?? 0;
            if (resolvedLevel <= 0) return Number(prefix[0] ?? 0) || 0;
            if (resolvedLevel < prefix.length) {
                const value = prefix[resolvedLevel];
                return Number.isFinite(value) ? value : 0;
            }
            const lastValue = prefix[prefix.length - 1];
            return Number.isFinite(lastValue) ? lastValue : 0;
        },

        _resourceBreakdownTotalAmount(src, kind, itemId, fromLevel, toLevel) {
            if (!src || !itemId) return 0;
            const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
            const resolvedToLevel = this._enhancementPositiveInt(toLevel);
            if (!resolvedToLevel || resolvedToLevel < resolvedFromLevel) return 0;

            const entry = this._ensureResourceBreakdownCumulativeTotals(src, kind, resolvedToLevel);
            const prefix = entry?.prefixByItem?.get(itemId);
            if (!prefix) return 0;

            const totalAtToLevel = this._resourceBreakdownPrefixValue(prefix, resolvedToLevel);
            const totalBeforeFromLevel = resolvedFromLevel > 1
                ? this._resourceBreakdownPrefixValue(prefix, resolvedFromLevel - 1)
                : 0;
            return totalAtToLevel - totalBeforeFromLevel;
        },

        _resolveEnhancementAmount(src, amountSpec, level, segment) {
            if (amountSpec == null) return null;
            if (typeof amountSpec === 'number') return amountSpec;
            if (typeof amountSpec === 'string' && amountSpec.trim() !== '') {
                const parsed = Number(amountSpec);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (typeof amountSpec !== 'object') return null;

            const type = amountSpec.type ?? 'fixed';
            const fromLevel = Number(segment?.from_level ?? 1);
            const levelOffset = Number(amountSpec.level_offset ?? fromLevel);
            const cycleLength = Math.max(1, Number(amountSpec.cycle_length ?? 1));
            const rawDelta = level - levelOffset;
            const delta = cycleLength > 1
                ? Math.floor(rawDelta / cycleLength)
                : rawDelta;

            if (type === 'fixed') {
                return Number(amountSpec.value ?? 0);
            }
            if (type === 'table') {
                const idx = level - fromLevel;
                if (!Array.isArray(amountSpec.values)) return null;
                const value = amountSpec.values[idx];
                if (value == null) return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (type === 'linear') {
                return Number(amountSpec.base ?? 0) + Number(amountSpec.step ?? 0) * delta;
            }
            if (type === 'exponential') {
                const value = Number(amountSpec.base ?? 0) * Math.pow(Number(amountSpec.growth ?? 1), delta);
                return this._roundEnhancementAmount(value, amountSpec.round);
            }
            if (type === 'polynomial') {
                const value = Number(amountSpec.factor ?? 0) * Math.pow(delta, Number(amountSpec.power ?? 1));
                return this._roundEnhancementAmount(value, amountSpec.round);
            }
            if (type === 'resource_breakdown_total') {
                const targetKind = typeof amountSpec.kind === 'string' && amountSpec.kind.trim()
                    ? amountSpec.kind.trim()
                    : 'enhancement';
                const itemId = typeof amountSpec.item === 'string' && amountSpec.item.trim()
                    ? amountSpec.item.trim()
                    : null;
                const tier = Math.max(0, Number(amountSpec.tier ?? 0));
                const tierMultiplier = amountSpec.base_scales_with_tier ? (tier + 1) : 1;
                const total = this._resourceBreakdownTotalAmount(
                    src,
                    targetKind,
                    itemId,
                    amountSpec.from_level,
                    level
                );
                const value = Number(amountSpec.base ?? 0) * tierMultiplier + Number(amountSpec.multiplier ?? 1) * total;
                return this._roundEnhancementAmount(value, amountSpec.round);
            }
            return null;
        },

        _resolveEnhancementLevelCosts(src, level, kind = 'enhancement') {
            const segments = this._resourceBreakdownSegments(src, kind);
            const segment = segments.find(entry => {
                const fromLevel = Number(entry?.from_level ?? 1);
                const toLevel = this._enhancementPositiveInt(entry?.to_level);
                return level >= fromLevel && (toLevel == null || level <= toLevel);
            });
            if (!segment) return [];

            if (Array.isArray(segment.per_level)) {
                const perLevelCosts = segment.per_level[level - segment.from_level] ?? [];
                return perLevelCosts
                    .map(cost => ({
                        item: cost.item,
                        amount: typeof cost.amount === 'object'
                            ? this._resolveEnhancementAmount(src, cost.amount, level, segment)
                            : Number(cost.amount ?? 0)
                    }))
                    .filter(cost => cost.item && cost.amount != null && Number.isFinite(cost.amount));
            }

            return (segment.costs ?? [])
                .map(cost => ({
                    item: this._resolveEnhancementCyclingItem(segment, level, cost.item),
                    amount: this._resolveEnhancementAmount(src, cost.amount, level, segment)
                }))
                .filter(cost => cost.item && cost.amount != null && Number.isFinite(cost.amount));
        },

        _resourceBreakdownCostRow(item, amount) {
            return {
                item,
                amount,
                label: this.resourceBreakdownResourceLabel(item),
                image: this.resourceBreakdownResourceImage(item)
            };
        },

        _enhancementCostRow(item, amount) {
            return this._resourceBreakdownCostRow(item, amount);
        },

        _enhancementLevelRangeLabel(fromLevel, toLevel) {
            const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
            if (toLevel == null) {
                return `Lvl ${resolvedFromLevel}+`;
            }
            return resolvedFromLevel === toLevel
                ? `Lvl ${resolvedFromLevel}`
                : `Lvl ${resolvedFromLevel}-${toLevel}`;
        },

        _enhancementSegmentFromLevel(segment) {
            return this._enhancementPositiveInt(segment?.from_level) ?? 1;
        },

        _enhancementSegmentToLevel(segment, fallbackToLevel = null) {
            return this._enhancementPositiveInt(segment?.to_level) ?? this._enhancementPositiveInt(fallbackToLevel);
        },

        _formatEnhancementCostList(costs) {
            return costs
                .map(cost => `${cost.label} ${this.formatResourceBreakdownAmount(cost.amount)}`)
                .join(' + ');
        },

        _formatEnhancementFormulaExpression(amountSpec, segment) {
            if (amountSpec == null) return null;
            if (typeof amountSpec === 'number') return this.formatResourceBreakdownAmount(amountSpec);
            if (typeof amountSpec === 'string' && amountSpec.trim() !== '') return amountSpec.trim();
            if (typeof amountSpec !== 'object') return null;

            const type = amountSpec.type ?? 'fixed';
            const fromLevel = Number(segment?.from_level ?? 1);
            const offset = Number(amountSpec.level_offset ?? fromLevel);

            if (type === 'fixed') return this.formatResourceBreakdownAmount(amountSpec.value ?? 0);
            if (type === 'table') {
                const values = Array.isArray(amountSpec.values) ? amountSpec.values : [];
                const compact = values.length > 8
                    ? [...values.slice(0, 4), '...', ...values.slice(-2)]
                    : values;
                return `[${compact.join(', ')}]`;
            }
            const cycleLength = Math.max(1, Number(amountSpec.cycle_length ?? 1));
            const cycleTerm = cycleLength > 1
                ? `floor((lvl - ${offset}) / ${cycleLength})`
                : `(lvl - ${offset})`;

            if (type === 'linear') {
                return `${this.formatResourceBreakdownAmount(amountSpec.base ?? 0)} + ${this.formatResourceBreakdownAmount(amountSpec.step ?? 0)} * ${cycleTerm}`;
            }
            if (type === 'exponential') {
                const expr = `${this.formatResourceBreakdownAmount(amountSpec.base ?? 0)} * ${amountSpec.growth ?? 1}^${cycleTerm}`;
                if (amountSpec.round === 'floor') return `floor(${expr})`;
                if (amountSpec.round === 'ceil') return `ceil(${expr})`;
                if (amountSpec.round === 'round') return `round(${expr})`;
                return expr;
            }
            if (type === 'polynomial') {
                const expr = `${this.formatResourceBreakdownAmount(amountSpec.factor ?? 0)} * ${cycleTerm}^${amountSpec.power ?? 1}`;
                if (amountSpec.round === 'floor') return `floor(${expr})`;
                if (amountSpec.round === 'ceil') return `ceil(${expr})`;
                if (amountSpec.round === 'round') return `round(${expr})`;
                return expr;
            }
            if (type === 'resource_breakdown_total') {
                const itemId = typeof amountSpec.item === 'string' && amountSpec.item.trim()
                    ? amountSpec.item.trim()
                    : null;
                const itemLabel = itemId ? this.resourceBreakdownResourceLabel(itemId) : 'resource';
                const base = Number(amountSpec.base ?? 0);
                const multiplier = Number(amountSpec.multiplier ?? 1);
                const baseExpr = amountSpec.base_scales_with_tier
                    ? `${this.formatResourceBreakdownAmount(base)} * (Tier + 1)`
                    : this.formatResourceBreakdownAmount(base);
                const totalExpr = `(Total invested ${itemLabel}s)`;
                const parts = [];
                if (base) parts.push(baseExpr);
                if (multiplier === 1) {
                    parts.push(totalExpr);
                } else if (multiplier) {
                    parts.push(`${this.formatResourceBreakdownAmount(multiplier)} * ${totalExpr}`);
                }
                if (!parts.length) return '0';
                return parts.join(' + ');
            }
            return null;
        },

        _summarizeExpandedResourceBreakdownSegment(src, kind, segment, toLevelOverride = null) {
            const fromLevel = this._enhancementSegmentFromLevel(segment);
            const toLevel = this._enhancementSegmentToLevel(segment, toLevelOverride);
            if (!toLevel || toLevel < fromLevel) return [];
            const rows = [];
            for (let level = fromLevel; level <= toLevel; level += 1) {
                const costs = this._resolveEnhancementLevelCosts(src, level, kind).map(cost =>
                    this._resourceBreakdownCostRow(cost.item, Number(cost.amount ?? 0))
                );
                rows.push({
                    level,
                    costs,
                    key: costs.map(cost => `${cost.item}:${cost.amount}`).join('|')
                });
            }

            const grouped = [];
            for (const row of rows) {
                const prev = grouped[grouped.length - 1];
                if (prev && prev.key === row.key && prev.toLevel === row.level - 1) {
                    prev.toLevel = row.level;
                } else {
                    grouped.push({ fromLevel: row.level, toLevel: row.level, key: row.key, costs: row.costs });
                }
            }

            return grouped.map(group => ({
                kind: 'static',
                label: this._enhancementLevelRangeLabel(group.fromLevel, group.toLevel),
                costs: group.costs
            }));
        },

        _summarizeExpandedEnhancementSegment(src, segment, toLevelOverride = null) {
            return this._summarizeExpandedResourceBreakdownSegment(src, 'enhancement', segment, toLevelOverride);
        },

        _summarizeFormulaResourceBreakdownSegment(kind, segment) {
            const fromLevel = this._enhancementSegmentFromLevel(segment);
            const cyclingItems = this._enhancementCyclingItems(segment);
            const baseCosts = segment.costs ?? [];
            const costs = cyclingItems.length
                ? cyclingItems.flatMap(item => baseCosts.map(cost => {
                    const expression = this._formatEnhancementFormulaExpression(cost.amount, segment);
                    return {
                        item,
                        label: this.resourceBreakdownResourceLabel(item),
                        image: this.resourceBreakdownResourceImage(item),
                        expression,
                        expressionHtml: this._formatFormulaExpressionHtml(expression)
                    };
                }))
                : baseCosts.map(cost => {
                    const expression = this._formatEnhancementFormulaExpression(cost.amount, segment);
                    return {
                        item: cost.item,
                        label: this.resourceBreakdownResourceLabel(cost.item),
                        image: this.resourceBreakdownResourceImage(cost.item),
                        expression,
                        expressionHtml: this._formatFormulaExpressionHtml(expression)
                    };
                });
            return [{
                kind: 'formula',
                label: this._enhancementLevelRangeLabel(fromLevel, this._enhancementSegmentToLevel(segment)),
                costs
            }];
        },

        _summarizeFormulaEnhancementSegment(segment) {
            return this._summarizeFormulaResourceBreakdownSegment('enhancement', segment);
        },

        getResourceBreakdownFormulaView(src, kind = 'enhancement') {
            const config = this.getResourceBreakdownDisplayConfig(src, kind);
            if (!config.formula.enabled) return { summary: null, sections: [] };

            const segments = this._resourceBreakdownSegments(src, kind);
            const hasAnyDynamicFormula = segments.some(segment =>
                (segment.costs ?? []).some(cost => this._resourceBreakdownUsesSymbolicFormula(cost.amount))
            );
            if (!hasAnyDynamicFormula) return { summary: null, sections: [] };

            const sections = [];
            for (const segment of segments) {
                const segmentFromLevel = this._enhancementSegmentFromLevel(segment);
                const segmentToLevel = this._enhancementSegmentToLevel(segment, config.levels.limit ?? config.totals.upto_level);
                const hasPerLevel = Array.isArray(segment.per_level);
                const hasTable = (segment.costs ?? []).some(cost => typeof cost.amount === 'object' && (cost.amount.type ?? 'fixed') === 'table');
                const hasDynamicFormula = (segment.costs ?? []).some(cost => this._resourceBreakdownUsesSymbolicFormula(cost.amount));
                const canExpandLevels = segmentToLevel != null && segmentToLevel >= segmentFromLevel;
                const expandedSpan = canExpandLevels ? (segmentToLevel - segmentFromLevel + 1) : null;

                if (hasDynamicFormula) {
                    sections.push(...this._summarizeFormulaResourceBreakdownSegment(kind, segment));
                    continue;
                }

                if ((hasPerLevel || (hasTable && expandedSpan != null && expandedSpan <= 24)) && canExpandLevels) {
                    sections.push(...this._summarizeExpandedResourceBreakdownSegment(src, kind, segment, this._enhancementPositiveInt(segment?.to_level) == null ? segmentToLevel : null));
                } else {
                    sections.push(...this._summarizeFormulaResourceBreakdownSegment(kind, segment));
                }
            }

            return {
                summary: sections.length ? 'Formula-driven segments are shown symbolically.' : null,
                sections
            };
        },

        getEnhancementFormulaView(src) {
            return this.getResourceBreakdownFormulaView(src, 'enhancement');
        },

        _buildResourceBreakdownTotalsForRange(src, kind, fromLevel, toLevel) {
            const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
            const resolvedToLevel = this._enhancementPositiveInt(toLevel);
            if (!resolvedToLevel || resolvedToLevel < resolvedFromLevel) return [];

            const entry = this._ensureResourceBreakdownCumulativeTotals(src, kind, resolvedToLevel);
            if (!entry) return [];

            const totals = [];
            for (const [itemId, prefix] of entry.prefixByItem) {
                const totalAtToLevel = this._resourceBreakdownPrefixValue(prefix, resolvedToLevel);
                const totalBeforeFromLevel = resolvedFromLevel > 1
                    ? this._resourceBreakdownPrefixValue(prefix, resolvedFromLevel - 1)
                    : 0;
                const amount = totalAtToLevel - totalBeforeFromLevel;
                if (!amount) continue;
                totals.push({
                    item: itemId,
                    amount,
                    label: this.resourceBreakdownResourceLabel(itemId),
                    image: this.resourceBreakdownResourceImage(itemId)
                });
            }
            return totals;
        },

        _buildEnhancementTotalsForRange(src, fromLevel, toLevel) {
            return this._buildResourceBreakdownTotalsForRange(src, 'enhancement', fromLevel, toLevel);
        },

        getResourceBreakdownTotalsView(src, kind = 'enhancement') {
            const meta = this.getResourceBreakdownMeta(kind);
            const config = this.getResourceBreakdownDisplayConfig(src, kind);
            const uptoLevel = config.totals.upto_level;
            if (!meta.supportsTotals || !config.totals.enabled || !uptoLevel) return { summary: null, groups: [] };

            const groupBy = config.totals.group_by;
            const groups = [];

            if (groupBy && groupBy < uptoLevel) {
                for (let toLevel = groupBy; toLevel <= uptoLevel; toLevel += groupBy) {
                    groups.push({
                        label: this._enhancementLevelRangeLabel(1, toLevel),
                        costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, toLevel)
                    });
                }
                if (groups[groups.length - 1]?.label !== this._enhancementLevelRangeLabel(1, uptoLevel)) {
                    groups.push({
                        label: this._enhancementLevelRangeLabel(1, uptoLevel),
                        costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel)
                    });
                }
            } else {
                groups.push({
                    label: this._enhancementLevelRangeLabel(1, uptoLevel),
                    costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel)
                });
            }

            const summary = config.finiteMaxLevel == null
                ? `Totals are limited to the first ${uptoLevel.toLocaleString()} levels${groupBy ? `, grouped by ${groupBy.toLocaleString()}` : ''}.`
                : (groupBy ? `Totals grouped by ${groupBy.toLocaleString()} levels.` : null);

            return { summary, groups };
        },

        getEnhancementTotalsView(src) {
            return this.getResourceBreakdownTotalsView(src, 'enhancement');
        },

        getResourceBreakdown(src, kind = 'enhancement', fromLevel = 1, toLevel = null) {
            if (!this.hasPriceBreakdown(src, kind)) return { rows: [], totals: [] };
            const config = this.getResourceBreakdownDisplayConfig(src, kind);
            const resolvedToLevel = this._enhancementPositiveInt(toLevel) ?? config.levels.limit ?? config.totals.upto_level;
            if (!resolvedToLevel || resolvedToLevel < fromLevel) return { rows: [], totals: [] };

            const rows = [];
            const totals = new Map();

            for (let level = fromLevel; level <= resolvedToLevel; level += 1) {
                const costs = this._resolveEnhancementLevelCosts(src, level, kind).map(cost => {
                    const amount = Number(cost.amount ?? 0);
                    const enriched = this._resourceBreakdownCostRow(cost.item, amount);
                    totals.set(cost.item, {
                        item: cost.item,
                        amount: (totals.get(cost.item)?.amount ?? 0) + amount,
                        label: enriched.label,
                        image: enriched.image
                    });
                    return enriched;
                });
                rows.push({ level, costs });
            }

            return {
                rows: rows.filter(row => row.costs.length),
                totals: [...totals.values()]
            };
        },

        getEnhancementPriceBreakdown(src, fromLevel = 1, toLevel = null) {
            return this.getResourceBreakdown(src, 'enhancement', fromLevel, toLevel);
        },

        getResourceBreakdownLevelsView(src, kind = 'enhancement') {
            const config = this.getResourceBreakdownDisplayConfig(src, kind);
            const levelLimit = config.levels.limit;
            if (!config.levels.enabled || !levelLimit) return { summary: null, rows: [] };

            const breakdown = this.getResourceBreakdown(src, kind, 1, levelLimit);
            const every = config.levels.every;
            const rows = every
                ? breakdown.rows.filter(row => row.level === 1 || row.level % every === 0)
                : breakdown.rows;
            let summary = null;
            if (config.finiteMaxLevel != null && levelLimit < config.finiteMaxLevel) {
                summary = `Showing levels 1-${levelLimit.toLocaleString()} of ${config.finiteMaxLevel.toLocaleString()}.`;
            } else if (config.finiteMaxLevel == null) {
                summary = `Showing the first ${levelLimit.toLocaleString()} levels.`;
            }
            if (every) {
                const cadenceText = `showing level 1 and levels divisible by ${every.toLocaleString()}`;
                summary = summary
                    ? `${summary} Levels view is filtered, ${cadenceText}.`
                    : `Levels view is filtered, ${cadenceText}.`;
            }

            const requestedTabs = config.levels.tabs;
            const requestedItemsPerTab = config.levels.items_per_tab;
            let tabs = [];
            if (levelLimit > 1) {
                let tabCount = null;
                let levelsPerTab = null;
                if (requestedItemsPerTab && config.finiteMaxLevel != null) {
                    levelsPerTab = Math.min(requestedItemsPerTab, levelLimit);
                    tabCount = Math.ceil(levelLimit / levelsPerTab);
                } else if (requestedTabs) {
                    tabCount = Math.min(requestedTabs, levelLimit);
                    levelsPerTab = Math.ceil(levelLimit / tabCount);
                }
                if (tabCount && levelsPerTab) {
                    for (let idx = 0; idx < tabCount; idx += 1) {
                        const fromLevel = idx * levelsPerTab + 1;
                        const toLevel = Math.min(levelLimit, fromLevel + levelsPerTab - 1);
                        tabs.push({
                            id: `levels:${idx + 1}`,
                            label: this._enhancementLevelRangeLabel(fromLevel, toLevel),
                            fromLevel,
                            toLevel,
                            rows: rows.filter(row => row.level >= fromLevel && row.level <= toLevel)
                        });
                    }
                }
            }

            return { summary, rows, tabs };
        },

        getEnhancementLevelsView(src) {
            return this.getResourceBreakdownLevelsView(src, 'enhancement');
        },

        shouldHideResourceBreakdownSectionLabel(entries, label) {
            return entries?.length === 1 && label === this._enhancementLevelRangeLabel(1, 1);
        },

        isSingleLevelOneBreakdown(rows) {
            return rows?.length === 1 && Number(rows[0]?.level) === 1;
        },

        _itemPopoverBonusResultLegacy(src, bonus) {
            const group = bonus._groupBonuses ?? [bonus];
            const icon = group.find(entry => entry.icon)?.icon ?? null;
            if (group.length === 1 && group[0].format === 'plain') {
                return { text: group[0].value, flat: null, percent: null, multiplier: null, icon };
            }

            const items = [];
            for (const gb of group) {
                if (gb.format === 'plain') continue;
                items.push({
                    value: this._resolveValue(gb),
                    unit_type: gb.unit_type || 'flat',
                    mult: 1
                });
            }
            if (!items.length) return { text: '—', flat: null, percent: null, multiplier: null, icon };

            const result = this._compoundTotal(items);
            const bonusId = bonus.bonus || this.selectedBonus;
            if (!result.isMixed) {
                const ut = result.unit_type || 'flat';
                const unit = this.unitFor(bonusId, ut);
                return { text: formatVal(this.normalizeValue(result.value), unit, ut), flat: null, percent: null, multiplier: null, icon };
            }

            return {
                flat: result.flat ? this.normalizeValue(result.flat) : null,
                percent: result.percent ? this.normalizeValue(result.percent) : null,
                multiplier: result.multiplier !== 1 ? this.normalizeValue(result.multiplier) : null,
                icon
            };
        },

        itemPopoverBonusResult(src, bonus) {
            return this.itemBonusDisplay(src, bonus);
        },

        togglePopoverDetail(srcId) {
            const s = new Set(this.popoverOpenDetails);
            s.has(srcId) ? s.delete(srcId) : s.add(srcId);
            this.popoverOpenDetails = s;
        },

        openTierPopover(entry, event, fromPopover = false) {
            const isMobile = window.innerWidth <= 900;
            if (isMobile) {
                this.tierSheetEntry = entry;
            } else {
                if (!fromPopover) {
                    this.itemPopoverEntry = null;
                    this.popoverEntry = null;
                }
                this.tierPopoverEntry = entry;
                this.$nextTick(() => {
                    const el = document.getElementById('tier-popover');
                    if (!el) return;
                    el._draggable = false;
                    el.style.zIndex = this.nextZ();
                    positionPopover(el, event.clientX, event.clientY);
                    if (!el._draggable) {
                        makeDraggable(el, el.querySelector('.item-popover-header'), () => {
                            el.style.zIndex = this.nextZ();
                        });
                        el._draggable = true;
                    }
                });
            }
        },

        closeTierPopover() {
            this.tierPopoverEntry = null;
            this.tierSheetEntry = null;
        },

        openMobileSource(item) {
            this.setMobileTab('sources');

            if (this.collapsedSections.has(item.src.type)) {
                const s = new Set(this.collapsedSections);
                s.delete(item.src.type);
                this.collapsedSections = s;
            }

            nextTick(() => {
                setTimeout(() => {
                    const panel = document.querySelector('.mobile-scroll-container .content-center.mobile-panel');
                    const el = panel?.querySelector(`.source-row-wrap[data-id="${item.src.id}"]`);
                    if (!el || !panel) return;
                    panel.scrollTop = el.offsetTop - panel.clientHeight / 3;
                    el.classList.add('highlight');
                    setTimeout(() => el.classList.remove('highlight'), 1500);
                }, 100);
            });
        },

        onMaxItemClick(item, event) {
            const scroller = this.$refs.mobileScroll;
            if (scroller && getComputedStyle(scroller).display !== 'none') {
                this.openMobileSource(item);
            } else {
                this.openPopover(item, event);
            }
        },

        nextZ() {
            return ++this._zCounter;
        },

        /* -- PRIVATE -- */
        _resolveValue(b) {
            return this._calculateValue(b.value, b.scales_with, b.scale_formula);
        },

        _calculateValue(val, scales_with, scaleFormula = null) {
            const baseVal = Number(val ?? 0);
            const p = this.parameters?.find(p => p.id === scales_with);
            if (!p) return baseVal;

            if (scaleFormula?.type === 'param_over_base_minus_value') {
                const denominator = Number(scaleFormula.base ?? 0) - baseVal;
                if (!Number.isFinite(denominator) || denominator === 0) return 0;
                return p.value / denominator;
            }

            return p.value * baseVal;
        },

        _resolveFormula(src, bonusEntry) {
            if (src.tiers_formula === false || bonusEntry?.tiers_formula === false) return null;
            if (bonusEntry?.value !== undefined && !bonusEntry?.tiers_formula) return null;
            const global = this.data.tiers_formula;
            const file   = src._file_tiers_formula;
            const entity = typeof src.tiers_formula === 'object' ? src.tiers_formula : null;
            const bonus  = typeof bonusEntry?.tiers_formula === 'object' ? bonusEntry.tiers_formula : null;
            if (!global && !file && !entity && !bonus) return null;
            return Object.assign({}, global ?? {}, file ?? {}, entity ?? {}, bonus ?? {});
        },

        _resolveTierLabel(src, bonusEntry) {
            const template =
                bonusEntry?.tier_label ??
                src.tier_label ??
                src._file_tier_label ??
                this.data.tier_label ??
                '[T{tier}]';
            return tier => template.replace('{tier}', tier);
        },

        srcTierLabel(src, bonus) {
            if (!bonus?._is_ascension) return null;
            const labelFn = this._resolveTierLabel(src, bonus);
            return labelFn(bonus.tiers_formula?.max_tier ?? src.max_ascension);
        },

        _applyFormula(formula, tierOffset = 1) {
            const step = formula.step ?? 1;
            return (formula.init ?? 0) + Math.floor((formula.max_tier - tierOffset + 1) / step) * formula.coeff;
        },

        _generateTierRows(formula, bonusEntry, bonusId) {
            const rows = [];
            if (formula.type === 'linear') {
                const step = formula.step ?? 1;
                const startTier = bonusEntry.unlock_at_tier ?? 1;
                for (let i = startTier; i <= formula.max_tier; i+=step) {
                    const formulaValue = this._applyFormula({ ...formula, max_tier: i }, startTier);
                    const val = this._calculateValue(
                        formulaValue,
                        bonusEntry.scales_with,
                        bonusEntry.scale_formula
                    );
                    const label = formula.tier_labels
                        ? formula.tier_labels[i - startTier]
                        : (formula.label_prefix || 'Tier') + ' ' + i;
                    const row = { label, _formulaValue: formulaValue };
                    row[bonusId] = val;
                    rows.push(row);
                }
            }
            return rows;
        },

        _getTierRows(src, bonusEntry, bonusId) {
            if (src.tiers) return src.tiers;
            const formula = this._resolveFormula(src, bonusEntry);
            if (!formula) return null;
            return this._generateTierRows(formula, bonusEntry, bonusId);
        },

        _resolveBonusIds(bonusId) {
            const parents = this.data.bonus_types
                .filter(bt => bt.aliases?.includes(bonusId))
                .map(bt => bt.id);
            return [bonusId, ...parents];
        },

        // -- SLOT ROUTING --

        _routeSlottedItem(src, b, optimizerBucket) {
            const list = (src.size ?? 1) > 1 || (src.max ?? Infinity) === 1 ? optimizerBucket.exclusive : optimizerBucket.stackable;
            if (!list.find(i => i.id === src.id)) {
                list.push(src);
            }
        },

        _buildAllContainers() {
            const containers = [];
            if (this.data.rune_circles?.length) {
                for (const c of this.data.rune_circles) {
                    containers.push({ id: c.id, slots: c.slots, maxExclusive: 1, slot_type: 'rune_socket' });
                }
            }
            for (const slotDef of this.data.slot_types) {
                if (slotDef.id === 'rune_socket') continue;
                if (!slotDef.max) continue;
                for (let i = 0; i < slotDef.max; i++) {
                    containers.push({ id: slotDef.id + '_' + i, slots: 1, maxExclusive: 1, slot_type: slotDef.id });
                }
            }
            return containers;
        },

        _runOptimizers(optimizerBucket, items) {
            if (!optimizerBucket.exclusive.length && !optimizerBucket.stackable.length) return;
            const bonusIds = this._resolveBonusIds(this.selectedBonus);
            const currentTotals = this._compoundTotal(items);
            const minimize = this.data.bonus_types.find(b => b.id === this.selectedBonus)?.minimize ?? false;
            const sign = minimize ? -1 : 1;
            const applySign = bucket => bucket.map(item => ({
                ...item,
                bonuses: (item.bonuses ?? []).map(b => ({ ...b, value: (b.value ?? 0) * sign }))
            }));
            const result = optimize(
                optimizerBucket.containers,
                minimize ? applySign(optimizerBucket.exclusive) : optimizerBucket.exclusive,
                minimize ? applySign(optimizerBucket.stackable) : optimizerBucket.stackable,
                bonusIds,
                {
                    flat:       currentTotals.flat       ?? 0,
                    percent:    currentTotals.percent    ?? 0,
                    multiplier: currentTotals.multiplier ?? 1,
                }
            );
            if (result.assignment) {
                const resultItems = this._itemsFromOptimizerResult(result, this.selectedBonus);
                resultItems.forEach(item => { item.value *= sign; });
                items.push(...resultItems);
            }
        },

        _countOptimizerItems(result) {
            const counts = {};
            for (const container of result.assignment) {
                for (const item of container.items) {
                    counts[item.id] = (counts[item.id] ?? 0) + 1;
                }
            }
            return counts;
        },

        _itemsFromOptimizerResult(result, bonusId) {
            const counts = this._countOptimizerItems(result);
            const seen = new Set();
            const items = [];
            for (const container of result.assignment) {
                for (const item of container.items) {
                    if (seen.has(item.id)) continue;
                    seen.add(item.id);
                    items.push(...this._buildOptimizerItem(item, bonusId, counts[item.id]));
                }
            }
            return items;
        },

        _bonusPassesFilters(b, src) {
            const classes = b.classes || src.classes;
            if (classes && !classes.includes(this.selectedClass)) return false;
            if (b.condition && !this.activeConditions.has(b.condition)) return false;
            if (b.parameter_min) {
                for (const [paramId, min] of Object.entries(b.parameter_min)) {
                    const p = this.parameters.find(p => p.id === paramId);
                    if (!p || p.value < min) return false;
                }
            }
            return true;
        },

        _buildOptimizerItem(item, bonusId, count) {
            const realSrc = this.data.sources.find(s => s.id === item.id);
            const contrib = this._getContribForBonus(item, this._resolveBonusIds(bonusId));
            return Object.entries(contrib)
                .filter(([, val]) => val)
                .map(([ut, val]) => ({
                    src:          realSrc ?? { id: item.id, name: item.name, type: 'rune', available: true },
                    bonus:        { bonus: bonusId, value: val, unit_type: ut },
                    value:        ut === 'multiplier' ? Math.pow(val, count) : val,
                    unit_type:    ut,
                    mult:         ut === 'multiplier' ? 1 : count,
                    display_mult: count,
                    _key:         item.id + ':' + ut,
                }));
        },

        _getContribForBonus(item, bonusId) {
            const contrib = { flat: 0, percent: 0, multiplier: 0 };
            for (const b of item.bonuses ?? []) {
                const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
                if (!ids.includes(b.bonus)) continue;
                const ut = b.unit_type ?? 'flat';
                contrib[ut] = (contrib[ut] ?? 0) + (b.value ?? 0);
            }
            return contrib;},

        _cacheKeyForBonus(availableOnly) {
            const sources = Object.values(this.groupedSources).flat();
            let hasClasses = false;
            const conditions = new Set();
            const paramIds   = new Set();

            for (const { src, bonuses } of sources) {
                for (const b of bonuses) {
                    if (b.classes || src.classes) hasClasses = true;
                    if (this._bonusPassesFilters(b, src)) {
                        if (b.condition) conditions.add(b.condition);
                        if (b.parameter_min) Object.keys(b.parameter_min).forEach(id => paramIds.add(id));
                        if (b.scales_with)   paramIds.add(b.scales_with);
                    }
                }
            }

            const classKey = hasClasses ? ':c=' + this.selectedClass : '';
            const condKey  = conditions.size
                ? ':cd=' + [...conditions].filter(c => this.activeConditions.has(c)).sort().join(',')
                : '';
            const paramKey = paramIds.size
                ? ':p=' + [...paramIds].map(id => id + '=' + this.parameters.find(p => p.id === id)?.value).join(',')
                : '';

            return this.selectedBonus + ':' + availableOnly + classKey + condKey + paramKey;
        },

        _calcItems(availableOnly) {
            const cacheKey = this._cacheKeyForBonus(availableOnly);
            if (this._calcCache[cacheKey]) return this._calcCache[cacheKey];

            const optimizerBucket = { containers: this._buildAllContainers(), exclusive: [], stackable: [] };
            const items = [];

            const ids = this._resolveBonusIds(this.selectedBonus);
            for (const type of Object.keys(this.data.types)) {
                if (!this.groupedSources[type]) continue;
                for (const { src, bonuses } of this.groupedSources[type]) {
                    if (availableOnly && src.available === false) continue;
                    if (src.optimization?.exclude) continue;

                    for (const b of bonuses.filter(b => {
                        if (!ids.includes(b.bonus)) return false;
                        return this._bonusPassesFilters(b, src);
                    })) {
                        if (src.slot) {
                            this._routeSlottedItem(src, b, optimizerBucket);
                        } else {
                            const value = this._resolveValue(b);
                            const key = src.id + ':' + (b.unit_type || 'flat');
                            const existing = items.find(i => i._key === key);
                            if (existing) {
                                existing.value += value;
                            } else {
                                items.push({ src, bonus: b, value, unit_type: b.unit_type || 'flat', mult: 1, _key: key });
                            }
                        }
                    }
                }
            }

            this._runOptimizers(optimizerBucket, items);

            this._calcCache[cacheKey] = items;
            return items;
        },

        _compoundTotal(items) {
            if (!items.length) return { value: 0, unit_type: 'flat', isMixed: false, "flat": 0, "percent": 0, "multiplier": 1 };
            let flat = 0, percent = 0, multiplier = 1, multiplierCount = 0;
            const unitTypes = new Set();
            for (const item of items) {
                const ut = item.unit_type || 'flat';
                unitTypes.add(ut);
                const total = item.value * item.mult;
                if (ut === 'flat')            flat += total;
                else if (ut === 'percent')    percent += total;
                else if (ut === 'multiplier') { multiplier *= Math.pow(item.value, item.mult); multiplierCount += item.mult; }
            }
            const hasFlat    = unitTypes.has('flat');
            const hasPercent = unitTypes.has('percent');
            const hasMult    = unitTypes.has('multiplier');
            const values = { "flat": flat, "percent": percent, "multiplier": multiplier };

            if (hasFlat)    { return  { ...values, value: flat * (1 + percent / 100) * (multiplier || 1), unit_type: 'flat', isMixed: (hasPercent || hasMult), multiplierCount } }
            if (hasPercent) { return  { ...values, value: percent * (multiplier || 1), unit_type: 'percent', isMixed: hasMult, multiplierCount } }
            return { ...values, value: multiplier, unit_type: 'multiplier', isMixed: false, multiplierCount };
        },

        _setupPopover(id, headerSelector, clientX, clientY) {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.zIndex = this.nextZ();
            positionPopover(el, clientX, clientY);
            if (!el._draggable) {
                makeDraggable(el, el.querySelector(headerSelector), () => {
                    el.style.zIndex = this.nextZ();
                });
                el._draggable = true;
            }
        },
    }
});

app.mount('#app');
