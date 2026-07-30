import { SpriteImage } from './SpriteImage.js?v=a6508ec846';

export const TotalsCalculator = {
    components: { SpriteImage },
    props: {
        app: Object,
        maxLevel: {
            type: Number,
            default: 1
        },
        title: {
            type: String,
            default: 'Upgrade Calculator'
        },
        note: {
            type: String,
            default: ''
        },
        emptyText: {
            type: String,
            default: 'No resources for this level range.'
        },
        levelLabel: {
            type: String,
            default: 'Lvl'
        },
        costsForRange: {
            type: Function,
            required: true
        }
    },
    data() {
        return {
            fromLevel: 1,
            toLevel: null
        };
    },
    computed: {
        normalizedFromLevel() {
            return this.clampLevelInput(this.fromLevel, 1);
        },
        normalizedToLevel() {
            return this.clampLevelInput(this.toLevel, this.normalizedFromLevel);
        },
        customCosts() {
            return this.costsForRange(this.normalizedFromLevel, this.normalizedToLevel) ?? [];
        },
        customLabel() {
            const fromLevel = this.normalizedFromLevel;
            const toLevel = this.normalizedToLevel;
            const label = this.levelLabel || 'Lvl';
            return fromLevel === toLevel
                ? `${label} ${fromLevel.toLocaleString()}`
                : `${label} ${fromLevel.toLocaleString()}-${toLevel.toLocaleString()}`;
        }
    },
    watch: {
        maxLevel: {
            immediate: true,
            handler() {
                this.resetRange();
            }
        }
    },
    methods: {
        clampLevelInput(value, minimum = 1) {
            const numeric = Number(value);
            const max = Math.max(1, Number(this.maxLevel ?? 1));
            if (!Number.isFinite(numeric)) return minimum;
            return Math.min(max, Math.max(minimum, Math.floor(numeric)));
        },
        normalizeRange() {
            const fromLevel = this.clampLevelInput(this.fromLevel, 1);
            const toLevel = this.clampLevelInput(this.toLevel, fromLevel);
            this.fromLevel = fromLevel;
            this.toLevel = toLevel;
        },
        resetRange() {
            this.fromLevel = 1;
            this.toLevel = Math.max(1, Number(this.maxLevel ?? 1));
        },
        focusAndSelect(event) {
            event?.target?.select?.();
        },
        costAmountText(cost) {
            if (cost.amountText != null) return cost.amountText;
            return this.app.formatResourceBreakdownAmount(cost.amount);
        }
    },
    template: `
        <div class="price-breakdown-range-card">
            <div class="price-breakdown-range-head">
                <div class="price-breakdown-range-title">{{ title }}</div>
                <div class="price-breakdown-range-note">{{ note }}</div>
            </div>
            <div class="price-breakdown-range-controls">
                <label class="price-breakdown-range-field">
                    <span>{{ levelLabel }} from</span>
                    <input class="engineering-input price-breakdown-range-input"
                           type="number"
                           min="1"
                           :max="maxLevel"
                           v-model.number="fromLevel"
                           @change="normalizeRange"
                           @focus="focusAndSelect">
                </label>
                <label class="price-breakdown-range-field">
                    <span>{{ levelLabel }} to</span>
                    <input class="engineering-input price-breakdown-range-input"
                           type="number"
                           :min="normalizedFromLevel"
                           :max="maxLevel"
                           v-model.number="toLevel"
                           @change="normalizeRange"
                           @focus="focusAndSelect">
                </label>
            </div>
            <div class="price-breakdown-totals price-breakdown-totals-custom">
                <div class="price-breakdown-totals-label">{{ customLabel }}</div>
                <div class="price-breakdown-costs">
                    <div v-for="cost in customCosts" :key="'custom:' + (cost.item ?? cost.label)" class="price-breakdown-cost">
                        <div class="price-breakdown-cost-icon">
                            <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                        </div>
                        <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                        <span class="price-breakdown-cost-amount">{{ costAmountText(cost) }}</span>
                    </div>
                    <div v-if="!customCosts?.length" class="item-popover-empty price-breakdown-range-empty">
                        {{ emptyText }}
                    </div>
                </div>
            </div>
        </div>
    `
};
