import { createApp, nextTick } from 'vue';
import {
    DEFAULT_ITEM_CATEGORY_ID,
} from './utils.js?v=7e5a144c2d';
import { bonusMethods } from './app/bonuses.js?v=c938a35aa6';
import { displayMethods } from './app/display.js?v=85d72e1ac0';
import { itemBonusMethods } from './app/ItemBonus.js?v=b433d26a45';
import { resourceBreakdownMethods } from './app/resourceBreakdown.js?v=2301cda3b2';
import { actionsMethods } from './app/actions.js?v=52d9348984';
import { engineeringPlannerMethods } from './app/engineeringPlanner.js?v=55ce95e6b1';
import { formulaMethods } from './app/formula.js?v=8a40af3dda';
import { petReferenceMethods } from './app/petReference.js?v=8b277dbb0c';
import { popoverMethods } from './app/popovers.js?v=efff4439ae';
import { EmptyState } from './components/EmptyState.js?v=e8b19b68b5';
import { SourceRow } from './components/SourceRow.js?v=42e31bec1f';
import { TooltipMixin } from './components/TooltipMixin.js?v=091bd7f1e1';
import { MixedBreakdown } from './components/MixedBreakdown.js?v=c68ec99571';
import { MaxPanel } from './components/MaxPanel.js?v=368dc7684d';
import { ItemPopoverContent } from './components/ItemPopoverContent.js?v=20b239c8b2';
import { PriceBreakdownPopover } from './components/PriceBreakdownPopover.js?v=21ad65f0bc';
import { ItemSectionPanel } from './components/ItemSectionPanel.js?v=7f5750d445';
import { DataTablePopover } from './components/DataTablePopover.js?v=6df0c9aa48';
import { QuantityPopover } from './components/QuantityPopover.js?v=e2061cd5c2';
import { EngineeringPlannerPanel } from './components/EngineeringPlannerPanel.js?v=839ca83c95';
import { BonusSourceResolver } from './app/sourceResolver.js?v=c7cac88719';
import { BonusDataLoader } from './app/dataLoader.js?v=c3f2dba59b';
import { BonusUrlState } from './app/urlState.js?v=c62da8d4da';
import { BonusAppLifecycle } from './app/lifecycle.js?v=8614770287';
import { BonusSaveIntegration } from './app/saveIntegration.js?v=8e50166c06';

const SAVE_STORAGE_KEY = 'evitania_bonuses_loaded_save';

