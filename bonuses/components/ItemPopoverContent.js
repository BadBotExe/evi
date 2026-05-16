import { MixedBreakdown } from './MixedBreakdown.js?v=c68ec99571';
import { SpriteImage } from './SpriteImage.js?v=35f7ba436b';

export const ItemPopoverContent = {
    components: { MixedBreakdown, SpriteImage },
    props: ['entry', 'app', 'embedded'],
    emits: ['close'],
    data() {
        return {
            sourcesWrapped: false,
            whereResizeObserver: null,
        };
    },
    computed: {
        src() { return this.entry?.src ?? this.entry; },
        maxItemContext() { return this.entry?.maxItemContext ?? null; },
        bonusRows() { return this.app.popoverBonuses(this.src); },
        breakdownBadges() { return this.app.getResourceBreakdownBadges(this.src); },
        sourceEntries() { return this.app.itemSourceDisplayEntries(this.src); },
        whereToGet() {
            const value = this.src?.where_to_get ?? this.src?.whereToGet ?? '';
            return typeof value === 'string' ? value.trim() : '';
        },
    },
    methods: {
        updateWhereWrapState() {
            const row = this.$refs.whereInline;
            const label = this.$refs.whereLabel;
            const value = this.$refs.whereText;
            if (!row || !label || !value) {
                this.sourcesWrapped = false;
                return;
            }

            const labelTop = Math.round(label.getBoundingClientRect().top);
            const valueTop = Math.round(value.getBoundingClientRect().top);
            this.sourcesWrapped = valueTop > labelTop;
        },
        observeWhereLayout() {
            if (typeof ResizeObserver !== 'function') return;

            this.disconnectWhereObserver();
            const row = this.$refs.whereInline;
            if (!row) return;

            this.whereResizeObserver = new ResizeObserver(() => this.updateWhereWrapState());
            this.whereResizeObserver.observe(row);
        },
        disconnectWhereObserver() {
            this.whereResizeObserver?.disconnect?.();
            this.whereResizeObserver = null;
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.observeWhereLayout();
            this.updateWhereWrapState();
        });
    },
    updated() {
        this.$nextTick(() => {
            this.observeWhereLayout();
            this.updateWhereWrapState();
        });
    },
    beforeUnmount() {
        this.disconnectWhereObserver();
    },
    template: `
        <div class="item-popover-content" :class="{ 'item-popover-content-embedded': embedded }">
            <div class="item-popover-header" :class="{ 'item-popover-header-embedded': embedded }">
                <div class="item-popover-img">
                    <sprite-image :image="src.image" :alt="app.sourceName(src)"></sprite-image>
                </div>
                <div>
                    <div class="item-popover-name-row" :class="{ 'has-breakdown-badges': embedded && breakdownBadges.length }">
                        <div class="item-popover-name"
                             :title="app.sourceName(src)"
                             @mousemove="app.showTooltip($event)"
                             @mouseleave="app.hideTooltip()">{{ app.sourceName(src) }}</div>
                        <div v-if="embedded && breakdownBadges.length" class="item-breakdown-badges">
                            <button v-for="badge in breakdownBadges"
                                    :key="badge.kind"
                                    type="button"
                                    class="item-enhancement-badge"
                                    :aria-label="badge.ariaLabel"
                                    @click.stop="app.openPriceBreakdownPopover(src, $event, badge.kind)">
                                <img :src="badge.icon" alt="" class="item-enhancement-icon">
                            </button>
                        </div>
                    </div>
                    <div class="item-popover-type">
                        {{ app.data.types[src.type]?.label }}
                        <span v-if="src.available === false" class="tag tag-na">Unavailable</span>
                        <span v-if="src.category" class="item-popover-category" :style="{ color: app.categoryColor(src.category) }">
                            {{ app.categoryLabel(src.category) }}
                        </span>
                    </div>
                </div>
                <button class="popover-close" @click="$emit('close')">&times;</button>
            </div>
            <div class="item-popover-bonuses">
                <div v-if="bonusRows.length === 0" class="item-popover-empty">
                    No bonuses
                </div>
                <div v-for="(b, bi) in bonusRows" :key="b.bonus + ':' + (b.unit_type || 'flat') + ':' + bi"
                     class="item-popover-row"
                     :class="{ 'item-popover-row-tiers': app.bonusHasTiers(src, b), 'item-popover-row-formula': app.itemBonusUsesFormula(src, b) }"
                    @click.stop="app.bonusHasTiers(src, b) ? app.openTierPopoverForBonus(src, b, $event, { maxItemContext }) : null">
                    <span class="item-popover-bonus-label">
                        <span v-if="b._is_ascension" class="tag tag-tier">{{ app.srcTierLabel(src, b) }}</span>
                        <span class="item-popover-bonus-label-text"
                              @mousemove="app.showTooltip($event)"
                              @mouseleave="app.hideTooltip()">{{ app.bonusLabel(b.bonus) }}</span>
                    </span>
                    <span class="item-popover-bonus-val">
                        <mixed-breakdown :app="app"
                                         :bonus-id="b.bonus"
                                         :flat="b._display.flat"
                                         :percent="b._display.percent"
                                         :percent-stages="b._display.percentStages"
                                         :multiplier="b._display.multiplier"
                                         :text="b._display.text"
                                         :rows-data="b._display.rows"
                                         class-name="item-popover-breakdown" />
                        <img v-if="b._display.icon" :src="b._display.icon" class="bonus-icon-img">
                    </span>
                    <div v-if="b._display.metaRows?.length" class="item-popover-row-meta">
                        <mixed-breakdown :app="app"
                                         :bonus-id="b.bonus"
                                         :rows-data="b._display.metaRows"
                                         class-name="item-popover-meta-breakdown" />
                    </div>
                </div>
            </div>
            <div v-if="sourceEntries.length || whereToGet" class="item-popover-where item-popover-where-block">
                <div ref="whereInline" class="item-popover-where-inline" :class="{ 'is-wrapped': sourcesWrapped }">
                    <span ref="whereLabel" class="item-popover-where-label">Sources</span>
                    <span v-if="sourceEntries.length" ref="whereText" class="item-popover-where-text">{{ sourceEntries.map(entry => entry.label).join(', ') }}</span>
                    <span v-else ref="whereText" class="item-popover-where-text">{{ whereToGet }}</span>
                </div>
            </div>
        </div>
    `
};
