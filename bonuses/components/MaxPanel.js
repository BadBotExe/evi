import { MixedBreakdown } from './MixedBreakdown.js?v=c68ec99571';
import { SpriteImage } from './SpriteImage.js?v=a6508ec846';
import { normalizeValue } from '../lib/utils.js?v=a60e1a39f6';
import { buildMaxPanelBreakdownRows, maxPanelItemBaseKey, maxPanelItemHasNodeEdits, maxPanelItemKey } from './maxPanelHelpers.js?v=fe64144cb0';

const ITEMS_CATALOG_BASE_PATH = '../items/items.json';

export const MaxPanel = {
    components: { MixedBreakdown, SpriteImage },
    props: ['maxItems', 'maxTab', 'app', 'showTabSwitcher', 'showActualTab'],
    emits: ['update-tab'],
    data() {
        return {};
    },
    computed: {
        deleteIcon() {
            return this.app._sourceResolver.resolveImageAsset(
                ITEMS_CATALOG_BASE_PATH,
                'items:delete',
                '../items/images/delete.png?v=dd6946db7e'
            );
        },
        displayItems() {
            const grouped = new Map();

            for (const item of this.maxItems) {
                const splitPerInstance = this.shouldSplitPerInstance(item);
                const instanceCount = this.instanceCount(item, splitPerInstance);
                const instanceStart = item._instanceIndex != null ? Number(item._instanceIndex) : 0;

                for (let instanceOffset = 0; instanceOffset < instanceCount; instanceOffset += 1) {
                    const resolvedInstanceIndex = splitPerInstance ? (instanceStart + instanceOffset) : null;
                    const key = this.itemKey(item, resolvedInstanceIndex);
                    const raw = this.itemRawValue(item, splitPerInstance);

                    if (!grouped.has(key)) {
                        grouped.set(key, {
                            _rowKey: key,
                            _instanceIndex: resolvedInstanceIndex,
                            src: item.src,
                            bonus: item.bonus,
                            tierBadge: item.bonus?._tierBadgeLabel ?? null,
                            selectedTierBadges: item.selectedTierBadges ?? [],
                            mult: splitPerInstance ? 1 : (item.display_mult ?? item.mult),
                            flat: 0,
                            percent: 0,
                            percentStages: {},
                            multiplier: 1,
                        });
                    }

                    const entry = grouped.get(key);
                    if (item.unit_type === 'flat') entry.flat += raw;
                    else if (item.unit_type === 'percent') {
                        entry.percent += raw;
                        for (const [stageId, value] of Object.entries(item.percentStages ?? {})) {
                            entry.percentStages[stageId] = (entry.percentStages[stageId] ?? 0) + (value * (splitPerInstance ? 1 : item.mult));
                        }
                    }
                    else if (item.unit_type === 'multiplier') entry.multiplier *= raw;
                }
            }

            return [...grouped.values()];
        },
        filteredResult() {
            const items = [];

            for (const item of this.displayItems) {
                if (this.isDisabled(item)) continue;
                if (item.flat) items.push({ value: item.flat, mult: 1, unit_type: 'flat' });
                if (item.percent) items.push({ value: item.percent, percentStages: item.percentStages, mult: 1, unit_type: 'percent' });
                if (item.multiplier && item.multiplier !== 1) {
                    items.push({ value: item.multiplier, mult: 1, unit_type: 'multiplier' });
                }
            }

            return this.app._compoundTotal(items);
        },
        totalBreakdownColumns() {
            return this.app.formatCompoundBreakdownColumns(this.filteredResult, this.app.selectedBonus);
        },
        totalBreakdownRows() {
            return this.app.formatCompoundBreakdownRows(this.filteredResult, this.app.selectedBonus, { compact: true });
        },
        shouldUseBreakdownAsTotal() {
            return this.filteredResult?.unit_type !== 'flat'
                && this.totalBreakdownRows.length > 1;
        },
        totalDisplayRows() {
            if (this.shouldUseBreakdownAsTotal) return this.totalBreakdownRows;
            return [{ text: this.formatTotal(this.filteredResult) }];
        },
        isTotalEquivalentToBreakdown() {
            if (!this.totalBreakdownRows.length) return false;
            if (this.totalDisplayRows.length !== this.totalBreakdownRows.length) return false;
            return this.totalDisplayRows.every((row, index) => row?.text === this.totalBreakdownRows[index]?.text);
        },
        shouldShowTotalBreakdown() {
            return this.totalBreakdownColumns.length > 0 && !this.isTotalEquivalentToBreakdown;
        },
        showTotalBreakdownLabels() {
            return this.app.hasCompoundPercentStageBreakdown(this.filteredResult, this.app.selectedBonus);
        }
    },
    methods: {
        typeColor(type) { return this.app.typeColor(type); },
        formatVal(v, u, ut) { return this.app.formatVal(v, u, ut); },
        unitFor(id, ut) { return this.app.unitFor(id, ut); },
        formatTotal(r) { return this.app.formatTotal(r); },
        canReset() { return this.app.hasMaxPanelEdits(this.maxTab); },
        reset() { this.app.resetMaxPanel(this.maxTab); },
        remove(item, event) {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget?.blur?.();
            this.app.removeMaxPanelDisplayItem(item, event, this.maxTab);
        },
        itemBaseKey(item) {
            return maxPanelItemBaseKey(item);
        },
        itemKey(item, instanceIndex = null) {
            return maxPanelItemKey(item, instanceIndex);
        },
        shouldSplitPerInstance(item) {
            return this.app.maxPanelSourceUsesPerInstanceRows(item?.src);
        },
        instanceCount(item, splitPerInstance = false) {
            const count = Math.max(1, Number(item.display_mult ?? item.mult ?? 1));
            return splitPerInstance ? count : 1;
        },
        itemRawValue(item, splitPerInstance = false) {
            if (splitPerInstance) {
                if (item.unit_type === 'multiplier') {
                    if (item.instance_value != null) return Number(item.instance_value);
                    const count = Math.max(1, Number(item.display_mult ?? item.mult ?? 1));
                    return Math.pow(Number(item.value ?? 1), 1 / count);
                }
                return item.instance_value ?? item.value ?? 0;
            }
            return item.unit_type === 'multiplier'
                ? Math.pow(item.value, item.mult)
                : item.value * item.mult;
        },
        itemLabel(item) {
            let s = this.app.sourceName(item.src);
            if (item.mult > 1) s += ' x' + item.mult;
            if (item.src.available === false) s += ' (unavail.)';
            return s;
        },
        itemMultiplier(item) { return item.multiplier == null ? 1 : normalizeValue(item.multiplier); },
        itemBreakdownRows(item) {
            return buildMaxPanelBreakdownRows(item, this.app, this.itemMultiplier(item));
        },
        itemHasNodeEdits(item) {
            const group = item?.bonus?._groupBonuses ?? [];
            const hasDisabledNode = group.some(bonusEntry =>
                this.app.isMaxPanelTierNodeDisabled(item.src, bonusEntry, this.maxTab, item?._instanceIndex ?? null)
            );
            return maxPanelItemHasNodeEdits(item, hasDisabledNode);
        },
        itemTierLabels(item) {
            const labels = [];
            const seen = new Set();
            const push = label => {
                if (!label || seen.has(label)) return;
                seen.add(label);
                labels.push(label);
            };
            const modifiedLabels = item.selectedTierBadges ?? [];
            if (this.itemHasNodeEdits(item)) {
                return ['Custom'];
            }
            if (!modifiedLabels.length) {
                push(item.tierBadge ?? this.app.srcTierLabel(item.src, item.bonus));
            }
            for (const label of modifiedLabels) push(label);
            return labels;
        },
        isDisabled(item) {
            return this.app.isMaxPanelItemDisabled(item, this.maxTab);
        },
        toggleItem(item) {
            this.app.toggleMaxPanelItemDisabled(item, this.maxTab);
        },
        isRowClickable(item) {
            return !!this.app.maxPanelTierPopoverTarget(item, this.maxTab);
        }
    },
    template: `
        <div class="max-panel-content">
            <div class="max-panel-header">
                <span>{{ showTabSwitcher === false ? (maxTab === 'actual' ? 'Actual' : 'Max') : 'Max' }}</span>
                <div class="max-tab-switcher" v-if="showTabSwitcher !== false">
                    <button class="max-tab-btn" :class="{ active: maxTab === 'avail' }" @click="$emit('update-tab', 'avail')">Available</button>
                    <button v-if="showActualTab" class="max-tab-btn" :class="{ active: maxTab === 'actual' }" @click="$emit('update-tab', 'actual')">Actual</button>
                </div>
            </div>
            <div class="max-panel-body">
                <div class="max-panel-summary">
                    <button class="max-reset-btn" type="button" :disabled="!canReset()" @click="reset">Reset</button>
                    <div class="max-panel-val">
                        <div v-if="totalDisplayRows.length > 1" class="max-panel-total-inline">
                            <span v-for="row in totalDisplayRows" :key="row.text">{{ row.text }}</span>
                        </div>
                        <template v-else>{{ totalDisplayRows[0]?.text }}</template>
                    </div>
                </div>
                <div class="breakdown">
                    <div v-for="item in displayItems"
                         :key="itemKey(item)"
                         class="bd-row"
                         :class="{ 'bd-row-disabled': isDisabled(item), 'bd-row-clickable': isRowClickable(item) }"
                         @click.stop="app.onMaxItemClick(item, $event)">
                        <div class="bd-name">
                            <div class="bd-controls">
                                <button class="bd-toggle"
                                        type="button"
                                        :class="{ off: isDisabled(item) }"
                                        :title="isDisabled(item) ? 'Enable in total' : 'Disable from total'"
                                        @click.stop="toggleItem(item)">
                                    <svg v-if="!isDisabled(item)" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96C21.27 14.89 17.23 19 12 19S2.73 14.89 1.44 12.98a1.7 1.7 0 0 1 0-1.96C2.73 9.11 6.77 5 12 5Zm0 2C7.76 7 4.32 10.22 3.15 12 4.32 13.78 7.76 17 12 17s7.68-3.22 8.85-5C19.68 10.22 16.24 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" fill="currentColor"/>
                                    </svg>
                                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M3.28 2.22 21.78 20.72l-1.06 1.06-3.41-3.4A12.84 12.84 0 0 1 12 19c-5.23 0-9.27-4.11-10.56-6.02a1.7 1.7 0 0 1 0-1.96A16.9 16.9 0 0 1 7.1 6.31L2.22 3.28l1.06-1.06ZM8.8 7.37A14.6 14.6 0 0 0 3.15 12C4.32 13.78 7.76 17 12 17a10.9 10.9 0 0 0 3.94-.71l-2.08-2.08a3.5 3.5 0 0 1-4.07-4.07L8.8 7.37Zm3.92-.36A10.5 10.5 0 0 0 12 7c-.51 0-1 .05-1.49.13l-1.7-1.05A12.96 12.96 0 0 1 12 5c5.23 0 9.27 4.11 10.56 6.02a1.7 1.7 0 0 1 0 1.96 16.82 16.82 0 0 1-3.83 3.84l-1.43-1.43A14.64 14.64 0 0 0 20.85 12C19.89 10.54 17.31 8.03 13.9 7.31l-1.18-.3Zm-.3 3.03a1.97 1.97 0 0 1 1.54 1.54l-1.54-1.54Zm-1.88 1.88 2.5 2.5a2 2 0 0 1-2.5-2.5Z" fill="currentColor"/>
                                    </svg>
                                </button>
                                <button class="max-delete-btn" type="button" title="Remove from list" @click.stop="remove(item, $event)">
                                    <sprite-image :image="deleteIcon" alt="" img-class="max-delete-icon"></sprite-image>
                                </button>
                                <button class="bd-info-btn" type="button" title="Open item details" @click.stop="app.onMaxItemInfoClick(item, $event)">i</button>
                            </div>
                            <div class="bd-label">
                                <span class="bd-dot" :style="{ background: typeColor(item.src.type) }"></span>
                                <span class="bd-name-text" @mousemove="app.showTooltip($event)" @mouseleave="app.hideTooltip()" :class="{ 'item-unavailable': item.src.available === false }">
                                    {{ itemLabel(item) }}
                                </span>
                            </div>
                            <span v-for="label in itemTierLabels(item)" :key="label" class="tag tag-tier">
                                {{ label }}
                            </span>
                        </div>
                        <div class="bd-val">
                            <mixed-breakdown :app="app"
                                             class-name="max-panel-breakdown-stacked"
                                             :bonus-id="app.selectedBonus"
                                             :rows-data="itemBreakdownRows(item)" />
                        </div>
                    </div>
                    <div class="bd-total-wrap">
                        <div class="bd-total">
                            <span>Total</span>
                            <div>
                                <div v-if="totalDisplayRows.length > 1" class="max-panel-total-inline">
                                    <span v-for="row in totalDisplayRows" :key="row.text">{{ row.text }}</span>
                                </div>
                                <template v-else>{{ totalDisplayRows[0]?.text }}</template>
                            </div>
                        </div>
                        <div v-if="shouldShowTotalBreakdown" class="bd-total-breakdown">
                            <div v-for="(entry, index) in totalBreakdownColumns" :key="index" class="bd-total-chip">
                                <span class="bd-total-chip-value">{{ entry.value }}</span>
                                <span v-if="showTotalBreakdownLabels" class="bd-total-chip-label" v-html="entry.labelHtml || entry.label"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};
