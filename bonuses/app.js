const { createApp, ref, computed, reactive, nextTick, watch } = Vue;

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
    const v = Math.round(value * 1000) / 1000;
    const sign = v >= 0 ? '+' : '';
    const formatted = v.toLocaleString();
    if (unitType === 'multiplier') return '×' + formatted + (unit ? ' ' + unit : '');
    if (unitType === 'percent')    return sign + formatted + unit;
    return sign + formatted + (unit ? ' ' + unit : '');
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
    props: ['entry', 'selectedBonus', 'openDetails', 'app'],
    emits: ['toggle-detail'],
    computed: {
        src:            function() { return this.entry.src; },
        bonuses:        function() { return this.entry.bonuses; },
        isOpen:         function() { return this.openDetails.has(this.entry.src.id); },
        hasTiers:       function() { return this.app.hasTiers(this.entry); },
        tierGroups:     function() { return this.app.getTierGroups(this.entry); },
        valueHtml:      function() { return this.app.entryValueHtml(this.entry); },
        slotMax:        function() { return this.entry.src.slot ? this.app.slotMax(this.entry.src.slot) : null; },
        aliasBonuses: function() { const sel = this.selectedBonus; return this.entry.bonuses.filter(function(b) { return b.bonus !== sel; }); },
        conditionBonus: function() { return this.entry.bonuses.find(function(b) { return b.condition; }) ?? null; },
    },
    methods: {
        bonusLabel(id)    { return this.app.bonusLabel(id); },
        scalesLabel(id)   { return this.app.scalesLabel(id); },
        condLabel(id)     { return this.app.conditionLabel(id); },
        classLabel(id)    { return this.app.classLabel(id); },
        classColor(id)    { return this.app.classColor(id); },
        toggle()    { if (this.hasTiers) this.$emit('toggle-detail', this.src.id); },
        imgError(e)       { e.target.parentElement.innerHTML = '<div class="src-img-ph"></div>'; },
    },
    template: `
        <div class="source-row-wrap" :class="{ 'has-detail': hasTiers }" :data-id="src.id">
            <div class="source-row" @click="toggle">

                <!-- Image -->
                <div class="src-img">
                    <img v-if="src.image" :src="src.image" :alt="src.name" @error="imgError">
                    <div v-else class="src-img-ph"></div>
                </div>

                <!-- Info -->
                <div class="src-info">
                    <div class="src-name">{{ src.name }}</div>
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
                    </div>
                </div>

                <!-- Right -->
                <div class="src-right">
                    <div class="src-val" v-html="valueHtml"></div>
                    <div v-if="slotMax" class="src-slots">
                        {{ slotMax > 1 ? 'up to ' + slotMax + ' slots' : '1 slot' }}
                    </div>
                    <span v-if="hasTiers" class="src-chev" :style="isOpen ? 'transform:rotate(180deg)' : ''">▼</span>
                </div>
            </div>

            <!-- Detail table -->
            <div v-if="hasTiers" class="detail-table" :class="{ open: isOpen }">
                <div v-for="(group, gi) in tierGroups" :key="gi">
                    <div v-if="group.label" class="detail-label-row">{{ group.label }}</div>
                    <div v-for="(tier, ti) in group.rows" :key="ti"
                         class="detail-row"
                         :style="tier.isEllipsis ? { color: 'var(--hint)', justifyContent: 'center' } : {}">
                        <template v-if="tier.isEllipsis">⋯</template>
                        <template v-else>
                            <span class="detail-lbl">{{ tier.label }}</span>
                            <span class="detail-val">{{ tier.valText }}</span>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `
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
                            <span :style="item.src.available === false ? { color: '#d04040' } : {}">
                                {{ itemLabel(item) }}
                            </span>
                        </div>
                        <div class="bd-val">
                            {{ formatVal(item.value * item.mult, unitFor(item.src.type, item.unit_type), item.unit_type) }}
                        </div>
                    </div>
                    <div class="bd-total">
                        <span>Total</span>
                        <div style="text-align: right">
                            <div>{{ formatTotal(maxResult) }}</div>
                            <div v-if="maxResult.isMixed" class="max-panel-breakdown">
                                <span v-if="maxResult.flat">{{ formatVal(Math.round(maxResult.flat * 10) / 10, unitFor(app.selectedBonus, 'flat'), 'flat') }}</span>
                                <span v-if="maxResult.percent">{{ formatVal(Math.round(maxResult.percent * 10) / 10, unitFor(app.selectedBonus, 'percent'), 'percent') }}</span>
                                <span v-if="maxResult.multiplier">{{ formatVal(Math.round(maxResult.multiplier * 10) / 10, unitFor(app.selectedBonus, 'multiplier'), 'multiplier') }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
const app = createApp({
    components: { SourceRow, MaxPanel, EmptyState },

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
            const groups = {};
            for (const src of this.data.sources) {
                const matching = this._getMatchingBonuses(src, this.selectedBonus);
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

        maxItems() {
            if (!this.data || !this.selectedBonus) return [];
            return this._calcItems(this.maxTab === 'avail');
        },

        maxResult() {
            return this._compoundTotal(this.maxItems);
        },
    },

    watch: {
        dropdownOpen(val) {
            if (val) nextTick(() => this.$refs.bonusSearchInput?.focus());
        }
    },

    async mounted() {
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
                    bonuses: src.bonuses.map(b => {
                        const formula = this._resolveFormula(
                            { _file_tiers_formula: file.tiers_formula ?? null, ...src }, b
                        );
                        const computedValue = formula
                            ? (formula.init ?? formula.coeff) + (formula.max_tier - 1) * formula.coeff
                            : (b.value ?? 0);
                        return { ...b, value: computedValue };
                    })
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
            this.mobileTab = tab;
            nextTick(() => this._scrollTo?.(['sources', 'avail', 'all'].indexOf(tab)));
        }

        document.addEventListener('click', (e) => {
            const desktop = document.querySelector('.sidebar-left .bonus-select-wrap');
            const mobile = document.querySelector('.mobile-bonus-wrap');
            if (!desktop?.contains(e.target) && !mobile?.contains(e.target)) {
                this.dropdownOpen = false;
            }
            this.popoverEntry = null;
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

        columnEntries(type, col) {
            return (this.groupedSources[type] ?? []).filter((_, i) => i % 2 === col);
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

        getTierGroups(entry) {
            const allTierRows = entry.bonuses
                .map(b => ({ b, rows: this._getTierRows(entry.src, b, this.selectedBonus) }))
                .filter(x => x.rows);

            return allTierRows.map(({ b, rows }, gi) => {
                const label = allTierRows.length > 1 ? (b.label || 'Node ' + (gi + 1)) : null;
                const total = rows.length;
                const indices = total <= 5 ? rows.map((_, i) => i) : [0, 1, 2, null, total - 1];

                const displayRows = indices.map(idx => {
                    if (idx === null) return { isEllipsis: true };
                    const tier = rows[idx];
                    const ut = b.unit_type || 'flat';
                    const tierVal = tier[this.selectedBonus];
                    return {
                        isEllipsis: false,
                        label: tier.label,
                        valText: tierVal != null ? formatVal(tierVal, this.unitFor(this.selectedBonus, ut), ut) : '—'
                    };
                });

                return { label, rows: displayRows };
            });
        },

        openPopover(item, event) {
            const entry = this.groupedSources[item.src.type]?.find(e => e.src.id === item.src.id);
            if (!entry) return;
            this.popoverOpenDetails = new Set();
            this.popoverEntry = { entry, type: item.src.type };
            nextTick(() => {
                const popover = document.getElementById('popover');
                const pw = popover.offsetWidth;
                const ph = popover.offsetHeight;
                let x = event.clientX - pw - 8;
                let y = event.clientY + 16;
                if (x < 0) x = event.clientX + 8;
                if (y + ph > window.innerHeight) y = window.innerHeight - ph + 8;
                popover.style.left = x + 'px';
                popover.style.top = y + 'px';
            });
        },

        closePopover() {
            this.popoverEntry = null;
        },

        togglePopoverDetail(srcId) {
            const s = new Set(this.popoverOpenDetails);
            s.has(srcId) ? s.delete(srcId) : s.add(srcId);
            this.popoverOpenDetails = s;
        },

        openMobileSource(item) {
            const entry = this.groupedSources[item.src.type]?.find(e => e.src.id === item.src.id);
            if (entry && this.hasTiers(entry)) {
                const s = new Set(this.openDetails);
                s.add(item.src.id);
                this.openDetails = s;
            }
            this.setMobileTab('sources');
            nextTick(() => {
                const el = document.querySelector(`.source-row-wrap[data-id="${item.src.id}"]`);
                if (!el) return;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        /* ── PRIVATE ── */
        _resolveValue(b) {
            return this._calculateValue(b.value, b.scales_with);
        },

        _calculateValue(val, scales_with) {
            const p = this.parameters?.find(p => p.id === scales_with);
            return p ? p.value * val : (val ?? 0);
        },

        _getMatchingBonuses(src, bonusId) {
            const parents = this.data.bonus_types
                .filter(bt => bt.aliases?.includes(bonusId))
                .map(bt => bt.id);
            const ids = [bonusId, ...parents];
            return src.bonuses.filter(b => ids.includes(b.bonus));
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

        _generateTierRows(formula, bonusEntry, bonusId) {
            const rows = [];
            if (formula.type === 'linear') {
                for (let i = 1; i <= formula.max_tier; i++) {
                    const val = this._calculateValue(
                        (formula.init ?? formula.coeff) + (i - 1) * (formula.coeff ?? 0),
                        bonusEntry.scales_with
                    );
                    const label = formula.tier_labels
                        ? formula.tier_labels[i - 1]
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

        _calcItems(availableOnly) {
            const slotBest = {};
            const items = [];

            for (const type of Object.keys(this.data.types)) {
                if (!this.groupedSources[type]) continue;
                for (const { src, bonuses } of this.groupedSources[type]) {
                    if (availableOnly && src.available === false) continue;

                    const parents = this.data.bonus_types
                        .filter(bt => bt.aliases?.includes(this.selectedBonus))
                        .map(bt => bt.id);
                    const ids = [this.selectedBonus, ...parents];

                    for (const b of bonuses.filter(b => {
                        if (!ids.includes(b.bonus)) return false;
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
                    })) {
                        const key = src.id + ':' + (b.unit_type || 'flat');
                        const value = this._resolveValue(b);

                        if (src.slot) {
                            const max = this.slotMax(src.slot);
                            if (max === 1) {
                                const slotKey = src.slot + ':' + (b.unit_type || 'flat');
                                if (!slotBest[slotKey] || value > slotBest[slotKey].value) {
                                    slotBest[slotKey] = { src, bonus: b, value, unit_type: b.unit_type || 'flat', mult: 1 };
                                }
                            } else {
                                items.push({ src, bonus: b, value, unit_type: b.unit_type || 'flat', mult: max });
                            }
                        } else {
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

            for (const s of Object.values(slotBest)) items.push(s);
            return items;
        },

        _compoundTotal(items) {
            if (!items.length) return { value: 0, unit_type: 'flat', isMixed: false, "flat": 0, "percent": 0, "multiplier": 0 };
            let flat = 0, percent = 0, multiplier = 0;
            const unitTypes = new Set(items.map(i => i.unit_type || 'flat'));
            for (const item of items) {
                const ut = item.unit_type || 'flat';
                const total = item.value * item.mult;
                if (ut === 'flat')            flat += total;
                else if (ut === 'percent')    percent += total;
                else if (ut === 'multiplier') multiplier += total;
            }
            const hasFlat    = unitTypes.has('flat');
            const hasPercent = unitTypes.has('percent');
            const hasMult    = unitTypes.has('multiplier');
            const values = { "flat": flat, "percent": percent, "multiplier": multiplier };

            if (hasFlat)    { return  { ...values, value: flat * (1 + percent / 100) * (multiplier || 1), unit_type: 'flat', isMixed: (hasPercent || hasMult) } }
            if (hasPercent) { return  { ...values, value: percent * (multiplier || 1), unit_type: 'percent', isMixed: hasMult } }
            return { ...values, value: multiplier, unit_type: 'multiplier', isMixed: false };
        },
    }
});

app.mount('#app');