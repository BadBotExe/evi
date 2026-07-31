import { SpriteImage } from '../../bonuses/components/SpriteImage.js?v=a6508ec846';
import {
    defaultPityClaimPulls,
    filterCurioEventsByPullRange,
    filterCurioEvents,
    paginateCurioEventRows,
    simulateCurioGacha,
    validatePityClaimPulls
} from '../lib/curioGacha.js?v=f1f22d2111';

export const CurioGachaPanel = {
    props: ['app'],
    components: { SpriteImage },
    computed: {
        state() {
            return this.app.curioGachaState;
        },
        simulation() {
            return simulateCurioGacha({
                playFabId: this.state.playFabId,
                gachaData: this.app.data?.curioGacha,
                ordinaryPulls: this.state.ordinaryPulls,
                pityClaimPulls: this.pityClaimPulls
            });
        },
        summary() {
            return this.simulation.summary;
        },
        rangeEvents() {
            return filterCurioEventsByPullRange(
                this.simulation.events,
                this.state.ordinaryPullsFrom,
                this.state.ordinaryPulls
            );
        },
        filteredEvents() {
            return filterCurioEvents(this.rangeEvents, {
                rarities: this.state.rarities,
                definitionId: this.state.definitionId
            });
        },
        hasSelectedCurioFilter() {
            return Boolean(this.state.definitionId);
        },
        hasRarityFilters() {
            return (this.state.rarities ?? []).length > 0;
        },
        hasActiveFilters() {
            return this.hasSelectedCurioFilter || this.hasRarityFilters;
        },
        pageCount() {
            return Math.max(1, Math.ceil(this.filteredEvents.length / 101));
        },
        currentPage() {
            return Math.max(1, Math.min(this.pageCount, Number(this.state.page ?? 1) || 1));
        },
        pageEvents() {
            return paginateCurioEventRows(this.filteredEvents, this.currentPage, 101);
        },
        progressItems() {
            return this.summary.selected ?? [];
        },
        pityClaimPulls() {
            const defaults = defaultPityClaimPulls(this.state.ordinaryPulls);
            const custom = Array.isArray(this.state.pityClaimPulls) ? this.state.pityClaimPulls : [];
            return defaults.map((value, index) => Number(custom[index] ?? value));
        },
        pityValidation() {
            return validatePityClaimPulls(this.pityClaimPulls, this.state.ordinaryPulls);
        },
        pityModeLabel() {
            const defaults = defaultPityClaimPulls(this.state.ordinaryPulls);
            const isDefault = defaults.length === this.pityClaimPulls.length
                && defaults.every((value, index) => value === this.pityClaimPulls[index]);
            return isDefault ? 'Immediate pity' : 'Custom pity';
        },
        finderRows() {
            return this.state.finderRows ?? [];
        },
        finderMatches() {
            return this.app.curioGachaFinderMatches?.() ?? [];
        },
        finderHasCompleteRows() {
            return this.finderRows.some(row => {
                const count = (row.choices ?? []).filter(Boolean).length;
                return row.type === 'pity' ? count === 1 : count === 3;
            });
        },
        curioOptions() {
            const rarityOrder = new Map(['common', 'uncommon', 'rare', 'epic', 'legendary'].map((rarity, index) => [rarity, index]));
            return [...(this.app.data?.curioGacha?.curios ?? [])].sort((left, right) => {
                const leftRank = rarityOrder.get(left?.rarity) ?? 99;
                const rightRank = rarityOrder.get(right?.rarity) ?? 99;
                if (leftRank !== rightRank) return leftRank - rightRank;
                return String(left?.name ?? '').localeCompare(String(right?.name ?? ''));
            });
        },
        rarityFilters() {
            return (this.app.data?.categories ?? [])
                .filter(category => String(category?.id ?? '').startsWith('curio_'))
                .map(category => ({
                    id: category.id.replace(/^curio_/, ''),
                    label: category.label,
                    color: category.color
                }));
        },
        selectedCurioFilter() {
            if (!this.state.definitionId) return null;
            return this.progressItems.find(item => item.definition_id === this.state.definitionId)
                ?? this.app.data?.curioGacha?.curios?.find(item => item.definition_id === this.state.definitionId)
                ?? null;
        }
    },
    methods: {
        setPlayFabId(value) {
            this.app.setCurioGachaPlayFabId(value);
        },
        setPage(value) {
            this.app.setCurioGachaPage(value);
        },
        setOrdinaryPulls(value) {
            this.app.setCurioGachaOrdinaryPulls(value);
        },
        setOrdinaryPullsFrom(value) {
            this.app.setCurioGachaOrdinaryPullsFrom(value);
        },
        togglePityPopover() {
            this.app.toggleCurioGachaPityPopover('tools-curio-pity-toggle');
        },
        closePityPopover() {
            this.app.closeCurioGachaPityPopover();
        },
        setPityClaimPull(index, value) {
            this.app.setCurioGachaPityClaimPull(index, value);
        },
        resetPityClaims() {
            this.app.resetCurioGachaPityClaims();
        },
        toggleFinder() {
            this.app.toggleCurioGachaFinderPopover('tools-curio-finder-toggle');
        },
        closeFinder() {
            this.app.closeCurioGachaFinderPopover();
        },
        addFinderRow() {
            this.app.addCurioGachaFinderRow();
        },
        removeFinderRow(index) {
            this.app.removeCurioGachaFinderRow(index);
        },
        setFinderChoice(rowIndex, slotIndex, value) {
            this.app.setCurioGachaFinderChoice(rowIndex, slotIndex, value);
        },
        setFinderRowType(rowIndex, value) {
            this.app.setCurioGachaFinderRowType(rowIndex, value);
        },
        toggleFinderChoicePicker(rowIndex, slotIndex, event) {
            this.app.toggleCurioGachaFinderChoicePicker(rowIndex, slotIndex, event);
        },
        isFinderChoicePickerOpen(rowIndex, slotIndex) {
            return this.state.finderPickerOpen
                && this.state.finderPickerRow === rowIndex
                && this.state.finderPickerSlot === slotIndex;
        },
        finderChoice(row, slotIndex) {
            const definitionId = row?.choices?.[slotIndex] ?? '';
            return this.curioOptions.find(curio => curio.definition_id === definitionId) ?? null;
        },
        finderCurioOptions(row) {
            if (row?.type !== 'pity') return this.curioOptions;
            return this.curioOptions.filter(curio => curio.rarity === 'legendary');
        },
        applyFinderMatch(match) {
            this.app.applyCurioGachaFinderMatch(match);
        },
        previousPage() {
            this.setPage(this.currentPage - 1);
        },
        nextPage() {
            this.setPage(this.currentPage + 1);
        },
        toggleRarity(rarity) {
            this.app.toggleCurioGachaRarity(rarity);
        },
        selectCurio(item) {
            if (!item?.definition_id) return;
            this.app.setCurioGachaDefinitionFilter(item.definition_id);
        },
        resetFilters() {
            this.app.resetCurioGachaFilters();
        },
        isRarityActive(rarity) {
            return !this.hasSelectedCurioFilter && (this.state.rarities ?? []).includes(rarity);
        },
        choiceClasses(choice) {
            return {
                'tools-curio-choice-selected': choice?.selected === true,
                'tools-curio-choice-salvage': choice?.selected === true && choice?.useful === false
            };
        },
        rarityClass(entry) {
            return `tools-curio-rarity-${entry?.rarity ?? 'common'}`;
        },
        copyStatus(item) {
            const count = Math.min(Number(item?.useful ?? item?.count ?? 0), Number(item?.required_copies ?? 0));
            return `${count}/${item?.required_copies ?? 0}`;
        },
        tierStatus(item) {
            const count = Math.min(Number(item?.useful ?? item?.count ?? 0), Number(item?.required_copies ?? 0));
            return `T${Math.max(0, count - 1)}`;
        }
    },
    template: `
        <section class="source-section engineering-planner-panel tools-curio-gacha-panel" :style="{ '--section-color': app.typeColor('curio') }">
            <div class="section-header engineering-planner-header">
                <span>Curio Gacha History</span>
            </div>
            <div class="engineering-planner-body">
                <div class="tools-compact-panel tools-curio-controls">
                    <label class="engineering-field tools-curio-id-field">
                        <span class="engineering-field-label">PlayFabId</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                   type="text"
                                   autocomplete="off"
                                   spellcheck="false"
                                   placeholder="506769617668B19A"
                                   :value="state.playFabId"
                                   @input="setPlayFabId($event.target.value)">
                        </span>
                    </label>
                    <label class="engineering-field tools-curio-pulls-field">
                        <span class="engineering-field-label">Pulls From</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                   type="number"
                                   min="1"
                                   max="10000"
                                   :value="state.ordinaryPullsFrom"
                                   @change="setOrdinaryPullsFrom($event.target.value)"
                                   @blur="setOrdinaryPullsFrom($event.target.value)"
                                   @keydown.enter="setOrdinaryPullsFrom($event.target.value)">
                        </span>
                    </label>
                    <label class="engineering-field tools-curio-pulls-field">
                        <span class="engineering-field-label">Pulls To</span>
                        <span class="engineering-field-control">
                            <input class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                   type="number"
                                   min="1"
                                   max="10000"
                                   :value="state.ordinaryPulls"
                                   @change="setOrdinaryPulls($event.target.value)"
                                   @blur="setOrdinaryPulls($event.target.value)"
                                   @keydown.enter="setOrdinaryPulls($event.target.value)">
                        </span>
                    </label>
                    <div class="engineering-field tools-curio-finder-field">
                        <span class="engineering-field-label">Find Pulls</span>
                        <span class="engineering-field-control">
                            <button type="button"
                                    class="tools-smeltery-calc-toggle tools-curio-finder-toggle"
                                    id="tools-curio-finder-toggle"
                                    aria-label="Find pull number from observed curio choices"
                                    @click="toggleFinder()">🧮</button>
                        </span>
                    </div>
                </div>

                <div v-show="state.finderPopoverOpen && !app.isMobileViewport"
                     class="tools-smeltery-calc-popover tools-curio-finder-popover"
                     id="tools-curio-finder-popover"
                     @click.stop="app.closeCurioGachaFinderChoicePicker()"
                     @pointerdown.stop>
                    <div class="tools-smeltery-calc-popover-header" @mousedown="app.markCurioGachaFinderPopoverDragged($event)">
                        <div>
                            <div class="tools-smeltery-calc-popover-title">Find Pull Number</div>
                        </div>
                        <button type="button" class="tools-smeltery-calc-close" @click="closeFinder()">×</button>
                    </div>
                    <div class="tools-curio-finder-body">
                        <div class="tools-curio-pity-note">
                            Enter one or more consecutive events in the exact order shown by the game. Normal pulls use 3 choices; pity uses 1 legendary reward. Search checks only pulls 1-5000 and returns up to 10 matching positions.
                        </div>
                        <div class="tools-curio-finder-rows">
                            <div v-for="(row, rowIndex) in finderRows"
                                 :key="row.id"
                                 class="tools-curio-finder-row"
                                 :class="{ 'tools-curio-finder-row-pity': row.type === 'pity' }">
                                <div class="tools-curio-finder-row-head">
                                    <span>Row {{ rowIndex + 1 }}</span>
                                    <button type="button" class="engineering-card-badge tools-remove-badge" :disabled="finderRows.length <= 1" @click.stop="removeFinderRow(rowIndex)">×</button>
                                </div>
                                <select class="engineering-input tools-input-surface tools-curio-finder-type"
                                        :value="row.type ?? 'pull'"
                                        @change="setFinderRowType(rowIndex, $event.target.value)">
                                    <option value="pull">Normal</option>
                                    <option value="pity">Pity</option>
                                </select>
                                <div v-for="slotIndex in (row.type === 'pity' ? [0] : [0, 1, 2])"
                                     :key="row.id + '-' + slotIndex"
                                     class="tools-curio-finder-picker">
                                    <button type="button"
                                            class="tools-curio-finder-picker-button"
                                            @click.stop="toggleFinderChoicePicker(rowIndex, slotIndex, $event)">
                                        <div class="tools-item-frame tools-curio-finder-picker-thumb">
                                            <sprite-image v-if="finderChoice(row, slotIndex)?.image" :image="finderChoice(row, slotIndex).image" :alt="finderChoice(row, slotIndex).name" img-class="tools-item-image"></sprite-image>
                                            <span v-else class="tools-item-fallback">{{ row.type === 'pity' ? 'P' : slotIndex + 1 }}</span>
                                        </div>
                                        <span>{{ finderChoice(row, slotIndex)?.name ?? (row.type === 'pity' ? 'Pity reward' : ('Choice ' + (slotIndex + 1))) }}</span>
                                    </button>
                                    <div v-if="isFinderChoicePickerOpen(rowIndex, slotIndex)"
                                         class="tools-curio-finder-picker-menu"
                                         :style="state.finderPickerStyle"
                                         @click.stop>
                                        <button v-for="curio in finderCurioOptions(row)"
                                                :key="curio.definition_id"
                                                type="button"
                                                class="tools-curio-finder-picker-option"
                                                :class="rarityClass(curio)"
                                                @click="setFinderChoice(rowIndex, slotIndex, curio.definition_id)">
                                            <div class="tools-item-frame tools-curio-finder-picker-thumb">
                                                <sprite-image v-if="curio.image" :image="curio.image" :alt="curio.name" img-class="tools-item-image"></sprite-image>
                                                <span v-else class="tools-item-fallback">{{ curio.name.slice(0, 1).toUpperCase() }}</span>
                                            </div>
                                            <span>{{ curio.name }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tools-curio-finder-actions">
                            <button type="button" class="item-chip" :disabled="finderRows.length >= 10" @click="addFinderRow()">Add pull</button>
                        </div>
                        <div class="tools-curio-finder-results">
                            <div v-if="!finderHasCompleteRows" class="tools-resource-hint">Fill all choices in at least one row. Normal rows use 3 choices; pity rows use 1 reward.</div>
                            <div v-else-if="!finderMatches.length" class="tools-curio-pity-validation">No matches found up to pull 5000.</div>
                            <div v-else v-for="match in finderMatches" :key="match.start_pull + '-' + match.end_pull" class="tools-curio-finder-match">
                                <div>
                                    <div class="tools-curio-summary-title">Pulls {{ match.start_pull }}-{{ match.end_pull }}</div>
                                    <div class="tools-resource-hint">{{ match.rows.length }} matching event{{ match.rows.length === 1 ? '' : 's' }}</div>
                                </div>
                                <button type="button" class="item-chip" @click="applyFinderMatch(match)">Apply</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="state.finderPopoverOpen && app.isMobileViewport"
                     class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                     @click="closeFinder()"></div>
                <div v-if="state.finderPopoverOpen && app.isMobileViewport"
                     class="mobile-drawer tools-smeltery-calc-sheet tools-curio-finder-sheet open">
                    <div class="mobile-drawer-header">
                        <div class="mobile-drawer-handle"></div>
                        <button type="button"
                                class="mobile-drawer-close"
                                aria-label="Close find pull number"
                                @click="closeFinder()">&times;</button>
                    </div>
                    <div class="mobile-drawer-body">
                        <div class="tools-smeltery-calc-sheet-card">
                            <div class="tools-smeltery-calc-popover-header">
                                <div>
                                    <div class="tools-smeltery-calc-popover-title">Find Pull Number</div>
                                </div>
                            </div>
                            <div class="tools-curio-finder-body">
                                <div class="tools-curio-pity-note">
                                    Enter one or more consecutive events in the exact order shown by the game. Normal pulls use 3 choices; pity uses 1 legendary reward. Search checks only pulls 1-5000 and returns up to 10 matching positions.
                                </div>
                                <div class="tools-curio-finder-rows">
                                    <div v-for="(row, rowIndex) in finderRows"
                                         :key="'mobile-' + row.id"
                                         class="tools-curio-finder-row"
                                         :class="{ 'tools-curio-finder-row-pity': row.type === 'pity' }">
                                        <div class="tools-curio-finder-row-head">
                                            <span>Row {{ rowIndex + 1 }}</span>
                                            <button type="button" class="engineering-card-badge tools-remove-badge" :disabled="finderRows.length <= 1" @click.stop="removeFinderRow(rowIndex)">×</button>
                                        </div>
                                        <select class="engineering-input tools-input-surface tools-curio-finder-type"
                                                :value="row.type ?? 'pull'"
                                                @change="setFinderRowType(rowIndex, $event.target.value)">
                                            <option value="pull">Normal</option>
                                            <option value="pity">Pity</option>
                                        </select>
                                        <select v-for="slotIndex in (row.type === 'pity' ? [0] : [0, 1, 2])"
                                                :key="'mobile-' + row.id + '-' + slotIndex"
                                                class="engineering-input tools-input-surface tools-input-full tools-curio-finder-mobile-select"
                                                :value="row.choices?.[slotIndex] ?? ''"
                                                @change="setFinderChoice(rowIndex, slotIndex, $event.target.value)">
                                            <option value="">{{ row.type === 'pity' ? 'Pity reward' : ('Choice ' + (slotIndex + 1)) }}</option>
                                            <option v-for="curio in finderCurioOptions(row)"
                                                    :key="curio.definition_id"
                                                    :value="curio.definition_id">
                                                {{ curio.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div class="tools-curio-finder-actions">
                                    <button type="button" class="item-chip" :disabled="finderRows.length >= 10" @click="addFinderRow()">Add pull</button>
                                </div>
                                <div class="tools-curio-finder-results">
                                    <div v-if="!finderHasCompleteRows" class="tools-resource-hint">Fill all choices in at least one row. Normal rows use 3 choices; pity rows use 1 reward.</div>
                                    <div v-else-if="!finderMatches.length" class="tools-curio-pity-validation">No matches found up to pull 5000.</div>
                                    <div v-else v-for="match in finderMatches" :key="'mobile-' + match.start_pull + '-' + match.end_pull" class="tools-curio-finder-match">
                                        <div>
                                            <div class="tools-curio-summary-title">Pulls {{ match.start_pull }}-{{ match.end_pull }}</div>
                                            <div class="tools-resource-hint">{{ match.rows.length }} matching event{{ match.rows.length === 1 ? '' : 's' }}</div>
                                        </div>
                                        <button type="button" class="item-chip" @click="applyFinderMatch(match)">Apply</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="summary.error" class="empty-state item-empty-state tools-curio-empty">
                    <div class="empty-title">{{ summary.error }}</div>
                    <div class="empty-sub tools-curio-empty-hint">Paste the account PlayFabId to calculate deterministic gacha events.</div>
                    <div class="empty-sub tools-curio-future-warning">
                        This calculator reveals real future gacha results from the game. Not every player wants to know what comes next. Think carefully before using it: once you see the future, you cannot unknow it, and it may change or reduce your enjoyment of the game. By entering your PlayFabId, you confirm that you understand what this tool does.
                    </div>
                </div>

                <template v-else>
                    <div class="tools-result-card tools-curio-simulation-card">
                        <div class="tools-result-card-head">
                            <div>
                                <div class="tools-recipe-section-label">Simulation</div>
                                <div class="tools-curio-summary-title">Pulls {{ state.ordinaryPullsFrom }}-{{ summary.ordinary_pulls }}</div>
                            </div>
                            <div class="tools-curio-pity-control">
                                <button type="button"
                                        class="tools-inline-summary-badge tools-curio-pity-toggle"
                                        id="tools-curio-pity-toggle"
                                        :class="{ 'tools-curio-pity-toggle-invalid': !pityValidation.valid }"
                                        @click="togglePityPopover()">
                                    {{ summary.pity_claims }} pity · {{ pityModeLabel }}
                                </button>
                                <div v-show="state.pityPopoverOpen && !app.isMobileViewport"
                                     class="tools-smeltery-calc-popover tools-curio-pity-popover"
                                     id="tools-curio-pity-popover"
                                     @click.stop
                                     @pointerdown.stop>
                                    <div class="tools-smeltery-calc-popover-header" @mousedown="app.markCurioGachaPityPopoverDragged($event)">
                                        <div>
                                            <div class="tools-smeltery-calc-popover-title">Pity Claims</div>
                                        </div>
                                        <button type="button" class="tools-smeltery-calc-close" @click="closePityPopover()">×</button>
                                    </div>
                                    <div class="tools-curio-pity-popover-body">
                                        <div class="tools-smeltery-calc-popover-subtitle tools-curio-pity-description">
                                            Every ordinary pull adds 1 pity point. Claiming pity costs 100 points, consumes the next deterministic seed event, and gives one legendary curio. By default claims are taken immediately after pulls 100, 200, 300, and so on. You can delay claims or collect several at the same pull if enough pity points are available.
                                        </div>
                                        <div class="tools-curio-pity-note">
                                            Delaying pity can change which legendary curio you get because a later seed is spent on the legendary-only pity roll. That seed will no longer produce the normal pull that would have appeared on that row, so its three choices are replaced by the pity reward.
                                        </div>
                                        <div class="tools-curio-pity-validation" v-if="!pityValidation.valid">{{ pityValidation.message }}</div>
                                        <div class="tools-results-table-wrap">
                                            <table class="tools-results-table tools-curio-pity-table">
                                                <thead>
                                                    <tr>
                                                        <th>Pity</th>
                                                        <th>Claim after pull</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(pull, index) in pityClaimPulls" :key="index">
                                                        <td>#{{ index + 1 }}</td>
                                                        <td>
                                                            <input class="engineering-input tools-input-surface tools-curio-pity-input"
                                                                   type="number"
                                                                   min="100"
                                                                   :max="state.ordinaryPulls"
                                                                   :value="pull"
                                                                   @change="setPityClaimPull(index, $event.target.value)"
                                                                   @blur="setPityClaimPull(index, $event.target.value)"
                                                                   @keydown.enter="setPityClaimPull(index, $event.target.value)">
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="tools-curio-pity-popover-footer">
                                        <button type="button" class="item-chip tools-curio-reset-chip" @click="resetPityClaims()">Reset to immediate</button>
                                    </div>
                                </div>
                                <div v-if="state.pityPopoverOpen && app.isMobileViewport"
                                     class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                                     @click="closePityPopover()"></div>
                                <div v-if="state.pityPopoverOpen && app.isMobileViewport"
                                     class="mobile-drawer tools-smeltery-calc-sheet open">
                                    <div class="mobile-drawer-header">
                                        <div class="mobile-drawer-handle"></div>
                                        <button type="button"
                                                class="mobile-drawer-close"
                                                aria-label="Close pity claims"
                                                @click="closePityPopover()">&times;</button>
                                    </div>
                                    <div class="mobile-drawer-body">
                                        <div class="tools-smeltery-calc-sheet-card">
                                            <div class="tools-smeltery-calc-popover-header">
                                                <div>
                                                    <div class="tools-smeltery-calc-popover-title">Pity Claims</div>
                                                </div>
                                            </div>
                                            <div class="tools-curio-pity-popover-body">
                                                <div class="tools-smeltery-calc-popover-subtitle tools-curio-pity-description">
                                                    Every ordinary pull adds 1 pity point. Claiming pity costs 100 points, consumes the next deterministic seed event, and gives one legendary curio. By default claims are taken immediately after pulls 100, 200, 300, and so on. You can delay claims or collect several at the same pull if enough pity points are available.
                                                </div>
                                                <div class="tools-curio-pity-note">
                                                    Delaying pity can change which legendary curio you get because a later seed is spent on the legendary-only pity roll. That seed will no longer produce the normal pull that would have appeared on that row, so its three choices are replaced by the pity reward.
                                                </div>
                                                <div class="tools-curio-pity-validation" v-if="!pityValidation.valid">{{ pityValidation.message }}</div>
                                                <div class="tools-results-table-wrap">
                                                    <table class="tools-results-table tools-curio-pity-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Pity</th>
                                                                <th>Claim after pull</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr v-for="(pull, index) in pityClaimPulls" :key="'mobile-' + index">
                                                                <td>#{{ index + 1 }}</td>
                                                                <td>
                                                                    <input class="engineering-input tools-input-surface tools-curio-pity-input"
                                                                           type="number"
                                                                           min="100"
                                                                           :max="state.ordinaryPulls"
                                                                           :value="pull"
                                                                           @change="setPityClaimPull(index, $event.target.value)"
                                                                           @blur="setPityClaimPull(index, $event.target.value)"
                                                                           @keydown.enter="setPityClaimPull(index, $event.target.value)">
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <div class="tools-curio-pity-popover-footer">
                                                <button type="button" class="item-chip tools-curio-reset-chip" @click="resetPityClaims()">Reset to immediate</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tools-curio-stat-grid">
                            <div class="tools-curio-stat-tile">
                                <span>Seed events</span>
                                <strong>{{ summary.seed_events }}</strong>
                            </div>
                            <div class="tools-curio-stat-tile">
                                <span>Completed</span>
                                <strong>{{ summary.completed_curios }} / {{ summary.total_curios }}</strong>
                            </div>
                            <div class="tools-curio-stat-tile">
                                <span>Useful picks</span>
                                <strong>{{ summary.useful_picks }}</strong>
                            </div>
                            <div class="tools-curio-stat-tile">
                                <span>Salvage picks</span>
                                <strong>{{ summary.salvage_picks }}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="tools-result-grid tools-curio-summary-grid">
                        <div class="tools-result-card">
                            <div class="tools-result-card-head">
                                <div>
                                    <div class="tools-recipe-section-label">Best Picks</div>
                                    <div class="tools-curio-summary-title">
                                        {{ summary.completed_curios }} / {{ summary.total_curios }} completed
                                    </div>
                                </div>
                                <div class="tools-curio-best-actions">
                                    <button type="button" class="item-chip tools-curio-reset-chip" :disabled="!hasSelectedCurioFilter" @click="resetFilters()">Reset</button>
                                    <div class="tools-inline-summary-badge">{{ summary.useful_picks }} useful</div>
                                </div>
                            </div>
                            <div class="tools-curio-progress-grid">
                                <button v-for="item in progressItems"
                                        :key="item.definition_id"
                                        type="button"
                                        class="tools-curio-progress-item tools-curio-progress-button"
                                        :class="[rarityClass(item), { active: state.definitionId === item.definition_id }]"
                                        @click="selectCurio(item)">
                                    <div class="tools-item-frame tools-curio-progress-thumb">
                                        <sprite-image v-if="item.image" :image="item.image" :alt="item.name" img-class="tools-item-image"></sprite-image>
                                        <span v-else class="tools-item-fallback">{{ item.name.slice(0, 1).toUpperCase() }}</span>
                                    </div>
                                    <div class="tools-curio-progress-body">
                                        <div class="tools-curio-progress-name">{{ item.name }}</div>
                                        <div class="tools-curio-progress-count">{{ tierStatus(item) }} · {{ copyStatus(item) }}</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="tools-result-card tools-curio-filter-card">
                        <div class="tools-result-card-head tools-curio-filter-head">
                            <div>
                                <div class="tools-recipe-section-label">Filters</div>
                                <div class="tools-curio-summary-title">
                                    <template v-if="selectedCurioFilter">{{ selectedCurioFilter.name }}</template>
                                    <template v-else-if="hasRarityFilters">{{ filteredEvents.length }} matching events</template>
                                    <template v-else>All events</template>
                                </div>
                            </div>
                            <button type="button" class="item-chip tools-curio-reset-chip" :disabled="!hasActiveFilters" @click="resetFilters()">Reset</button>
                        </div>
                        <div class="item-section-controls tools-curio-filter-chips">
                            <button v-for="entry in rarityFilters"
                                    :key="entry.id"
                                    type="button"
                                    class="item-chip item-section-chip"
                                    :class="{ active: isRarityActive(entry.id), disabled: hasSelectedCurioFilter }"
                                    :style="{ '--item-chip-color': entry.color, '--item-chip-color-soft': entry.color + '22' }"
                                    :disabled="hasSelectedCurioFilter"
                                    @click="toggleRarity(entry.id)">
                                <span>{{ entry.label }}</span>
                            </button>
                        </div>
                    </div>

                    <div class="tools-result-card tools-curio-events-card">
                        <div class="tools-result-card-head tools-curio-page-head">
                            <div>
                                <div class="tools-recipe-section-label">Events</div>
                                <div class="tools-curio-summary-title">Page {{ currentPage }} / {{ pageCount }} · {{ filteredEvents.length }} rows</div>
                            </div>
                            <div class="tools-curio-pager">
                                <button type="button" class="engineering-mode-btn" :disabled="currentPage <= 1" @click="previousPage()">Prev</button>
                                <input class="engineering-input tools-input-surface tools-curio-page-input"
                                       type="number"
                                       min="1"
                                       :max="pageCount"
                                       :value="currentPage"
                                       @input="setPage($event.target.value)">
                                <button type="button" class="engineering-mode-btn" :disabled="currentPage >= pageCount" @click="nextPage()">Next</button>
                            </div>
                        </div>

                        <div class="tools-results-table-wrap">
                            <table class="tools-results-table tools-curio-events-table">
                                <thead>
                                    <tr>
                                        <th class="tools-curio-roll-col">Roll</th>
                                        <th>Choice 1</th>
                                        <th>Choice 2</th>
                                        <th>Choice 3</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="event in pageEvents" :key="event.type + '-' + event.seed_counter" :class="{ 'tools-curio-pity-row': event.type === 'pity' }">
                                        <td class="tools-curio-roll-col">
                                            <span v-if="event.type === 'pull'">#{{ event.pull_number }}</span>
                                            <span v-else>Pity #{{ event.pity_claim_number }} after #{{ event.after_pull_number }}</span>
                                        </td>
                                        <template v-if="event.type === 'pull'">
                                            <td v-for="choice in event.choices" :key="choice.slot" class="tools-curio-choice-cell">
                                                <div class="tools-curio-choice" :class="[choiceClasses(choice), rarityClass(choice)]" :title="choice.name">
                                                    <div class="tools-item-frame tools-curio-choice-thumb">
                                                        <sprite-image v-if="choice.image" :image="choice.image" :alt="choice.name" img-class="tools-item-image"></sprite-image>
                                                        <span v-else class="tools-item-fallback">{{ choice.name.slice(0, 1).toUpperCase() }}</span>
                                                    </div>
                                                    <div class="tools-curio-choice-name">{{ choice.name }}</div>
                                                </div>
                                            </td>
                                        </template>
                                        <template v-else>
                                            <td colspan="3" class="tools-curio-choice-cell">
                                                <div class="tools-curio-choice tools-curio-choice-selected tools-curio-pity-reward" :class="rarityClass(event.reward)" :title="event.reward.name">
                                                    <div class="tools-item-frame tools-curio-choice-thumb">
                                                        <sprite-image v-if="event.reward.image" :image="event.reward.image" :alt="event.reward.name" img-class="tools-item-image"></sprite-image>
                                                        <span v-else class="tools-item-fallback">{{ event.reward.name.slice(0, 1).toUpperCase() }}</span>
                                                    </div>
                                                    <div class="tools-curio-choice-name">{{ event.reward.name }}</div>
                                                </div>
                                            </td>
                                        </template>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>
            </div>
        </section>
    `
};
