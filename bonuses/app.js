import { createApp, ref, computed, reactive, nextTick, watch } from 'vue';
import {
    DEFAULT_ITEM_CATEGORY_ID,
    DEFAULT_ITEM_CATEGORY_KEY,
    clampPopover,
} from './utils.js';
import { bonusMethods } from './app/bonuses.js?v=1';
import { displayMethods } from './app/display.js?v=1';
import { itemBonusMethods } from './app/ItemBonus.js?v=1';
import { resourceBreakdownMethods } from './app/resourceBreakdown.js?v=1';
import { actionsMethods } from './app/actions.js?v=1';
import { engineeringMethods } from './app/engineering.js?v=1';
import { formulaMethods } from './app/formula.js?v=1';
import { popoverMethods } from './app/popovers.js?v=1';
import { EmptyState } from './components/EmptyState.js?v=1';
import { SourceRow } from './components/SourceRow.js?v=1';
import { TooltipMixin } from './components/TooltipMixin.js?v=1';
import { MixedBreakdown } from './components/MixedBreakdown.js?v=1';
import { MaxPanel } from './components/MaxPanel.js?v=1';
import { ItemPopoverContent } from './components/ItemPopoverContent.js?v=1';
import { PriceBreakdownPopover } from './components/PriceBreakdownPopover.js?v=1';
import { EngineeringPlannerPanel } from './components/EngineeringPlannerPanel.js?v=1';
import { installTabRestoreRecovery } from './restore.js?v=1';

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
                mode: 'requirements',
                anchorSlot: null,
                anchorSpeed: 0,
                slotUpgradeLevel: 0,
                throughputSpeeds: {}
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
                const matching = this._bonusEntriesForBonusView(src, ids);
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
                .filter(src => !q || this.sourceSearchText(src).includes(q));
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
        const initialSearch = window.location.search;

        try {
            const r = await fetch('bonuses.json?v=7');
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
                return sources.map(src => {
                    const resolvedSrc = {
                        ...src,
                        type: src.type ?? file.type,
                        available: src.available ?? true,
                        _file_tiers_formula: file.tiers_formula ?? null,
                        _file_item_popover: file.item_popover ?? null,
                    };

                    const bonuses = (src.bonuses ?? []).map(b => {
                        const formula = this._resolveFormula(resolvedSrc, b);
                        return {
                            ...b,
                            value: formula ? this._applyFormula(formula, b.unlock_at_tier ?? 1) : (b.value ?? 0)
                        };
                    });

                    const ascensionBonuses = (src.ascension_bonuses ?? []).map(b => {
                        const formula = this._resolveFormula(resolvedSrc, b);
                        return {
                            ...b,
                            value: formula ? this._applyFormula(formula, b.unlock_at_tier ?? 0) : (b.value ?? 0),
                            _is_ascension: true
                        };
                    });

                    return {
                        ...resolvedSrc,
                        bonuses: [...bonuses, ...ascensionBonuses]
                    };
                });
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
                let v = Math.min(max, Math.max(min, Number(p.default ?? min)));

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
            this.engineeringPlannerState.throughputSpeeds = (this.data.engineeringPlanner?.slots ?? []).reduce((acc, slot) => {
                acc[slot.id] = 0;
                return acc;
            }, {});
        } catch (e) {
            console.error(e);
            document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
            return;
        }

        this._applyUrlState(initialSearch);
        this.syncUrl();

        window.addEventListener('resize', () => {
            clampPopover(document.getElementById('item-popover'));
            clampPopover(document.getElementById('popover'));
            clampPopover(document.getElementById('price-breakdown-popover'));
        });
        window.addEventListener('popstate', () => {
            this._applyUrlState(window.location.search);
        });
        installTabRestoreRecovery({
            rehydrate: () => {
                if (!this.data) return false;
                this._applyUrlState(window.location.search);
                clampPopover(document.getElementById('item-popover'));
                clampPopover(document.getElementById('popover'));
                clampPopover(document.getElementById('price-breakdown-popover'));
                return true;
            }
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
        ...actionsMethods,
        ...displayMethods,
        ...engineeringMethods,
        ...bonusMethods,
        ...itemBonusMethods,
        ...formulaMethods,
        ...resourceBreakdownMethods,
        ...popoverMethods,
        _applyUrlState(search = window.location.search) {
            if (!this.data) return;
            const params = new URLSearchParams(search);

            const bonusKey = params.get('b');
            const bonusId = bonusKey
                ? this.data.bonus_types.find(b => b.key === bonusKey)?.id ?? bonusKey
                : null;
            const viewParam = params.get('v');

            this.viewMode = viewParam === 'i' ? 'item' : 'bonus';
            this.selectedBonus = bonusId;
            this.itemSearch = params.get('iq') ?? '';

            const classKey = params.get('c');
            this.selectedClass = classKey
                ? this.data.classes.find(c => c.key === classKey)?.id ?? classKey
                : this.data.classes[0].id;

            this.activeConditions = new Set();
            const condParam = params.get('cd');
            if (condParam) {
                condParam.split('-').forEach(key => {
                    const cond = this.data.conditions?.find(c => c.key === key);
                    if (cond) this.activeConditions.add(cond.id);
                });
            }

            this.collapsedSections = new Set();
            const collapsedParam = params.get('s');
            if (collapsedParam) {
                collapsedParam.split('-').forEach(key => {
                    const type = Object.entries(this.data.types).find(([, v]) => v.key === key)?.[0];
                    if (type) this.collapsedSections.add(type);
                });
            }

            this.parameters.forEach(p => {
                const min = p.min ?? 0;
                const max = p.max ?? Infinity;
                const defaultValue = p.default ?? min;
                const parsed = Number(params.get(p.key) ?? defaultValue);
                p.value = Math.min(max, Math.max(min, parsed));
            });

            this.engineeringPlannerCollapsed = params.get('ec') === '1';
            this.engineeringPlannerState.mode = params.get('em') === 't' ? 'throughput' : 'requirements';
            this.engineeringPlannerState.anchorSlot =
                this.data.engineeringPlanner?.default_anchor_slot
                ?? this.data.engineeringPlanner?.slots?.[0]?.id
                ?? null;
            this.engineeringPlannerState.anchorSpeed = 0;
            this.engineeringPlannerState.slotUpgradeLevel = this.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;
            this.engineeringPlannerState.throughputSpeeds = (this.data.engineeringPlanner?.slots ?? []).reduce((acc, slot) => {
                acc[slot.id] = 0;
                return acc;
            }, {});

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
            for (const slot of this.engineeringPlannerConfig()?.slots ?? []) {
                const paramKey = this.engineeringPlannerSpeedParamKey(slot);
                const rawValue = paramKey ? params.get(paramKey) : null;
                if (rawValue == null || rawValue === '') continue;
                const parsed = Number(rawValue);
                if (Number.isFinite(parsed)) {
                    this.engineeringPlannerState.throughputSpeeds[slot.id] = parsed;
                }
            }

            const itemTypeParam = params.get('iy');
            const itemTypeId = itemTypeParam
                ? Object.entries(this.data.types).find(([, def]) => def.key === itemTypeParam)?.[0]
                : null;
            this.itemType = itemTypeId && this.data.types[itemTypeId] ? itemTypeId : (this.itemTypeEntries[0]?.type ?? null);

            this.hiddenItemSections = new Set();
            this.itemSectionAllMode = true;
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
            }

            this.mobileTab = 'sources';
            const tabParam = params.get('t');
            if (tabParam) {
                this.mobileTab = tabParam === 'a' ? 'avail' : tabParam === 'l' ? 'all' : 'sources';
            }

            this._bindMobileScroll();
            if (this.viewMode === 'bonus') {
                nextTick(() => this._scrollTo?.(['sources', 'avail', 'all'].indexOf(this.mobileTab)));
            }
        },
        _bonusEntriesForBonusView(src, bonusIds) {
            return this._expandDerivedBonuses(src.bonuses ?? []).filter(b =>
                bonusIds.includes(b.bonus) && this._bonusMatchesClass(b, src)
            );
        },
        _expandDerivedBonuses(bonuses) {
            const derivedMaps = this.data?.derived_bonus_maps ?? {};
            const expanded = [];

            for (const bonus of bonuses) {
                if (!bonus) continue;
                expanded.push(bonus);

                const mapIds = new Set([bonus.bonus]);
                const explicitMapIds = Array.isArray(bonus.derived_bonus_maps)
                    ? bonus.derived_bonus_maps
                    : (bonus.derived_bonus_map ? [bonus.derived_bonus_map] : []);
                explicitMapIds.filter(Boolean).forEach(id => mapIds.add(id));

                for (const mapId of mapIds) {
                    const derivedEntries = derivedMaps[mapId] ?? [];
                    for (const derived of derivedEntries) {
                        expanded.push(this._buildDerivedBonusEntry(bonus, derived));
                    }
                }
            }

            return expanded;
        },
        _buildDerivedBonusEntry(baseBonus, derivedDef) {
            const multiplier = Number(derivedDef.multiplier ?? 1);
            const derivedBonus = {
                ...baseBonus,
                ...derivedDef,
                bonus: derivedDef.bonus,
                unit_type: derivedDef.unit_type ?? baseBonus.unit_type,
                derived_from: baseBonus.bonus
            };

            if (baseBonus.value !== undefined && derivedDef.value === undefined) {
                derivedBonus.value = this._scaleDerivedValue(baseBonus.value, multiplier);
            }

            if (baseBonus.tiers_formula && derivedDef.tiers_formula === undefined) {
                derivedBonus.tiers_formula = this._scaleDerivedFormula(baseBonus.tiers_formula, multiplier);
            }

            return derivedBonus;
        },
        _scaleDerivedValue(value, multiplier) {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric * multiplier : value;
        },
        _scaleDerivedFormula(formula, multiplier) {
            if (!formula || typeof formula !== 'object') return formula;

            const scaled = { ...formula };
            const scaleField = field => {
                if (typeof scaled[field] === 'number') scaled[field] *= multiplier;
            };

            scaleField('init');
            if (scaled.type !== 'base_percent') {
                scaleField('coeff');
            }

            return scaled;
        },
        tierPopoverNotice(entry) {
            if (!entry?.src || !Array.isArray(entry?.bonuses)) return null;

            for (const bonus of entry.bonuses) {
                const formula = this._resolveFormula(entry.src, bonus);
                if (!formula?.infinite) continue;

                const effectiveMaxTier = this._enhancementPositiveInt(formula.max_tier);
                if (effectiveMaxTier == null) return 'Max tier is not specified.';
                return `Max tier is not specified. Values shown up to tier ${effectiveMaxTier.toLocaleString()}.`;
            }

            return null;
        },
    }
});
app.mount('#app');
