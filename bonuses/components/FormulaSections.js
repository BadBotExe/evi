import { SpriteImage } from './SpriteImage.js?v=a6508ec846';

export const FormulaSections = {
    components: { SpriteImage },
    props: {
        sections: {
            type: Array,
            default: () => []
        },
        app: Object,
        contentClass: {
            type: String,
            default: ''
        },
        costClass: {
            type: String,
            default: ''
        },
        hideSingleLabel: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        showSectionLabel(section) {
            if (!section?.label) return false;
            if (this.hideSingleLabel && this.sections.length <= 1) return false;
            if (this.app?.shouldHideResourceBreakdownSectionLabel?.(this.sections, section.label)) return false;
            return true;
        },
        costKey(section, cost) {
            return `${section.label}:${cost.item ?? cost.label}`;
        },
        costClasses(section) {
            if (section.kind === 'static') return 'price-breakdown-cost';
            return ['item-popover-row item-popover-row-formula price-breakdown-cost-formula', this.costClass].filter(Boolean).join(' ');
        }
    },
    template: `
        <div class="price-breakdown-formula-list" :class="contentClass">
            <div v-for="section in sections"
                 :key="section.label + ':' + section.kind"
                 class="price-breakdown-formula-row"
                 :class="{ 'price-breakdown-formula-row-no-label': !showSectionLabel(section) }">
                <div v-if="showSectionLabel(section)" class="price-breakdown-formula-label">{{ section.label }}</div>
                <div class="price-breakdown-costs">
                    <div v-for="cost in section.costs"
                         :key="costKey(section, cost)"
                         :class="costClasses(section)">
                        <template v-if="section.kind === 'static'">
                            <div class="price-breakdown-cost-icon">
                                <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                            </div>
                            <span class="price-breakdown-cost-label">{{ cost.label }}</span>
                            <span class="price-breakdown-cost-amount">{{ app.formatResourceBreakdownAmount(cost.amount) }}</span>
                        </template>
                        <template v-else>
                            <span class="item-popover-bonus-label">
                                <span v-if="cost.image" class="price-breakdown-cost-icon">
                                    <sprite-image :image="cost.image" :alt="cost.label"></sprite-image>
                                </span>
                                <span class="item-popover-bonus-label-text">{{ cost.label }}</span>
                            </span>
                            <span class="item-popover-bonus-val price-breakdown-cost-formula-amount">
                                <div class="max-panel-breakdown item-popover-breakdown">
                                    <span class="price-breakdown-cost-formula-text" v-html="cost.expressionHtml || cost.expression"></span>
                                </div>
                            </span>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `
};
