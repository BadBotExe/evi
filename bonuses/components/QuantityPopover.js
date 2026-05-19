import { SpriteImage } from './SpriteImage.js?v=a6508ec846';

export const QuantityPopover = {
    components: { SpriteImage },
    props: ['entry', 'app', 'showClose', 'mobile'],
    emits: ['close', 'confirm'],
    data() {
        return {
            amount: 1
        };
    },
    computed: {
        src() { return this.entry?.src ?? null; },
        mode() { return this.entry?.mode ?? 'add'; },
        maxAllowed() { return Math.max(1, Number(this.entry?.maxAllowed ?? 1)); },
        currentCount() { return Math.max(0, Number(this.entry?.currentCount ?? 0)); },
        title() { return this.mode === 'remove' ? 'How many to remove?' : 'How many to add?'; },
        subtitle() {
            return this.mode === 'remove'
                ? `Current: ${this.currentCount} · Removable: ${this.maxAllowed}`
                : `Current: ${this.currentCount} · Addable: ${this.maxAllowed}`;
        }
    },
    watch: {
        entry: {
            immediate: true,
            handler() {
                this.amount = 1;
            }
        }
    },
    methods: {
        clampAmount() {
            const numeric = Number(this.amount ?? 1);
            if (!Number.isFinite(numeric)) {
                this.amount = 1;
                return;
            }
            this.amount = Math.min(this.maxAllowed, Math.max(1, Math.floor(numeric)));
        },
        adjust(delta) {
            this.amount = Number(this.amount ?? 1) + delta;
            this.clampAmount();
        },
        setMin() {
            this.amount = 1;
        },
        setMax() {
            this.amount = this.maxAllowed;
        },
        submit() {
            this.clampAmount();
            this.$emit('confirm', this.amount);
        }
    },
    template: `
        <div class="quantity-popover-shell" :class="{ 'quantity-popover-shell-mobile': mobile }">
            <div class="item-popover-header quantity-popover-header">
                <div class="item-popover-img">
                    <sprite-image :image="src?.image" :alt="app.sourceName(src)"></sprite-image>
                </div>
                <div>
                    <div class="item-popover-name">{{ title }}</div>
                    <div class="item-popover-type">{{ subtitle }}</div>
                </div>
                <button v-if="showClose !== false" class="popover-close" @click="$emit('close')">&times;</button>
            </div>
            <div class="quantity-popover-body">
                <div class="quantity-stepper" :class="{ 'quantity-stepper-mobile': mobile }">
                    <button type="button" class="quantity-stepper-btn quantity-stepper-max-btn" @click="setMin">Min</button>
                    <button type="button" class="quantity-stepper-btn" @click="adjust(-1)">-</button>
                    <input class="quantity-stepper-input"
                           :class="{ 'quantity-stepper-input-mobile': mobile }"
                           type="number"
                           min="1"
                           :max="maxAllowed"
                           v-model.number="amount"
                           @change="clampAmount"
                           @focus="e => e.target.select()">
                    <button type="button" class="quantity-stepper-btn" @click="adjust(1)">+</button>
                    <button type="button" class="quantity-stepper-btn quantity-stepper-max-btn" @click="setMax">Max</button>
                </div>
                <div class="quantity-popover-actions">
                    <button type="button" class="item-section-panel-btn" @click="$emit('close')">Cancel</button>
                    <button type="button" class="item-section-panel-btn quantity-confirm-btn" @click="submit">
                        {{ mode === 'remove' ? 'Remove' : 'Add' }}
                    </button>
                </div>
            </div>
        </div>
    `
};
