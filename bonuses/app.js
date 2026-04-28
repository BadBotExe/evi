import { createApp, ref, computed, reactive, nextTick, watch } from 'vue';
import { optimize } from './optimizer.js';

/* ── CONSTANTS ── */
const DEFAULT_UNITS = { flat: '', percent: '%', multiplier: '' };

/* ══════════════════════════════════════════
   SHARED HELPERS (pure functions, no state)
══════════════════════════════════════════ */
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

function normalizeValue(value) {
    return Math.round(value * 10000) / 10000;
}

/* ══════════════════════════════════════════
   EMPTY STATE COMPONENT
══════════════════════════════════════════ */
const EmptyState = {
    props: ['selectedBonus'],
    template: `
        <div class="empty-state" v-if="!selectedBonus">
            <div class="empty-icon">✦</div>
            <div class="empty-title">No bonus selected</div>
            <div class="empty-sub">Select a bonus from the dropdown to see all sources and maximum obtainable values</div>
        </div>
    `
};

/* ══════════════════════════════════════════
   SOURCE ROW COMPONENT
══════════════════════════════════════════ */
const SourceRow = {
    props: ['entry', 'selectedBonus', 'openDetails', 'app', 'fromPopover'],
    emits: ['toggle-detail'],
    computed: {
        src:            function() { return this.entry.src; },
        bonuses:        function() { return this.entry.bonuses; },
        isOpen:         function() { return false; },
        hasTiers:       function() { return this.app.hasTiers(this.entry); },
        tierGroups:     function() { return this.app.getTierGroups(this.entry); },
        valueHtml:      function() { return this.app.entryValueHtml(this.entry); },
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
                    <div class="src-name" @mousemove="app.showTooltip($event)" @mouseleave="app.hideTooltip()">
                        <span class="src-name-text">{{ src.name }}</span>
                        <span v-if="tierLabel" class="tag tag-tier">{{ tierLabel }}</span>
                    </div>
                    <div class="src-tags">
                        <span v-for="b in aliasBonuses" :key="b.bonus" class="tag tag-alias">
                            {{ bonusLabel(b.bonus) }}
                        </span>
                        <span v-if="bonuses[0]?.derived_from" class="tag src-derived">
                            {{ bonusLabel(bonuses[0].derived_from) }}
                        </span>
                        <span v-if="src.available === false" class="tag tag-na">Unavailable</span>
                        <span v-for="c in (src.classes ?? [])" :key="c" class="tag"
                              :style="{ background: classColor(c) + '22', color: classColor(c) }">
                            {{ classLabel(c) }}
                        </span>
                        <span v-if="bonuses[0]?.scales_with" class="tag src-scales">
                            {{ scalesLabel(bonuses[0].scales_with) }}
                        </span>
                        <span v-if="conditionBonus" class="tag tag-conditional"
                              :class="{ 'tag-conditional-fail': !app.activeConditions.has(conditionBonus.condition) }">
                            ⚑ {{ condLabel(conditionBonus.condition) }}
                        </span>
                        <span v-for="[paramId, min] in Object.entries(bonuses[0].parameter_min ?? {})" 
                              :key="paramId" class="tag tag-conditional"
                              :class="{ 'tag-conditional-fail': !app.isParamMet(paramId, min) }">
                            {{ app.paramLabel(paramId) }} ≥ {{ min }}
                        </span>
                        <span v-if="src.slot" class="tag tag-slot"
                              :style="{ background: app.slotColor(src.slot) + '22', color: app.slotColor(src.slot) }">
                            {{ app.slotLabel(src.slot) }}{{ src.size > 1 ? ' ×' + src.size : '' }}
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
        showTooltip(e) {
            if (e.target.offsetWidth >= e.target.scrollWidth) return;
            this.tooltipText = e.target.textContent.trim();
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

/* ══════════════════════════════════════════
   MAX PANEL COMPONENT
══════════════════════════════════════════ */
const MaxPanel = {
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
                ? Math.round(raw * 100) / 100
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
                            <div v-if="maxResult.isMixed" class="max-panel-breakdown">
                                <span v-if="maxResult.flat">{{ formatVal(Math.round(maxResult.flat * 10) / 10, unitFor(app.selectedBonus, 'flat'), 'flat') }}</span>
                                <span v-if="maxResult.percent">{{ formatVal(Math.round(maxResult.percent * 10) / 10, unitFor(app.selectedBonus, 'percent'), 'percent') }}</span>
                                <span v-if="maxResult.multiplier">{{ (maxResult.multiplierCount > 1 ? '~' : '') + formatVal(Math.round(maxResult.multiplier * 10) / 10, unitFor(app.selectedBonus, 'multiplier'), 'multiplier') }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};

const ItemPopoverContent = {
    props: ['src', 'app'],
    emits: ['close'],
    methods: {
        imgError(e) { e.target.parentElement.innerHTML = '<div class="src-img-ph"></div>'; },
    },
    template: `
        <div class="item-popover-header">
            <div class="item-popover-img">
                <img v-if="src.image" :src="src.image" :alt="src.name" @error="imgError">
                <div v-else class="src-img-ph"></div>
            </div>
            <div>
                <div class="item-popover-name" @mousemove="app.showTooltip($event)" @mouseleave="app.hideTooltip()">{{ src.name }}</div>
                <div class="item-popover-type">{{ app.data.types[src.type]?.label }}</div>
            </div>
            <button class="popover-close" @click="$emit('close')">✕</button>
        </div>
        <div class="item-popover-bonuses">
            <div v-if="app.popoverBonuses(src).length === 0" class="item-popover-empty">
                No bonuses
            </div>
            <div v-for="b in app.popoverBonuses(src)" :key="b.bonus + (b.unit_type || 'flat')"
                 class="item-popover-row"
                 :class="{ 'item-popover-row-tiers': app.bonusHasTiers(src, b) }"
                 @click="app.bonusHasTiers(src, b) ? app.openTierPopoverForBonus(src, b, $event) : null">
                <span class="item-popover-bonus-label">
                    <span v-if="b._is_ascension" class="tag tag-tier">{{ app.srcTierLabel(src, b) }}</span>
                    {{ app.bonusLabel(b.bonus) }}
                </span>
                <span class="item-popover-bonus-val">{{ app.itemPopoverBonusValue(src, b) }}</span>
            </div>
        </div>
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

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
const app = createApp({
    mixins: [TooltipMixin],
    components: { SourceRow, MaxPanel, EmptyState, ItemPopoverContent },

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
            selectedBonus: null,
            selectedClass: null,
            dropdownOpen: false,
            bonusSearch: '',
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
            _zCounter: 600,
            tierPopoverColThreshold: 10
        };
    },

    computed: {
        appRef() { return this; },

        reportUrl() {
            return `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent('[Bonuses] Issue')}&body=${encodeURIComponent('**Bonus:** ' + (this.selectedBonus ?? 'N/A') + '\n\n**Description:**\n')}`;
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
        }
    },

    async mounted() {
        this._calcCache = {};
        const params = new URLSearchParams(window.location.search);

        try {
            const r = await fetch('bonuses.json');
            this.data = await r.json();

            const sourceArrays = await Promise.all(
                this.data.source_files.map(f => fetch(f).then(r => r.json()))
            );

            this.data.sources = sourceArrays.flatMap(file =>
                file.bonuses.map(src => ({
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
                }))
            );

            this.parameters = (this.data.parameters ?? []).map(p => {
                const min = p.min ?? 0, max = p.max ?? Infinity;

                let v = Math.min(max, Math.max(min, Number(params.get(p.key) ?? p.default ?? min)));

                Object.defineProperty(p, 'value', {
                    get: () => v,
                    set: val => v = Math.min(max, Math.max(min, Number(val ?? min)))
                });

                return p;
            });
        } catch (e) {
            console.error(e);
            document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
            return;
        }

        const bonusKey = params.get('b');
        const bonusId = bonusKey
            ? this.data.bonus_types.find(b => b.key === bonusKey)?.id ?? bonusKey
            : null;

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

        if (bonusId) this.selectedBonus = bonusId;

        const scroller = this.$refs.mobileScroll;
        if (scroller) {
            this._scrollTo = (idx) => {
                scroller.scrollTo({ left: idx * window.innerWidth, behavior: 'smooth' });
            };
            scroller.addEventListener('scrollend', () => {
                const idx = Math.round(scroller.scrollLeft / window.innerWidth);
                this.mobileTab = ['sources', 'avail', 'all'][idx] ?? 'sources';
            });
        }

        const tabParam = params.get('t');
        if (tabParam) {
            const tab = tabParam === 'a' ? 'avail' : tabParam === 'l' ? 'all' : 'sources';
            this.mobimaxleTab = tab;
            nextTick(() => this._scrollTo?.(['sources', 'avail', 'all'].indexOf(tab)));
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.tierPopoverEntry) { this.cmaxloseTierPopover(); return; }
            if (this.itemPopoverEntry) { this.closeItemPopover(); return; }
            if (this.popoverEntry)     { this.closePopover();     return; }
        });

        window.addEventListener('resize', () => {
            clampPopover(document.getElementById('item-popover'));
            clampPopover(document.getElementById('popover'));
        });

        document.addEventListener('click', (e) => {
            const desktop = document.querySelector('.sidebar-left .bonus-select-wrap');
            const mobile = document.querySelector('.mobile-bonus-wrap');
            if (!desktop?.contains(e.target) && !mobile?.contains(e.target)) {
                this.dropdownOpen = false;
            }
            this.popoverEntry = null;
            if (!document.getElementById('item-popover')?.contains(e.target)) {
                this.itemPopoverEntry = null;
            }
            if (!document.getElementById('tier-popover')?.contains(e.target)) {
                this.tierPopoverEntry = null;
            }
        });
    },

    methods: {
        /* ── ACTIONS ── */
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

        selectBonus(id) {
            this.selectedBonus = id;
            this.openDetails = new Set();
            this.syncUrl();
        },

        toggleSection(type) {
            const s = new Set(this.collapsedSections);
            s.has(type) ? s.delete(type) : s.add(type);
            this.collapsedSections = s;
            this.syncUrl();
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
            return (this.groupedSources[type] ?? []).map((entry, i) => ({
                ...entry,
                _col: (i % 2) + 1,
                _row: Math.floor(i / 2) + 1,
            }));
        },

        syncUrl() {
            if (!this.data) return;
            const params = new URLSearchParams();
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
            if (this.mobileTab !== 'sources') {
                params.set('t', this.mobileTab === 'avail' ? 'a' : 'l');
            }
            history.replaceState(null, '', '?' + params.toString());
        },

        /* ── DISPLAY HELPERS (also used by child components via :app="appRef") ── */
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

        unitFor(bonusId, unitType) {
            return unitFor(this.data?.bonus_types ?? [], bonusId, unitType);
        },

        formatVal(value, unit, unitType) {
            return formatVal(value, unit, unitType);
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

        entryValueHtml(entry) {
            const sums = {};
            for (const b of entry.bonuses) {
                const key = b.bonus + ':' + (b.unit_type || 'flat');
                sums[key] = (sums[key] || 0) + this._resolveValue(b);
            }
            return Object.entries(sums).map(([key, sum]) => {
                const [bonusId, ut] = key.split(':');
                return formatVal(sum, this.unitFor(bonusId, ut), ut);
            }).join('<br>');
        },

        hasTiers(entry) {
            return entry.bonuses.some(b => !!this._getTierRows(entry.src, b, this.selectedBonus));
        },

        bonusHasTiers(src, bonus) {
            return !!this._getTierRows(src, bonus, bonus.bonus);
        },

        openTierPopoverForBonus(src, bonus, event) {
            const entry = { src, bonuses: [bonus] };
            this.openTierPopover(entry, event, true);
        },

        getTierGroups(entry) {
            const allTierRows = entry.bonuses
                .map(b => ({ b, rows: this._getTierRows(entry.src, b, this.selectedBonus) }))
                .filter(x => x.rows);

            return allTierRows.map(({ b, rows }, gi) => {
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
                    const tierVal = tier[this.selectedBonus];
                    return {
                        isEllipsis: false,
                        label: tier.label,
                        _rawVal: tierVal,
                        valText: '—'
                    };
                });

                const decimals = maxDecimalsInRows(displayRows);
                const ut = b.unit_type || 'flat';
                const unit = this.unitFor(this.selectedBonus, ut);
                displayRows.forEach(r => {
                    if (!r.isEllipsis && r._rawVal != null)
                        r.valText = formatValFixed(r._rawVal, unit, ut, decimals);
                });
                return { label, rows: displayRows };
            });
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
            return (src.bonuses ?? []).filter(b => this.resolveBonusPopover(src, b) !== false);
        },

        openItemPopover(src, event, fromPopover = false) {
            if (this.resolveItemPopover(src) === false) return;
            if (!fromPopover) this.closePopover();
            this.closeTierPopover();
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

        itemPopoverBonusValue(src, bonus) {
            const value = this._resolveValue(bonus);
            const ut = bonus.unit_type || 'flat';
            const unit = this.unitFor(bonus.bonus, ut);
            return formatVal(value, unit, ut);
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

        /* ── PRIVATE ── */
        _resolveValue(b) {
            return this._calculateValue(b.value, b.scales_with);
        },

        _calculateValue(val, scales_with) {
            const p = this.parameters?.find(p => p.id === scales_with);
            return p ? p.value * val : (val ?? 0);
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
                    const val = this._calculateValue(
                        this._applyFormula({ ...formula, max_tier: i }, startTier),
                        bonusEntry.scales_with
                    );
                    const label = formula.tier_labels
                        ? formula.tier_labels[i - startTier]
                        : (formula.label_prefix || 'Tier') + ' ' + i;
                    const row = { label };
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

        // ── SLOT ROUTING ──

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