/* ==========================================
   MAIN APP
========================================== */
const app = createApp({
    mixins: [TooltipMixin],
    components: { SourceRow, MaxPanel, EmptyState, ItemPopoverContent, MixedBreakdown, PriceBreakdownPopover, ItemSectionPanel, DataTablePopover, QuantityPopover, EngineeringPlannerPanel },

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
            selectedCalc: 'engineering-planner',
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
            quantityPopoverEntry: null,
            quantitySheetOpen: false,
            maxPanelEdits: {
                avail: { counts: {}, tiers: {}, disabled: {} },
                all: { counts: {}, tiers: {}, disabled: {} },
                actual: { counts: {}, tiers: {}, disabled: {} }
            },
            priceBreakdownEntry: null,
            priceBreakdownSheetOpen: false,
            dataTableEntry: null,
            dataTableSheetOpen: false,
            tierTabSelections: {},
            tierPreviewExpansions: {},
            _resourceBreakdownCumulativeCache: new WeakMap(),
            isMobileViewport: window.matchMedia('(max-width: 900px)').matches,
            _zCounter: 600,
            tierPopoverColThreshold: 10,
            engineeringPlannerCollapsed: false,
            engineeringPlannerState: {
                mode: 'requirements',
                inputMode: 'items',
                anchorSlot: null,
                anchorSpeed: 0,
                anchorItemsPerHour: null,
                slotUpgradeLevel: 0,
                throughputSpeeds: {},
                throughputItemsPerHour: {}
            },
            saveToolsVisible: false,
            saveContext: null,
            saveError: '',
            selectedSaveHeroIndex: null
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

        calcEntries() {
            const entries = [];
            if (this.data?.engineeringPlanner) {
                entries.push({
                    id: 'engineering-planner',
                    key: 'e',
                    label: 'Engineering Planner'
                });
            }
            return entries;
        },

        activeCalc() {
            return this.selectedCalc ?? this.calcEntries[0]?.id ?? null;
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

        itemSectionPanels() {
            if (!this.activeItemType) return [];
            const panelsByType = {
                pet: [this.petReferencePanel()]
            };
            return panelsByType[this.activeItemType]?.filter(Boolean) ?? [];
        },

        allItemSectionsVisible() {
            return this.itemSectionAllMode;
        },

        maxItemsAvail() {
            if (!this.data || !this.selectedBonus) return [];
            return this._applyMaxPanelEdits(this._calcItems(true, this.data._base_sources, 'base'), 'avail', 'base');
        },

        maxItemsAll() {
            if (!this.data || !this.selectedBonus) return [];
            const hasUnavailable = this._entriesForSourceList(this.data._base_sources)
                .some(({ src }) => src.available === false);
            const baseItems = hasUnavailable
                ? this._calcItems(false, this.data._base_sources, 'base')
                : this._calcItems(true, this.data._base_sources, 'base');
            return this._applyMaxPanelEdits(baseItems, 'all', 'base');
        },

        maxItemsActual() {
            if (!this.data || !this.selectedBonus) return [];
            return this._applyMaxPanelEdits(this._calcItems(true, this.data.sources, 'actual'), 'actual', 'actual');
        },

        maxItems() {
            if (this.maxTab === 'actual') return this.maxItemsActual;
            return this.maxTab === 'avail' ? this.maxItemsAvail : this.maxItemsAll;
        },

        maxResult() {
            return this._compoundTotal(this.maxItems);
        },

        showEngineeringPlanner() {
            return this.activeCalc === 'engineering-planner' && !!this.data?.engineeringPlanner;
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
        this._sourceResolver = new BonusSourceResolver(this);
        this._dataLoader = new BonusDataLoader(this);
        this._urlState = new BonusUrlState(this);
        this._lifecycle = new BonusAppLifecycle(this);
        this._saveIntegration = new BonusSaveIntegration(this);

        try {
            await this._dataLoader.load();
        } catch (e) {
            console.error(e);
            document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
            return;
        }

        this.saveToolsVisible = localStorage.getItem('evitania_bonuses_save_tools') === '1';
        await this._restorePersistedSave();
        this._applyUrlState(initialSearch);
        this.syncUrl();
        this._lifecycle.install();
    },

    methods: {
        ...actionsMethods,
        ...displayMethods,
        ...engineeringPlannerMethods,
        ...bonusMethods,
        ...itemBonusMethods,
        ...formulaMethods,
        ...petReferenceMethods,
        ...resourceBreakdownMethods,
        ...popoverMethods,
        async onSaveFileChange(event) {
            const file = event?.target?.files?.[0];
            if (!file) return;
            try {
                const saveText = await file.text();
                const context = await this._parseSaveText(saveText);
                const heroIndex = context.heroes[0]?.index ?? null;
                this._applyLoadedSave(context, heroIndex);
                this._persistLoadedSave(saveText, heroIndex);
            } catch (error) {
                console.error(error);
                this.saveError = error?.message ?? 'Could not decode save';
            } finally {
                if (event?.target) event.target.value = '';
            }
        },
        onSaveHeroChange() {
            this.saveError = '';
            this._saveIntegration.applySaveContext(this.saveContext, this.selectedSaveHeroIndex);
            this._persistLoadedSaveSelection();
            this.syncUrl();
        },
        clearSaveContext() {
            this.saveContext = null;
            this.saveError = '';
            this.selectedSaveHeroIndex = null;
            this._saveIntegration.applySaveContext(null, null);
            localStorage.removeItem(SAVE_STORAGE_KEY);
            this._applyUrlState(window.location.search);
            this.syncUrl();
        },
        async copyRawSaveToClipboard() {
            if (!this.saveContext?.raw) return;
            const text = JSON.stringify(this.saveContext.raw, null, 2);
            this.saveError = '';
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    return;
                }
            } catch (error) {
                console.error(error);
            }

            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (!copied) {
                this.saveError = 'Could not copy raw save JSON';
            }
        },
        async _parseSaveText(saveText) {
            const { parseSaveText } = await import('./app/saveCodec.js?v=ddd0f5cb00');
            return parseSaveText(saveText);
        },
        _serializeSaveValue(value) {
            if (value instanceof Map) {
                return Object.fromEntries(
                    [...value.entries()].map(([key, entryValue]) => [key, this._serializeSaveValue(entryValue)])
                );
            }
            if (Array.isArray(value)) {
                return value.map(entry => this._serializeSaveValue(entry));
            }
            if (value && typeof value === 'object') {
                return Object.fromEntries(
                    Object.entries(value).map(([key, entryValue]) => [key, this._serializeSaveValue(entryValue)])
                );
            }
            return value;
        },
        _applyLoadedSave(context, heroIndex) {
            this.saveContext = context;
            this.saveError = '';
            this.selectedSaveHeroIndex = heroIndex;
            this._saveIntegration.applySaveContext(context, heroIndex);
            this.syncUrl();
        },
        _persistLoadedSave(saveText, heroIndex) {
            try {
                localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
                    saveText,
                    heroIndex
                }));
            } catch (error) {
                console.error(error);
                this.saveError = 'Loaded save could not be stored locally';
            }
        },
        _persistLoadedSaveSelection() {
            try {
                const raw = localStorage.getItem(SAVE_STORAGE_KEY);
                if (!raw) return;
                const stored = JSON.parse(raw);
                if (!stored?.saveText) return;
                localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
                    saveText: stored.saveText,
                    heroIndex: this.selectedSaveHeroIndex
                }));
            } catch (error) {
                console.error(error);
            }
        },
        async _restorePersistedSave() {
            try {
                const raw = localStorage.getItem(SAVE_STORAGE_KEY);
                if (!raw) return;
                const stored = JSON.parse(raw);
                if (!stored?.saveText) return;
                const context = await this._parseSaveText(stored.saveText);
                const heroIndex = context.heroes.some(hero => hero.index === stored.heroIndex)
                    ? stored.heroIndex
                    : (context.heroes[0]?.index ?? null);
                this._applyLoadedSave(context, heroIndex);
            } catch (error) {
                console.error(error);
                this.saveError = 'Stored save could not be restored';
                localStorage.removeItem(SAVE_STORAGE_KEY);
            }
        },
        _resolveRelativeAssetPath(baseFilePath, assetPath) {
            return this._sourceResolver.resolveRelativeAssetPath(baseFilePath, assetPath);
        },
        _resolveItemFileRefs(file, filePath) {
            return this._sourceResolver.resolveItemFileRefs(file, filePath);
        },
        _applyUrlState(search = window.location.search) {
            this._urlState.apply(search);
        },
        _bonusEntriesForBonusView(src, bonusIds) {
            return this._sourceResolver.bonusEntriesForBonusView(src, bonusIds);
        },
        _expandDerivedBonuses(bonuses) {
            return this._sourceResolver.expandDerivedBonuses(bonuses);
        },
        _buildDerivedBonusEntry(baseBonus, derivedDef) {
            return this._sourceResolver.buildDerivedBonusEntry(baseBonus, derivedDef);
        },
        _scaleDerivedValue(value, multiplier) {
            return this._sourceResolver.scaleDerivedValue(value, multiplier);
        },
        _scaleDerivedFormula(formula, multiplier) {
            return this._sourceResolver.scaleDerivedFormula(formula, multiplier);
        },
        tierPopoverNotice(entry) {
            return this._sourceResolver.tierPopoverNotice(entry);
        },
    }
});
app.mount('#app');
