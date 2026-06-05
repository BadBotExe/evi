import { createApp, nextTick } from 'vue';
import { normalizeValue, formatCompactNumber, formatFixedNumber, makeDraggable } from '../bonuses/lib/utils.js?v=a60e1a39f6';
import { engineeringPlannerMethods } from './app/engineeringPlanner.js?v=08182a6ca9';
import { ToolsDataLoader } from './app/dataLoader.js?v=6027428edd';
import { resolveToolsRouteState, buildToolsRouteQuery } from './app/urlState.js?v=dfc763d231';
import { EngineeringPlannerPanel } from './components/EngineeringPlannerPanel.js?v=94a0973e9c';
import { SmithCalculatorPanel } from './components/SmithCalculatorPanel.js?v=63b6996742';
import {
    calculateSmelteryGemshopMultiplier,
    calculateSmelterySpeedFromMeasuredSeconds,
    normalizeSmelterySpeed,
    parseSmelteryMeasuredDuration
} from '../smith/app/smelteryModel.js?v=af4efceeda';
import {
    buildSelectedSmithDependencyRows,
    buildSmithRequirementPlan,
    buildSmithTimingRows,
    combineSmithRequirementPlans,
    createSmithOwnedState,
    preservePerItemTreeRows,
    preserveCombinedRequirementRows,
    replaceSelectedSmithRecipeRows,
    resolveSmelteryMulticraftMultiplier
} from './lib/smithCalculator.js?v=b031882d4f';
import { runWithGlobalShellLoader } from '../shell/loading/shellLoader.js?v=55923b6437';

const SMITH_CALCULATOR_STORAGE_KEY = 'evitania_tools_smith_calculator';

