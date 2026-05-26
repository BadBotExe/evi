import { makeDraggable } from '../../bonuses/lib/utils.js?v=a60e1a39f6';

export const EngineeringPlannerPanel = {
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
        this._engineeringHelpOutsidePointerDown = (event) => {
            if (!this.helpOpen || this.isMobileViewport()) return;
            const popover = this.$refs.helpPopover;
            const button = this.$refs.helpButton;
            if (popover?.contains(event.target) || button?.contains(event.target)) return;
            this.closeHelp();
        };
        window.addEventListener('keydown', this._engineeringHelpKeydown);
        window.addEventListener('pointerdown', this._engineeringHelpOutsidePointerDown);
    },
    beforeUnmount() {
        if (this._engineeringHelpKeydown) {
            window.removeEventListener('keydown', this._engineeringHelpKeydown);
        }
        if (this._engineeringHelpOutsidePointerDown) {
            window.removeEventListener('pointerdown', this._engineeringHelpOutsidePointerDown);
        }
    },
    computed: {
        planner() { return this.app.engineeringPlannerState; },
        rows() { return this.app.engineeringPlannerRows(); },
        slots() { return this.app.engineeringPlannerSlots(); },
        config() { return this.app.engineeringPlannerConfig(); },
        slotUpgrade() { return this.app.engineeringPlannerSlotUpgrade(); },
        plannerMode() { return this.app.engineeringPlannerMode(); },
        plannerInputMode() { return this.app.engineeringPlannerInputMode(); },
        isThroughputMode() { return this.plannerMode !== 'requirements'; },
        isGameThroughputMode() { return this.plannerMode === 'throughput_game'; },
        isCalculatorThroughputMode() { return this.plannerMode === 'throughput_calc'; },
        isItemsInputMode() { return this.plannerInputMode === 'items'; },
        isCollapsed() { return this.app.engineeringPlannerCollapsed; },
        activeMobileRow() {
            return this.rows.find(row => row.id === this.activeMobileRowId) ?? null;
        },
        helpNotes() {
            const itemsPerHourLabel = this.isItemsInputMode ? 'items per hour' : 'speed';
            const ratioNote = `Stable dependency ratio: ${this.ratioText}.`;
            if (!this.isThroughputMode) {
                return [
                    ratioNote,
                    `Select the slot you want to produce, enter its current ${itemsPerHourLabel}, and the planner works backward through its dependencies only. Downstream products are ignored. Required speeds are calculated with Reduced Time = Base Time / (1 + Speed%).`
                ];
            }
            if (this.isCalculatorThroughputMode) {
                return [
                    ratioNote,
                    `Select the last slot you care about, then enter the current ${itemsPerHourLabel} of all engineering slots to see real steady-state pipeline output, starvation loss, and which upstream resources are limiting that selected chain. This view assumes a continuously running pipeline after startup, not the initial fill or first-fire timing.`
                ];
            }
            return [
                ratioNote,
                `Select the last slot you care about, then enter the current ${itemsPerHourLabel} of all engineering slots to mirror the in-game gross and net chain values for that selected anchor.`
            ];
        },
        helpRows() {
            if (this.isThroughputMode) {
                return [
                    { field: 'Mode', description: 'Switch between requirements, the in-game throughput mirror, and the steady-state calculator.' },
                    { field: 'Anchor Slot', description: 'The last active slot in the current production chain. Slots after it are ignored.' },
                    { field: this.isItemsInputMode ? 'Slot Items / hr' : 'Slot Speed %', description: this.isItemsInputMode ? 'Enter the gross items-per-hour shown by the game for each engineering slot. The planner converts those values into internal speed bonuses automatically.' : 'Enter the current speed bonus for each engineering slot. These values drive the hourly production rates shown below.' },
                    { field: this.slotUpgrade?.name ?? 'Slot Upgrade', description: 'This still adjusts the base time of the earliest slots in the chain before speed is applied.' },
                    { field: 'Base Time', description: 'Craft time after the selected slot-upgrade tier is applied, before the entered speed bonus.' },
                    { field: this.isItemsInputMode ? 'Gross Output' : 'Current Speed', description: this.isItemsInputMode ? 'The raw per-hour production you entered for this slot before downstream demand is considered.' : 'The current production speed bonus used to derive this slot output.' },
                    { field: 'Actual Output', description: this.isCalculatorThroughputMode ? 'How many outputs per hour this slot can sustain inside the steady-state pipeline after upstream shortages are applied.' : 'How many outputs per hour the game effectively gives this slot in the selected chain view.' },
                    { field: 'Spent / hr', description: 'How many outputs per hour active downstream slots actually consume from this slot.' },
                    { field: 'Net / hr', description: 'Actual Output minus Spent / hr. This is the current surplus left at this slot.' },
                    { field: 'Loss Output', description: this.isCalculatorThroughputMode ? 'How many items per hour this slot loses versus its entered gross output because upstream inputs cannot sustain the steady-state chain.' : 'How many items per hour this slot is short by once downstream demand is applied inside the selected chain.' },
                    { field: 'Future Chain Demand', description: 'How much output this slot would need after the other current bottlenecks are removed and the entire downstream chain can run at its entered gross targets.' },
                    { field: 'Immediate Increase', description: this.isItemsInputMode ? 'The useful increase you can make right now before another bottleneck becomes the limiter.' : 'The useful speed increase you can make right now before another bottleneck becomes the limiter.' }
                ];
            }
            return [
                { field: 'Anchor Slot', description: 'The slot you care about. The planner works backward from this slot and calculates only the slots required to feed it.' },
                { field: this.isItemsInputMode ? 'Anchor Items / hr' : 'Anchor Speed %', description: this.isItemsInputMode ? 'Enter the anchor slot output shown by the game in items per hour. The planner converts it into the equivalent speed bonus and uses that as the dependency target.' : 'Your current production speed bonus for the selected slot. This is the reference point used to calculate the required speeds for its dependencies.' },
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
        setMode(mode) {
            this.planner.mode = mode;
            this.app.syncUrl();
        },
        setInputMode(mode) {
            this.planner.inputMode = mode;
            this.app.syncUrl();
        },
        setAnchor(slotId) {
            this.planner.anchorSlot = slotId;
            this.app.syncUrl();
        },
        syncPlannerState() {
            this.app.syncUrl();
        },
        parsePlannerNumber(rawValue) {
            if (rawValue == null) return null;
            if (typeof rawValue === 'string' && rawValue.trim() === '') return null;
            const value = Number(rawValue);
            return Number.isFinite(value) ? value : null;
        },
        anchorSlotConfig() {
            return this.rows.find(slot => slot.id === this.planner.anchorSlot) ?? null;
        },
        resolvedSlotConfig(slotId) {
            return this.app.engineeringPlannerResolvedSlots().find(slot => slot.id === slotId) ?? null;
        },
        displayedAnchorProduction() {
            return this.isItemsInputMode
                ? (this.planner.anchorItemsPerHour ?? '')
                : this.planner.anchorSpeed;
        },
        updateAnchorProduction(rawValue) {
            const value = this.parsePlannerNumber(rawValue);
            if (this.isItemsInputMode) {
                this.planner.anchorItemsPerHour = value;
            } else {
                this.planner.anchorSpeed = value;
            }
            this.syncPlannerState();
        },
        displayedThroughputProduction(slot) {
            return this.isItemsInputMode
                ? (this.planner.throughputItemsPerHour?.[slot.id] ?? '')
                : (this.planner.throughputSpeeds?.[slot.id] ?? 0);
        },
        updateThroughputProduction(slot, rawValue) {
            const value = this.parsePlannerNumber(rawValue);
            if (this.isItemsInputMode) {
                this.planner.throughputItemsPerHour[slot.id] = value;
            } else {
                this.planner.throughputSpeeds[slot.id] = value;
            }
            this.syncPlannerState();
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

            const margin = 16;
            const gap = 10;
            const rect = button.getBoundingClientRect();
            const width = Math.min(853, window.innerWidth - (margin * 2));
            popover.style.width = `${width}px`;
            popover.style.maxWidth = `${width}px`;
            popover.style.right = 'auto';

            const height = popover.offsetHeight;
            const preferredLeft = rect.right - width;
            const preferredTop = rect.bottom + gap;
            const fallbackTop = rect.top - height - gap;
            const maxLeft = Math.max(margin, window.innerWidth - width - margin);
            const maxTop = Math.max(margin, window.innerHeight - height - margin);
            const left = Math.max(margin, Math.min(maxLeft, preferredLeft));
            const top = preferredTop + height <= window.innerHeight - margin
                ? preferredTop
                : Math.max(margin, Math.min(maxTop, fallbackTop));

            popover.style.left = `${left}px`;
            popover.style.top = `${top}px`;

            if (!this.helpPopoverDragReady) {
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
        roundUp(value, digits = 0) {
            if (!Number.isFinite(value)) return value;
            const factor = 10 ** digits;
            return Math.ceil(value * factor) / factor;
        },
        formatPercent(value, digits = 0) {
            if (!Number.isFinite(value)) return '--';
            const rounded = this.roundUp(value, digits);
            return `${rounded.toLocaleString()}%`;
        },
        formatSeconds(value) {
            if (!Number.isFinite(value)) return '--';
            if (value >= 86400) {
                const totalSeconds = Math.round(value);
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${days}d ${hours}h ${minutes}m ${seconds}s`;
            }
            if (value >= 100) return `${value.toFixed(1)}s`;
            if (value >= 10) return `${value.toFixed(2)}s`;
            return `${value.toFixed(3)}s`;
        },
        formatRatePerHour(value) {
            if (!Number.isFinite(value)) return '--';
            const digits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
            return `${Number(value.toFixed(digits)).toLocaleString()}/hr`;
        },
        roundedRatePerHourValue(value) {
            if (!Number.isFinite(value)) return null;
            const digits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
            return Number(value.toFixed(digits));
        },
        formatSignedRatePerHour(value) {
            if (!Number.isFinite(value)) return '--';
            const rounded = Number(value.toFixed(value >= 1000 ? 0 : value >= 100 ? 1 : 2));
            const sign = rounded > 0 ? '+' : '';
            return `${sign}${rounded.toLocaleString()}/hr`;
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
        },
        throughputIncreaseLabel(row) {
            if (row.inDependencyChain === false) return 'N/A';
            if (this.isItemsInputMode) {
                if (!row.blocking) return '0/hr';
                return `+${this.formatRatePerHour(row.uiRequiredRateIncreasePerHour)}`;
            }
            if (!row.blocking) return '0%';
            return `+${this.formatPercent(row.uiRequiredSpeedIncrease)}`;
        },
        throughputFootLabel(row) {
            if (row.inDependencyChain === false) return 'Outside slot selection.';
            if (!Number.isFinite(row.currentCapacityRatePerHour)) return this.isItemsInputMode ? 'Enter a valid items/hr value.' : 'Enter a valid speed above -100%.';
            if (row.blocking && row.starved) {
                if (!row.starvationSources?.length) {
                    const blocked = row.blockingConsumers?.length ? row.blockingConsumers.join(', ') : 'downstream slots';
                    return this.isItemsInputMode
                        ? `Short on downstream demand. Increase this slot by ${this.formatRatePerHour(row.uiRequiredRateIncreasePerHour)} to reach ${this.formatRatePerHour(row.targetRatePerHour)}. Blocking ${blocked}.`
                        : `Short on downstream demand. Increase this slot by ${this.formatPercent(row.uiRequiredSpeedIncrease)} to reach ${this.formatPercent(row.requiredSpeed)}. Blocking ${blocked}.`;
                }
                const sources = row.starvationSources.join(', ');
                const blocked = row.blockingConsumers?.length ? row.blockingConsumers.join(', ') : 'downstream slots';
                return this.isItemsInputMode
                    ? `Short on ${sources} at the current chain split. Increase this slot by ${this.formatRatePerHour(row.uiRequiredRateIncreasePerHour)} to reach ${this.formatRatePerHour(row.targetRatePerHour)}. Blocking ${blocked}.`
                    : `Short on ${sources} at the current chain split. Increase this slot by ${this.formatPercent(row.uiRequiredSpeedIncrease)} to reach ${this.formatPercent(row.requiredSpeed)}. Blocking ${blocked}.`;
            }
            if (row.blocking && row.shortageDrivenBlocking) {
                const blocked = row.blockingConsumers?.length ? row.blockingConsumers.join(', ') : 'downstream slots';
                return this.isItemsInputMode
                    ? `Short on downstream demand. Increase this slot by ${this.formatRatePerHour(row.uiRequiredRateIncreasePerHour)} to reach ${this.formatRatePerHour(row.targetRatePerHour)}. Blocking ${blocked}.`
                    : `Short on downstream demand. Increase this slot by ${this.formatPercent(row.uiRequiredSpeedIncrease)} to reach ${this.formatPercent(row.requiredSpeed)}. Blocking ${blocked}.`;
            }
            if (row.blocking) {
                const blocked = row.blockingConsumers?.length ? row.blockingConsumers.join(', ') : 'downstream slots';
                return this.isItemsInputMode
                    ? `Blocking ${blocked}. Useful right now: increase this slot by ${this.formatRatePerHour(row.uiRequiredRateIncreasePerHour)} to reach ${this.formatRatePerHour(row.targetRatePerHour)} actual output. ${this.formatRatePerHour(row.fullTargetRatePerHour)} is only future chain demand after the other blockers are fixed.`
                    : `Blocking ${blocked}. Useful right now: increase this slot by ${this.formatPercent(row.uiRequiredSpeedIncrease)} to reach ${this.formatPercent(row.requiredSpeed)}. ${this.formatPercent(row.fullRequiredSpeed)} is only future chain demand after the other blockers are fixed.`;
            }
            if (row.starved) {
                const sources = row.starvationSources?.length ? row.starvationSources.join(', ') : 'upstream inputs';
                const contenders = row.starvationContenders?.length ? ` Contended by ${row.starvationContenders.join(', ')}.` : '';
                return `Short on ${sources} at the current chain split. Losing ${this.formatRatePerHour(row.uiLossOutputRatePerHour)} of output.${contenders}`;
            }
            if (Number.isFinite(row.spendRatePerHour) && row.spendRatePerHour > 0) {
                const actualOutput = Number(row.actualOutputRatePerHour) || 0;
                const consumers = row.consumerLabels?.length ? row.consumerLabels.join(', ') : 'downstream slots';
                const unusedOutput = Math.max(0, actualOutput - row.spendRatePerHour);
                if (unusedOutput > 1e-9) {
                    return `${consumers} consume ${this.formatRatePerHour(row.spendRatePerHour)}. Actual output is ${this.formatRatePerHour(actualOutput)}, so ${this.formatRatePerHour(unusedOutput)} is currently surplus.`;
                }
                return `${consumers} consume ${this.formatRatePerHour(row.spendRatePerHour)} from this slot.`;
            }
            if (Number.isFinite(row.actualOutputRatePerHour) && row.actualOutputRatePerHour > 0) {
                return `No active downstream consumers. All ${this.formatRatePerHour(row.actualOutputRatePerHour)} is currently surplus at this anchor.`;
            }
            return '';
        },
        summaryChipValue(row) {
            return this.isThroughputMode
                ? (row.inDependencyChain === false ? 'N/A' : this.formatSignedRatePerHour(row.netRatePerHour))
                : this.targetSpeedLabel(row);
        },
        summaryChipClasses(row) {
            const showBlocking = this.isThroughputMode && row.blocking;
            return {
                'engineering-summary-chip-anchor': row.id === this.planner.anchorSlot,
                'engineering-summary-chip-muted': this.isAboveAnchor(row),
                'engineering-summary-chip-overcap': this.isThroughputMode ? row.blocking : row.feasible === false,
                'engineering-summary-chip-starved': this.isThroughputMode && row.starved && !showBlocking
            };
        },
        cardClasses(row) {
            const showBlocking = this.isThroughputMode && row.blocking;
            return {
                'engineering-card-anchor': row.id === this.planner.anchorSlot,
                'engineering-card-muted': this.isAboveAnchor(row),
                'engineering-card-blocking': this.isThroughputMode ? showBlocking : row.feasible === false,
                'engineering-card-starved': this.isThroughputMode && row.starved && !showBlocking
            };
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
                <div class="engineering-planner-sticky-tools">
                    <div class="engineering-mode-switch" role="tablist" aria-label="Engineering planner mode">
                        <button type="button"
                                class="engineering-mode-btn"
                                :class="{ active: !isThroughputMode }"
                                @click="setMode('requirements')">Requirements</button>
                        <button type="button"
                                class="engineering-mode-btn"
                                :class="{ active: isGameThroughputMode }"
                                @click="setMode('throughput_game')">In-Game</button>
                        <button type="button"
                                class="engineering-mode-btn"
                                :class="{ active: isCalculatorThroughputMode }"
                                @click="setMode('throughput_calc')">Throughput</button>
                    </div>
                    <div class="engineering-mode-switch" role="tablist" aria-label="Engineering planner input mode">
                        <button type="button"
                                class="engineering-mode-btn"
                                :class="{ active: isItemsInputMode }"
                                @click="setInputMode('items')">Items / hr</button>
                        <button type="button"
                                class="engineering-mode-btn"
                                :class="{ active: !isItemsInputMode }"
                                @click="setInputMode('percent')">Percent</button>
                    </div>

                    <div class="engineering-planner-controls">
                        <template v-if="!isThroughputMode">
                            <label class="engineering-field engineering-field-select">
                                <span class="engineering-field-label">Anchor Slot</span>
                                <span class="engineering-field-control">
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" v-model="planner.anchorSlot" @change="syncPlannerState">
                                        <option v-for="slot in slots" :key="slot.id" :value="slot.id">{{ slot.label }}</option>
                                    </select>
                                </span>
                            </label>
                            <label v-if="slotUpgrade" class="engineering-field engineering-field-select">
                                <span class="engineering-field-label">{{ slotUpgrade.name }}</span>
                                <span class="engineering-field-control">
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" v-model.number="planner.slotUpgradeLevel" @change="syncPlannerState">
                                        <option :value="0">Off</option>
                                        <option v-for="tier in slotUpgrade.maxLevel" :key="tier" :value="tier">Tier {{ tier }}</option>
                                    </select>
                                </span>
                            </label>
                            <label class="engineering-field">
                                <span class="engineering-field-label">{{ isItemsInputMode ? 'Anchor Items / hr' : 'Anchor Speed %' }}</span>
                                <span class="engineering-field-control">
                                    <input class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                           type="number"
                                           step="1"
                                           :value="displayedAnchorProduction()"
                                           @input="updateAnchorProduction($event.target.value)"
                                           @change="updateAnchorProduction($event.target.value)">
                                </span>
                            </label>
                        </template>
                        <template v-else>
                            <label class="engineering-field engineering-field-select">
                                <span class="engineering-field-label">Anchor Slot</span>
                                <span class="engineering-field-control">
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" v-model="planner.anchorSlot" @change="syncPlannerState">
                                        <option v-for="slot in slots" :key="slot.id + '-throughput-anchor'" :value="slot.id">{{ slot.label }}</option>
                                    </select>
                                </span>
                            </label>
                            <label v-if="slotUpgrade" class="engineering-field engineering-field-select">
                                <span class="engineering-field-label">{{ slotUpgrade.name }}</span>
                                <span class="engineering-field-control">
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" v-model.number="planner.slotUpgradeLevel" @change="syncPlannerState">
                                        <option :value="0">Off</option>
                                        <option v-for="tier in slotUpgrade.maxLevel" :key="tier" :value="tier">Tier {{ tier }}</option>
                                    </select>
                                </span>
                            </label>
                            <label v-for="slot in slots" :key="slot.id + '-speed'" class="engineering-field">
                                <span class="engineering-field-label">{{ slot.label }} {{ isItemsInputMode ? '/ hr' : '%' }}</span>
                                <span class="engineering-field-control">
                                    <input class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                           type="number"
                                           step="1"
                                           :value="displayedThroughputProduction(slot)"
                                           @input="updateThroughputProduction(slot, $event.target.value)"
                                           @change="updateThroughputProduction(slot, $event.target.value)">
                                </span>
                            </label>
                        </template>
                    </div>

                    <div class="engineering-planner-summary" aria-label="Planner summary">
                        <button v-for="row in rows"
                             :key="row.id + '-summary'"
                             type="button"
                             class="engineering-summary-chip"
                             :class="summaryChipClasses(row)"
                             @click="onSummaryChipClick(row)">
                            <span class="engineering-summary-chip-label">{{ row.label }}</span>
                            <strong class="engineering-summary-chip-value">{{ summaryChipValue(row) }}</strong>
                        </button>
                    </div>
                </div>

                <div class="engineering-card-grid">
                    <article v-for="row in rows"
                             :key="row.id"
                             class="engineering-card"
                             :class="cardClasses(row)">
                        <div class="engineering-card-head">
                            <div class="engineering-card-copy">
                                <div class="engineering-card-title">{{ row.label }}</div>
                                <div class="engineering-card-recipe">{{ row.recipe }}</div>
                            </div>
                            <button
                                    type="button"
                                    class="engineering-card-badge"
                                    @click.stop="setAnchor(row.id)">{{ row.id === planner.anchorSlot ? 'Anchor' : 'Target' }}</button>
                        </div>

                        <div v-if="!isThroughputMode" class="engineering-stats">
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
                        <div v-else class="engineering-stats">
                            <div class="engineering-stat">
                                <span>Base Time</span>
                                <strong>{{ formatSeconds(row.effectiveBaseTime) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>{{ isItemsInputMode ? 'Gross Output' : 'Current Speed' }}</span>
                                <strong>{{ isItemsInputMode ? formatRatePerHour(row.grossOutputRatePerHour) : formatPercent(row.currentSpeed) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Recipe</span>
                                <strong>{{ row.recipe }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Actual Output</span>
                                <strong>{{ formatRatePerHour(row.actualOutputRatePerHour) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Spent / hr</span>
                                <strong>{{ formatRatePerHour(row.spendRatePerHour) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Net / hr</span>
                                <strong>{{ formatSignedRatePerHour(row.netRatePerHour) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Loss Output</span>
                                <strong>{{ formatRatePerHour(row.lossOutputRatePerHour) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Future Chain Demand</span>
                                <strong>{{ isItemsInputMode ? formatRatePerHour(row.fullTargetRatePerHour) : formatPercent(row.fullRequiredSpeed) }}</strong>
                            </div>
                            <div class="engineering-stat">
                                <span>Immediate Increase</span>
                                <strong>{{ throughputIncreaseLabel(row) }}</strong>
                            </div>
                        </div>

                        <div class="engineering-card-foot">
                            {{ isThroughputMode ? throughputFootLabel(row) : capLabel(row) }}
                        </div>
                    </article>
                </div>

            </div>
            <div v-if="helpOpen && !isMobileViewport()"
                 ref="helpPopover"
                 class="engineering-planner-help-popover popover floating-panel"
                 @click.stop>
                <div class="popover-header engineering-planner-help-header">
                    <span>Planner Help</span>
                    <button type="button" class="popover-close" @click="closeHelp">&times;</button>
                </div>
                <div class="engineering-planner-help-body">
                    <div class="engineering-planner-help-copy">
                        <p v-for="(note, index) in helpNotes" :key="'desktop-note-' + index">{{ note }}</p>
                    </div>
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
                                    </div>
                                </div>
                                <div class="engineering-mobile-sheet-body">
                                    <div class="engineering-planner-help-copy">
                                        <p v-for="(note, index) in helpNotes" :key="'mobile-note-' + index">{{ note }}</p>
                                    </div>
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
                                    <div v-if="!isThroughputMode" class="engineering-stats">
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
                                    <div v-else class="engineering-stats">
                                        <div class="engineering-stat">
                                            <span>Base Time</span>
                                            <strong>{{ formatSeconds(activeMobileRow.effectiveBaseTime) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>{{ isItemsInputMode ? 'Gross Output' : 'Current Speed' }}</span>
                                            <strong>{{ isItemsInputMode ? formatRatePerHour(activeMobileRow.grossOutputRatePerHour) : formatPercent(activeMobileRow.currentSpeed) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Recipe</span>
                                            <strong>{{ activeMobileRow.recipe }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Actual Output</span>
                                            <strong>{{ formatRatePerHour(activeMobileRow.actualOutputRatePerHour) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Spent / hr</span>
                                            <strong>{{ formatRatePerHour(activeMobileRow.spendRatePerHour) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Net / hr</span>
                                            <strong>{{ formatSignedRatePerHour(activeMobileRow.netRatePerHour) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Loss Output</span>
                                            <strong>{{ formatRatePerHour(activeMobileRow.lossOutputRatePerHour) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Future Chain Demand</span>
                                            <strong>{{ isItemsInputMode ? formatRatePerHour(activeMobileRow.fullTargetRatePerHour) : formatPercent(activeMobileRow.fullRequiredSpeed) }}</strong>
                                        </div>
                                        <div class="engineering-stat">
                                            <span>Immediate Increase</span>
                                            <strong>{{ throughputIncreaseLabel(activeMobileRow) }}</strong>
                                        </div>
                                    </div>
                                    <div class="engineering-card-foot">
                                        {{ isThroughputMode ? throughputFootLabel(activeMobileRow) : capLabel(activeMobileRow) }}
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
