import { createApp, nextTick } from 'vue';
import { bonusMethods } from './app/bonuses.js?v=53660b15e9';
import { displayMethods } from './app/display.js?v=644e2be3de';
import { itemBonusMethods } from './app/ItemBonus.js?v=8ea3ac4d6a';
import { resourceBreakdownMethods } from './app/resourceBreakdown.js?v=6b328f1c4b';
import { actionsMethods } from './app/actions.js?v=1ae219cf98';
import { engineeringPlannerMethods } from './app/engineeringPlanner.js?v=1726c68356';
import { formulaMethods } from './app/formula.js?v=4e475f5ba9';
import { petReferenceMethods } from './app/petReference.js?v=8b277dbb0c';
import { popoverMethods } from './app/popovers.js?v=636ecc113a';
import { EmptyState } from './components/EmptyState.js?v=62cae79893';
import { SourceRow } from './components/SourceRow.js?v=1d854959d9';
import { TooltipMixin } from './components/TooltipMixin.js?v=0adc6b8624';
import { MixedBreakdown } from './components/MixedBreakdown.js?v=c68ec99571';
import { MaxPanel } from './components/MaxPanel.js?v=c3b3df3f49';
import { ItemPopoverContent } from './components/ItemPopoverContent.js?v=2aae5044c2';
import { PriceBreakdownPopover } from './components/PriceBreakdownPopover.js?v=f863d8e5ba';
import { ItemSectionPanel } from './components/ItemSectionPanel.js?v=7f5750d445';
import { DataTablePopover } from './components/DataTablePopover.js?v=2678c8b5a6';
import { QuantityPopover } from './components/QuantityPopover.js?v=28b4c04010';
import { EngineeringPlannerPanel } from './components/EngineeringPlannerPanel.js?v=5f7460101a';
import { SpriteImage } from './components/SpriteImage.js?v=a6508ec846';
import { BonusSourceResolver } from './app/sourceResolver.js?v=d047857a37';
import { BonusDataLoader } from './app/dataLoader.js?v=061e04bf3b';
import { BonusUrlState, resolveSelectedClassId } from './app/urlState.js?v=137cc9b4f8';
import { BonusAppLifecycle } from './app/lifecycle.js?v=add148331d';
import { BonusSaveIntegration } from './app/saveIntegration.js?v=982c4e5999';
import { saveActionMethods } from './app/saveActions.js?v=f8327a9d0f';
import { resolveInitialViewMode, mountBonusesSection as mountBonusesSectionImpl } from './app/sectionMount.js?v=032d2c35d2';
import { viewStateComputed } from './app/viewState.js?v=d2ca480227';

const BONUSES_BASE_URL = new URL('./', import.meta.url);

/* ==========================================
   MAIN APP
========================================== */
function createBonusesApp({ sectionKind = 'bonuses', hostContainer = document.body, useShellChrome = false } = {}) {
return createApp({
    mixins: [TooltipMixin],
    components: { SourceRow, MaxPanel, EmptyState, ItemPopoverContent, MixedBreakdown, PriceBreakdownPopover, ItemSectionPanel, DataTablePopover, QuantityPopover, EngineeringPlannerPanel, SpriteImage },

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
            isDataReady: false,
            isDataLoading: false,
            dataLoadError: '',
            sectionKind,
            useShellChrome,
            hostContainer,
            bonusesBaseUrl: BONUSES_BASE_URL.href,
            viewMode: sectionKind === 'tools' ? 'calc' : 'bonus',
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
            bonusTypeSubfilters: {},
            conditionPanelOpen: true,
            activeConditions: new Set(),
            collapsedSections: new Set(),
            openDetails: new Set(),
            maxTab: 'avail',
            popoverEntry: null,
            popoverOpenDetails: new Set(),
            parameters: [],
            mobileTab: 'sources',
            mobileNavOpen: false,
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
                inputMode: 'items',
                anchorSlot: null,
                anchorSpeed: 0,
                anchorItemsPerHour: null,
                slotUpgradeLevel: 0
            },
            saveToolsVisible: false,
            saveContext: null,
            saveError: '',
            selectedSaveHeroIndex: null
        };
    },

    computed: viewStateComputed,

    watch: {
        dropdownOpen(val) {
            if (val) nextTick(() => this.$refs.bonusSearchInput?.focus());
        },
        itemTypeDropdownOpen(val) {
            if (val) this.dropdownOpen = false;
        }
    },

    created() {
        this._calcCache = {};
        this._sourceResolver = new BonusSourceResolver(this);
        this._dataLoader = new BonusDataLoader(this);
        this._urlState = new BonusUrlState(this);
        this._lifecycle = new BonusAppLifecycle(this);
        this._saveIntegration = new BonusSaveIntegration(this);
    },

    async mounted() {
        const initialSearch = window.location.search;
        this.saveToolsVisible = localStorage.getItem('evitania_bonuses_save_tools') === '1';
        const initialParams = new URLSearchParams(initialSearch);
        this.viewMode = resolveInitialViewMode(this.sectionKind, initialParams.get('v'));
        const loaded = await this.ensureDataLoaded();
        if (!loaded) return;
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
        ...saveActionMethods,
        async ensureDataLoaded() {
            if (this.isDataReady) return true;
            if (this._dataLoadPromise) {
                await this._dataLoadPromise;
                return this.isDataReady;
            }

            this.isDataLoading = true;
            this.dataLoadError = '';
            this._dataLoadPromise = (async () => {
                try {
                    await this._dataLoader.load();
                    this.isDataReady = true;
                    await this._restorePersistedSave();
                    this.selectedClass = resolveSelectedClassId(this.data?.classes, this.selectedClass);
                } catch (error) {
                    console.error(error);
                    this.dataLoadError = 'Could not load bonuses data';
                    this.hostContainer.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
                } finally {
                    this.isDataLoading = false;
                }
            })();

            await this._dataLoadPromise;
            return this.isDataReady;
        },
        _resolveRelativeAssetPath(baseFilePath, assetPath) {
            return this._sourceResolver.resolveRelativeAssetPath(baseFilePath, assetPath);
        },
        _resolveItemFileRefs(file, filePath) {
            return this._sourceResolver.resolveItemFileRefs(file, filePath);
        },
        _resolveItemSourceFileRefs(file) {
            return this._sourceResolver.resolveItemSourceFileRefs(file);
        },
        _resolveItemSources(item) {
            return this._sourceResolver.resolveItemSources(item);
        },
        itemSourceDisplayEntries(src) {
            return this._sourceResolver.itemSourceDisplayEntries(src);
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
}

export async function mountBonusesSection({ container, sectionKind = 'bonuses' } = {}) {
    return mountBonusesSectionImpl({
        container,
        sectionKind,
        createBonusesApp
    });
}