export function createToolsApp({
    hostContainer = document.body,
    useShellChrome = false,
    onRouteStateChange = null
} = {}) {
    return createApp({
        components: {
            EngineeringPlannerPanel,
            SmithCalculatorPanel
        },

        directives: {
            clickOutside: {
                mounted(el, binding) {
                    el._clickOutside = (event) => {
                        if (!el.contains(event.target)) binding.value(event);
                    };
                    document.addEventListener('click', el._clickOutside);
                },
                unmounted(el) {
                    document.removeEventListener('click', el._clickOutside);
                }
            }
        },

        data() {
            return {
                hostContainer,
                useShellChrome,
                data: null,
                isDataReady: false,
                isDataLoading: false,
                dataLoadError: '',
                selectedCalc: 'engineering-planner',
                calcDropdownOpen: false,
                isMobileViewport: false,
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
                smithCalculatorState: {
                    rows: [],
                    nextRowId: 1,
                    search: '',
                    pickerOpen: false,
                    breakdownMode: 'combined',
                    showCompletedCombinedRows: true,
                    showCompositeCombinedRows: true,
                    showCompletedPerItemRows: true,
                    collapsedItemRows: {},
                    collapsedTreeRows: {},
                    smelteryMulticraftLevel: 0,
                    smelteryGemshopLevel: 0,
                    smelterySpeedPercent: 0,
                    owned: {}
                },
                smithSmelteryCalculator: {
                    open: false,
                    itemId: '',
                    hours: '',
                    minutes: '',
                    seconds: '',
                    anchorId: '',
                    dragReady: false
                },
                smithValuePopover: {
                    open: false,
                    label: '',
                    value: ''
                }
            };
        },

        computed: {
            appRef() {
                return this;
            },
            activeCalc() {
                return this.selectedCalc ?? this.calcEntries[0]?.id ?? null;
            },
            calcEntries() {
                return [
                    { id: 'engineering-planner', key: 'e', label: 'Engineering Planner' },
                    { id: 'smith-calculator', key: 's', label: 'Smith Recipe Calculator' }
                ];
            },
            showEngineeringPlanner() {
                return this.activeCalc === 'engineering-planner' && !!this.data?.engineeringPlanner;
            },
            showSmithCalculator() {
                return this.activeCalc === 'smith-calculator' && !!this.data?.smith;
            }
        },

        created() {
            this._dataLoader = new ToolsDataLoader(this);
        },

        async mounted() {
            this.syncToolsViewport();
            if (typeof document !== 'undefined') {
                this._toolsSmelteryCalculatorClickHandler = (event) => {
                    if (!this.smithSmelteryCalculator.open || this.isMobileViewport) return;
                    const popover = document.getElementById('tools-smith-smeltery-calc-popover');
                    const toggle = this.smithSmelteryCalculator.anchorId
                        ? document.getElementById(this.smithSmelteryCalculator.anchorId)
                        : null;
                    if (popover?.contains(event.target) || toggle?.contains(event.target)) return;
                    this.closeSmithSmelteryCalculator();
                };
                this._toolsSmelteryCalculatorKeyHandler = (event) => {
                    if (event.key === 'Escape' && this.smithSmelteryCalculator.open) {
                        this.closeSmithSmelteryCalculator();
                    }
                };
                document.addEventListener('click', this._toolsSmelteryCalculatorClickHandler);
                document.addEventListener('keydown', this._toolsSmelteryCalculatorKeyHandler);
            }
            if (typeof window !== 'undefined') {
                this._toolsSmelteryCalculatorResizeHandler = () => {
                    this.syncToolsViewport();
                    if (!this.smithSmelteryCalculator.open || this.isMobileViewport) return;
                    requestAnimationFrame(() => this.positionSmithSmelteryCalculatorPopover());
                };
                window.addEventListener('resize', this._toolsSmelteryCalculatorResizeHandler);
            }
            const loaded = await this.ensureDataLoaded();
            if (!loaded) return;
            this.restoreSmithCalculatorState();
            this.applyRouteState(window.location.search);
            this.syncShellMobileActions?.();
        },

        beforeUnmount() {
            if (typeof document !== 'undefined') {
                if (this._toolsSmelteryCalculatorClickHandler) {
                    document.removeEventListener('click', this._toolsSmelteryCalculatorClickHandler);
                }
                if (this._toolsSmelteryCalculatorKeyHandler) {
                    document.removeEventListener('keydown', this._toolsSmelteryCalculatorKeyHandler);
                }
            }
            if (typeof window !== 'undefined' && this._toolsSmelteryCalculatorResizeHandler) {
                window.removeEventListener('resize', this._toolsSmelteryCalculatorResizeHandler);
            }
        },

        methods: {
            ...engineeringPlannerMethods,

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
                        });
                    } catch (error) {
                        console.error(error);
                        this.dataLoadError = 'Could not load tools data';
                        this.hostContainer.innerHTML = '<p style=\"color:#f88;padding:2rem;font-size:16px\">Could not load tools data</p>';
                    } finally {
                        this.isDataLoading = false;
                    }
                })();

                await this._dataLoadPromise;
                return this.isDataReady;
            },

            refreshView() {},

            syncToolsViewport() {
                if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
                    this.isMobileViewport = false;
                    return;
                }
                this.isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
                this.syncShellMobileActions?.();
            },

            syncShellMobileActions() {
                if (typeof document === 'undefined') return;
                const slot = document.getElementById('shell-mobile-inline-actions');
                if (!slot) return;

                slot.innerHTML = '';
                slot.classList.remove('tools-shell-inline-actions-visible');
                slot.classList.add('shell-hidden');

                const shouldShowHelp = this.isMobileViewport && this.activeCalc === 'engineering-planner';
                if (!shouldShowHelp) return;

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'mobile-settings-btn tools-shell-help-btn';
                button.setAttribute('aria-label', 'Open planner help');
                button.textContent = '?';
                button.addEventListener('click', () => {
                    document.querySelector('.engineering-planner-panel .engineering-planner-help-btn')?.click();
                });

                slot.appendChild(button);
                slot.classList.add('tools-shell-inline-actions-visible');
                slot.classList.remove('shell-hidden');
            },

            resolveValue(entry) {
                return Number(entry?.value ?? 0);
            },

            normalizeValue,

            typeColor(type) {
                return this.data?.types?.[type]?.tag_style?.color ?? '#d8b45a';
            },

            categoryLabel(id) {
                return this.data?.categories?.find(category => category.id === id)?.label ?? id;
            },

            formatSmithCalculatorQuantity(value) {
                return formatCompactNumber(Number(value ?? 0), { compactFrom: 1_000_000_000 });
            },

            formatSmithCalculatorDisplayQuantity(value) {
                const numericValue = Number(value ?? 0);
                if (!this.isMobileViewport) {
                    return this.formatSmithCalculatorExactQuantity(numericValue);
                }
                return formatCompactNumber(numericValue, {
                    compactFrom: 1000,
                    suffixes: ['k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no', 'dc']
                });
            },

            formatSmithCalculatorExactQuantity(value) {
                return formatFixedNumber(Number(value ?? 0), {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
            },

            smithCalculatorValueIsCompacted(value) {
                if (!this.isMobileViewport) return false;
                const numericValue = Number(value ?? 0);
                const displayValue = formatCompactNumber(numericValue, {
                    compactFrom: 1000,
                    suffixes: ['k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no', 'dc']
                });
                const exactValue = formatFixedNumber(numericValue, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                return displayValue !== exactValue;
            },

            openSmithCalculatorValuePopover(label, value) {
                if (!this.smithCalculatorValueIsCompacted(value)) return;
                this.smithValuePopover.label = label ?? 'Value';
                this.smithValuePopover.value = this.formatSmithCalculatorExactQuantity(value);
                this.smithValuePopover.open = true;
            },

            closeSmithCalculatorValuePopover() {
                this.smithValuePopover.open = false;
                this.smithValuePopover.label = '';
                this.smithValuePopover.value = '';
            },

            smithCalculatorSmelteryItems() {
                const tab = this.data?.smith?.tabs?.find(entry => entry.id === 'smeltery') ?? null;
                return (tab?.item_ids ?? [])
                    .map(itemId => this.data?.smith?.itemsById?.[itemId] ?? null)
                    .filter(Boolean);
            },

            isSmithCalculatorSmelteryItem(itemId) {
                return this.data?.smith?.smelteryItemIds?.has(itemId) ?? false;
            },

            resolveSmithSmelteryCalculatorItemId(itemId = '') {
                if (itemId && this.isSmithCalculatorSmelteryItem(itemId)) return itemId;
                const selectedSmelteryRow = this.smithCalculatorState.rows.find(row => this.isSmithCalculatorSmelteryItem(row.itemId));
                if (selectedSmelteryRow?.itemId) return selectedSmelteryRow.itemId;
                return this.smithCalculatorSmelteryItems()[0]?.id ?? '';
            },

            markSmithSmelteryCalculatorDragged(event) {
                if (event?.button !== 0 || typeof document === 'undefined') return;
                const popover = document.getElementById('tools-smith-smeltery-calc-popover');
                if (popover) popover.dataset.dragged = 'true';
            },

            ensureSmithSmelteryCalculatorDraggable() {
                if (this.smithSmelteryCalculator.dragReady || typeof document === 'undefined') return;
                const popover = document.getElementById('tools-smith-smeltery-calc-popover');
                if (!popover) return;
                makeDraggable(popover, popover.querySelector('.tools-smeltery-calc-popover-header'), null);
                this.smithSmelteryCalculator.dragReady = true;
            },

            positionSmithSmelteryCalculatorPopover() {
                if (this.isMobileViewport || typeof document === 'undefined' || typeof window === 'undefined') return;
                const popover = document.getElementById('tools-smith-smeltery-calc-popover');
                const button = this.smithSmelteryCalculator.anchorId
                    ? document.getElementById(this.smithSmelteryCalculator.anchorId)
                    : null;
                if (!popover || !button) return;
                if (popover.dataset.dragged === 'true') return;

                const margin = 12;
                const gap = 10;
                const buttonRect = button.getBoundingClientRect();
                const popoverRect = popover.getBoundingClientRect();
                const width = popoverRect.width || 320;
                const height = popoverRect.height || 220;
                const maxLeft = Math.max(margin, window.innerWidth - width - margin);
                const preferredLeft = buttonRect.right - width;
                const left = Math.max(margin, Math.min(maxLeft, preferredLeft));
                const fitsBelow = buttonRect.bottom + gap + height <= window.innerHeight - margin;
                const top = fitsBelow
                    ? buttonRect.bottom + gap
                    : Math.max(margin, buttonRect.top - height - gap);

                popover.style.left = `${left}px`;
                popover.style.top = `${top}px`;
            },

            openSmithSmelteryCalculator(anchorId = 'tools-smith-smeltery-calc-toggle') {
                this.smithSmelteryCalculator.itemId = this.resolveSmithSmelteryCalculatorItemId(this.smithSmelteryCalculator.itemId);
                this.smithSmelteryCalculator.anchorId = anchorId;
                this.smithSmelteryCalculator.open = true;
                nextTick(() => {
                    this.ensureSmithSmelteryCalculatorDraggable();
                    const popover = typeof document !== 'undefined'
                        ? document.getElementById('tools-smith-smeltery-calc-popover')
                        : null;
                    if (popover) popover.dataset.dragged = 'false';
                    if (!this.isMobileViewport) {
                        requestAnimationFrame(() => this.positionSmithSmelteryCalculatorPopover());
                    }
                });
            },

            closeSmithSmelteryCalculator() {
                this.smithSmelteryCalculator.open = false;
                this.smithSmelteryCalculator.anchorId = '';
            },

            applySmithSmelteryCalculator() {
                const recipe = this.data?.smith?.recipesByItemId?.[
                    this.resolveSmithSmelteryCalculatorItemId(this.smithSmelteryCalculator.itemId)
                ] ?? null;
                const gemshopMultiplier = calculateSmelteryGemshopMultiplier(
                    this.smithCalculatorState.smelteryGemshopLevel,
                    this.data?.smith?.smelteryGemshop
                );
                const measuredSeconds = parseSmelteryMeasuredDuration(
                    this.smithSmelteryCalculator.hours,
                    this.smithSmelteryCalculator.minutes,
                    this.smithSmelteryCalculator.seconds
                );
                const calculatedSpeed = calculateSmelterySpeedFromMeasuredSeconds(
                    recipe?.base_time,
                    measuredSeconds,
                    gemshopMultiplier
                );
                if (!Number.isFinite(calculatedSpeed)) return;
                this.setSmithCalculatorSmelterySpeed(normalizeSmelterySpeed(Number(calculatedSpeed.toFixed(3))));
                this.closeSmithSmelteryCalculator();
            },

            applyRouteState(search) {
                this.applyResolvedRouteState(resolveToolsRouteState(search), search);
            },

            applyResolvedRouteState(state, search = window.location.search) {
                const requestedCalc = state?.calc;
                if (requestedCalc) {
                    const matched = this.calcEntries.find(entry => entry.id === requestedCalc || entry.key === requestedCalc);
                    this.selectedCalc = matched?.id ?? this.calcEntries[0]?.id ?? null;
                } else {
                    this.selectedCalc = this.calcEntries[0]?.id ?? null;
                }

                this.engineeringPlannerState.mode = state?.engineeringMode ?? 'requirements';
                this.engineeringPlannerState.inputMode = state?.engineeringInputMode ?? 'items';
                this.engineeringPlannerState.anchorSlot = this.engineeringPlannerDefaultAnchorSlot();
                this.engineeringPlannerState.anchorSpeed = 0;
                this.engineeringPlannerState.anchorItemsPerHour = null;
                this.engineeringPlannerState.slotUpgradeLevel = this.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;
                for (const slot of this.engineeringPlannerConfig()?.slots ?? []) {
                    this.engineeringPlannerState.throughputSpeeds[slot.id] = 0;
                    this.engineeringPlannerState.throughputItemsPerHour[slot.id] = null;
                }

                if (state?.engineeringAnchor) {
                    const slot = this.engineeringPlannerSlotByKey(state.engineeringAnchor);
                    if (slot) this.engineeringPlannerState.anchorSlot = slot.id;
                }
                if (state?.engineeringAnchorSpeed != null) {
                    this.engineeringPlannerState.anchorSpeed = state.engineeringAnchorSpeed;
                }
                if (state?.engineeringAnchorItemsPerHour != null) {
                    this.engineeringPlannerState.anchorItemsPerHour = state.engineeringAnchorItemsPerHour;
                }
                if (state?.engineeringSlotUpgradeLevel != null) {
                    const maxLevel = this.engineeringPlannerSlotUpgrade()?.maxLevel ?? 0;
                    this.engineeringPlannerState.slotUpgradeLevel = Math.max(0, Math.min(state.engineeringSlotUpgradeLevel, maxLevel));
                }

                const params = new URLSearchParams(search);
                for (const slot of this.engineeringPlannerConfig()?.slots ?? []) {
                    const speedKey = this.engineeringPlannerSpeedParamKey(slot);
                    const itemsKey = this.engineeringPlannerItemsParamKey(slot);
                    if (speedKey) {
                        const speedValue = Number(params.get(speedKey));
                        this.engineeringPlannerState.throughputSpeeds[slot.id] = Number.isFinite(speedValue) ? speedValue : 0;
                    }
                    if (itemsKey) {
                        const itemValue = Number(params.get(itemsKey));
                        this.engineeringPlannerState.throughputItemsPerHour[slot.id] = Number.isFinite(itemValue) ? itemValue : null;
                    }
                }
                this.syncShellMobileActions?.();
            },

            syncUrl({ push = false } = {}) {
                const query = buildToolsRouteQuery(this).toString();
                const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
                onRouteStateChange?.(query ? `?${query}` : '');
                if (push) {
                    history.pushState(null, '', nextUrl);
                    return;
                }
                history.replaceState(null, '', nextUrl);
            },

            selectCalc(id) {
                this.selectedCalc = id;
                this.calcDropdownOpen = false;
                this.syncShellMobileActions?.();
                this.syncUrl({ push: true });
            },

            filteredSmithCalculatorItems() {
                const q = this.smithCalculatorState.search.trim().toLowerCase();
                const items = Object.values(this.data?.smith?.itemsById ?? {})
                    .filter(item => (this.data?.smith?.recipesByItemId?.[item.id]?.ingredients?.length ?? 0) > 0)
                    .sort((left, right) => left.name.localeCompare(right.name));
                if (!q) return items.slice(0, 100);
                return items.filter(item => item.name.toLowerCase().includes(q)).slice(0, 100);
            },

            smithCalculatorSelectedItemQuantity(itemId) {
                return this.smithCalculatorState.rows.reduce((total, row) => (
                    row.itemId === itemId ? total + Number(row.quantity ?? 0) : total
                ), 0);
            },

            smithCalculatorSelectedRows() {
                return this.smithCalculatorState.rows.map(row => ({
                    ...row,
                    item: this.data?.smith?.itemsById?.[row.itemId] ?? null,
                    hasRecipe: (this.data?.smith?.recipesByItemId?.[row.itemId]?.ingredients?.length ?? 0) > 0
                }));
            },

            setSmithCalculatorShowCompletedCombinedRows(value) {
                this.smithCalculatorState.showCompletedCombinedRows = value !== false;
                this.persistSmithCalculatorState();
            },

            setSmithCalculatorShowCompositeCombinedRows(value) {
                this.smithCalculatorState.showCompositeCombinedRows = value !== false;
                this.persistSmithCalculatorState();
            },

            setSmithCalculatorShowCompletedPerItemRows(value) {
                this.smithCalculatorState.showCompletedPerItemRows = value !== false;
                this.persistSmithCalculatorState();
            },

            addSmithCalculatorRow(itemId) {
                const existingRow = this.smithCalculatorState.rows.find(row => row.itemId === itemId);
                if (existingRow) {
                    this.smithCalculatorState.rows = this.smithCalculatorState.rows.map(row =>
                        row.id === existingRow.id
                            ? { ...row, quantity: row.quantity + 1 }
                            : row
                    );
                    this.persistSmithCalculatorState();
                    return;
                }
                const id = this.smithCalculatorState.nextRowId;
                this.smithCalculatorState.nextRowId += 1;
                this.smithCalculatorState.rows = this.smithCalculatorState.rows.concat([{
                    id,
                    itemId,
                    quantity: 1
                }]);
                this.persistSmithCalculatorState();
            },

            removeSmithCalculatorRow(rowId) {
                this.smithCalculatorState.rows = this.smithCalculatorState.rows.filter(row => row.id !== rowId);
                this.persistSmithCalculatorState();
            },

            moveSmithCalculatorRow(rowId, delta) {
                const rows = [...this.smithCalculatorState.rows];
                const index = rows.findIndex(row => row.id === rowId);
                if (index < 0) return;
                const nextIndex = Math.max(0, Math.min(rows.length - 1, index + delta));
                if (nextIndex === index) return;
                const [row] = rows.splice(index, 1);
                rows.splice(nextIndex, 0, row);
                this.smithCalculatorState.rows = rows;
                this.persistSmithCalculatorState();
            },

            updateSmithCalculatorRowQuantity(rowId, rawValue) {
                const quantity = Math.max(1, Math.floor(Number(rawValue) || 1));
                this.smithCalculatorState.rows = this.smithCalculatorState.rows.map(row =>
                    row.id === rowId ? { ...row, quantity } : row
                );
                this.persistSmithCalculatorState();
            },

            setSmithCalculatorOwnedAmount(itemId, rawValue) {
                const value = Number(rawValue);
                const nextOwned = { ...(this.smithCalculatorState.owned ?? {}) };
                nextOwned[itemId] = Number.isFinite(value) && value >= 0 ? value : 0;
                this.smithCalculatorState.owned = nextOwned;
                this.persistSmithCalculatorState();
            },

            setSmithCalculatorBreakdownMode(mode) {
                this.smithCalculatorState.breakdownMode = mode === 'per-item' || mode === 'timing' ? mode : 'combined';
                this.persistSmithCalculatorState();
            },

            toggleSmithCalculatorPerItemSection(rowId) {
                const next = { ...(this.smithCalculatorState.collapsedItemRows ?? {}) };
                next[rowId] = !next[rowId];
                this.smithCalculatorState.collapsedItemRows = next;
                this.persistSmithCalculatorState();
            },

            isSmithCalculatorPerItemSectionCollapsed(rowId) {
                return Boolean(this.smithCalculatorState.collapsedItemRows?.[rowId]);
            },

            toggleSmithCalculatorTreeRow(rowId, path) {
                if (!rowId || !path) return;
                const key = `${rowId}:${path}`;
                const next = { ...(this.smithCalculatorState.collapsedTreeRows ?? {}) };
                next[key] = !next[key];
                this.smithCalculatorState.collapsedTreeRows = next;
                this.persistSmithCalculatorState();
            },

            isSmithCalculatorTreeRowCollapsed(rowId, path) {
                if (!rowId || !path) return false;
                return Boolean(this.smithCalculatorState.collapsedTreeRows?.[`${rowId}:${path}`]);
            },

            setSmithCalculatorSmelterySpeed(rawValue) {
                const value = Number(rawValue);
                this.smithCalculatorState.smelterySpeedPercent = Number.isFinite(value) ? value : 0;
                this.persistSmithCalculatorState();
            },

            smithCalculatorMulticraftOptions() {
                const config = this.data?.smith?.smelteryMulticraft ?? {};
                const maxLevel = Number(config.maxLevel ?? 0);
                return Array.from({ length: maxLevel + 1 }, (_, level) => ({
                    value: level,
                    label: level === 0 ? 'Off' : `Tier ${level}`
                }));
            },

            smithCalculatorGemshopOptions() {
                const config = this.data?.smith?.smelteryGemshop ?? {};
                const maxLevel = Number(config.maxLevel ?? 0);
                return Array.from({ length: maxLevel + 1 }, (_, level) => ({
                    value: level,
                    label: level === 0 ? 'Off' : `Tier ${level}`
                }));
            },

            buildSmithCalculatorPlans(useOwned = true) {
                const smithData = this.data?.smith;
                if (!smithData) return [];
                const multicraftMultiplier = resolveSmelteryMulticraftMultiplier(
                    this.smithCalculatorState.smelteryMulticraftLevel,
                    smithData.smelteryMulticraft
                );
                const ownedState = useOwned ? createSmithOwnedState(this.smithCalculatorState.owned) : null;
                return this.smithCalculatorState.rows.map(row => ({
                    row,
                    plan: buildSmithRequirementPlan({
                        itemId: row.itemId,
                        quantity: row.quantity,
                        recipesByItemId: smithData.recipesByItemId,
                        itemsById: smithData.itemsById,
                        smelteryItemIds: smithData.smelteryItemIds,
                        smelteryMulticraftMultiplier: multicraftMultiplier,
                        ownedState
                    })
                }));
            },

            smithCalculatorCombinedRows() {
                const planEntries = this.buildSmithCalculatorPlans(true);
                const basePlanEntries = this.buildSmithCalculatorPlans(false);
                const selectedItemIds = basePlanEntries.map(entry => entry?.plan?.itemId);
                return replaceSelectedSmithRecipeRows(
                    preserveCombinedRequirementRows(
                        combineSmithRequirementPlans(basePlanEntries.map(entry => entry.plan)),
                        combineSmithRequirementPlans(planEntries.map(entry => entry.plan))
                    ),
                    selectedItemIds,
                    preserveCombinedRequirementRows(
                        buildSelectedSmithDependencyRows(basePlanEntries.map(entry => entry.plan)),
                        buildSelectedSmithDependencyRows(planEntries.map(entry => entry.plan))
                    )
                );
            },

            smithCalculatorCombinedTimingRows() {
                return buildSmithTimingRows(this.smithCalculatorCombinedRows(), {
                    smelterySpeedPercent: this.smithCalculatorState.smelterySpeedPercent,
                    smelteryGemshopLevel: this.smithCalculatorState.smelteryGemshopLevel,
                    smelteryGemshopConfig: this.data?.smith?.smelteryGemshop
                });
            },

            smithCalculatorPerItemSections() {
                const effectivePlanEntries = this.buildSmithCalculatorPlans(true);
                const basePlanEntries = this.buildSmithCalculatorPlans(false);
                return effectivePlanEntries.map((entry, index) => {
                    const baseEntry = basePlanEntries[index];
                    const treeRows = preservePerItemTreeRows(
                        baseEntry?.plan?.treeRows ?? [],
                        entry.plan.treeRows
                    );
                    const parentPathByPath = new Map(treeRows.map(row => [row.path, row.parentPath ?? null]));
                    const visibleRows = [];

                    for (const resource of treeRows) {
                        let isHidden = false;
                        let ancestorPath = resource.parentPath;
                        while (ancestorPath) {
                            if (this.isSmithCalculatorTreeRowCollapsed(entry.row.id, ancestorPath)) {
                                isHidden = true;
                                break;
                            }
                            ancestorPath = parentPathByPath.get(ancestorPath) ?? null;
                        }
                        if (isHidden) continue;
                        visibleRows.push({
                            ...resource,
                            isCollapsed: resource.hasChildren
                                ? this.isSmithCalculatorTreeRowCollapsed(entry.row.id, resource.path)
                                : false
                        });
                    }

                    return {
                        row: {
                            ...entry.row,
                            item: this.data?.smith?.itemsById?.[entry.row.itemId] ?? null
                        },
                        rows: visibleRows
                    };
                });
            },

            persistSmithCalculatorState() {
                try {
                    localStorage.setItem(SMITH_CALCULATOR_STORAGE_KEY, JSON.stringify({
                        rows: this.smithCalculatorState.rows,
                        nextRowId: this.smithCalculatorState.nextRowId,
                        breakdownMode: this.smithCalculatorState.breakdownMode,
                        showCompletedCombinedRows: this.smithCalculatorState.showCompletedCombinedRows,
                        showCompositeCombinedRows: this.smithCalculatorState.showCompositeCombinedRows,
                        showCompletedPerItemRows: this.smithCalculatorState.showCompletedPerItemRows,
                        collapsedItemRows: this.smithCalculatorState.collapsedItemRows,
                        collapsedTreeRows: this.smithCalculatorState.collapsedTreeRows,
                        smelteryMulticraftLevel: this.smithCalculatorState.smelteryMulticraftLevel,
                        smelteryGemshopLevel: this.smithCalculatorState.smelteryGemshopLevel,
                        smelterySpeedPercent: this.smithCalculatorState.smelterySpeedPercent,
                        owned: this.smithCalculatorState.owned
                    }));
                } catch (error) {
                    console.error(error);
                }
            },

            restoreSmithCalculatorState() {
                try {
                    const raw = localStorage.getItem(SMITH_CALCULATOR_STORAGE_KEY);
                    if (!raw) return;
                    const stored = JSON.parse(raw);
                    this.smithCalculatorState.rows = Array.isArray(stored?.rows) ? stored.rows : [];
                    this.smithCalculatorState.nextRowId = Number.isFinite(Number(stored?.nextRowId)) ? Number(stored.nextRowId) : 1;
                    this.smithCalculatorState.breakdownMode = stored?.breakdownMode === 'per-item' || stored?.breakdownMode === 'timing'
                        ? stored.breakdownMode
                        : 'combined';
                    this.smithCalculatorState.showCompletedCombinedRows = stored?.showCompletedCombinedRows !== false;
                    this.smithCalculatorState.showCompositeCombinedRows = stored?.showCompositeCombinedRows !== false;
                    this.smithCalculatorState.showCompletedPerItemRows = stored?.showCompletedPerItemRows !== false;
                    this.smithCalculatorState.collapsedItemRows = stored?.collapsedItemRows && typeof stored.collapsedItemRows === 'object'
                        ? stored.collapsedItemRows
                        : {};
                    this.smithCalculatorState.collapsedTreeRows = stored?.collapsedTreeRows && typeof stored.collapsedTreeRows === 'object'
                        ? stored.collapsedTreeRows
                        : {};
                    this.smithCalculatorState.smelteryMulticraftLevel = Number(stored?.smelteryMulticraftLevel ?? 0) || 0;
                    this.smithCalculatorState.smelteryGemshopLevel = Number(stored?.smelteryGemshopLevel ?? 0) || 0;
                    this.smithCalculatorState.smelterySpeedPercent = Number(stored?.smelterySpeedPercent ?? 0) || 0;
                    this.smithCalculatorState.owned = stored?.owned && typeof stored.owned === 'object' ? stored.owned : {};
                } catch (error) {
                    console.error(error);
                }
            }
        }
    });
}

export function mountToolsApp(options = {}) {
    return createToolsApp(options);
}
