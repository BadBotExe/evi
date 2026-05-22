import { createApp, nextTick } from 'vue';
import { bonusMethods } from './app/bonuses.js?v=586a589b7e';
import { displayMethods } from './app/display.js?v=c932d23a40';
import { itemBonusMethods } from './app/ItemBonus.js?v=506e748c90';
import { resourceBreakdownMethods } from './app/resourceBreakdown.js?v=0cdb99f6b3';
import { actionsMethods } from './app/actions.js?v=dfab0b1f65';
import { engineeringPlannerMethods } from './app/engineeringPlanner.js?v=243a1a26de';
import { formulaMethods } from './app/formula.js?v=4e475f5ba9';
import { petReferenceMethods } from './app/petReference.js?v=8b277dbb0c';
import { popoverMethods } from './app/popovers.js?v=e7be1771d3';
import { EmptyState } from './components/EmptyState.js?v=62cae79893';
import { SourceRow } from './components/SourceRow.js?v=1d854959d9';
import { TooltipMixin } from './components/TooltipMixin.js?v=0adc6b8624';
import { MixedBreakdown } from './components/MixedBreakdown.js?v=c68ec99571';
import { MaxPanel } from './components/MaxPanel.js?v=aedc07f6df';
import { ItemPopoverContent } from './components/ItemPopoverContent.js?v=2aae5044c2';
import { PriceBreakdownPopover } from './components/PriceBreakdownPopover.js?v=3ef83f8593';
import { ItemSectionPanel } from './components/ItemSectionPanel.js?v=7f5750d445';
import { DataTablePopover } from './components/DataTablePopover.js?v=2678c8b5a6';
import { QuantityPopover } from './components/QuantityPopover.js?v=28b4c04010';
import { EngineeringPlannerPanel } from './components/EngineeringPlannerPanel.js?v=a14e0311d5';
import { SpriteImage } from './components/SpriteImage.js?v=a6508ec846';
import { BonusSourceResolver } from './app/sourceResolver.js?v=8f38e9bab6';
import { BonusDataLoader } from './app/dataLoader.js?v=b10ffed44b';
import { BonusUrlState, resolveSelectedClassId } from './app/urlState.js?v=b1f58ba87f';
import { BonusAppLifecycle } from './app/lifecycle.js?v=bc12e63b4a';
import { BonusSaveIntegration } from './app/saveIntegration.js?v=982c4e5999';
import { saveActionMethods } from './app/saveActions.js?v=3234366357';
import { resolveInitialViewMode, mountBonusesSection as mountBonusesSectionImpl } from './app/sectionMount.js?v=032d2c35d2';
import { viewStateComputed } from './app/viewState.js?v=ec640d29bf';
import { runWithGlobalShellLoader } from '../shell/loading/shellLoader.js?v=55923b6437';

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
            resourceBreakdownModifierValues: {},
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
                throughputSpeeds: {},
                throughputItemsPerHour: {},
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
                    await runWithGlobalShellLoader(async () => {
                        await this._dataLoader.load();
                        this.isDataReady = true;
                        await this._restorePersistedSave();
                        this.selectedClass = resolveSelectedClassId(this.data?.classes, this.selectedClass);
                    });
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
