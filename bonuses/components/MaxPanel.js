import { MixedBreakdown } from './MixedBreakdown.js?v=63be4a93e4';
import { normalizeValue } from '../utils.js?v=7e5a144c2d';

export const MaxPanel = {
    components: { MixedBreakdown },
    props: ['maxItems', 'maxResult', 'maxTab', 'app', 'showTabSwitcher'],
    emits: ['update-tab'],
    computed: {
        displayItems() {
            const grouped = new Map();

            for (const item of this.maxItems) {
                const key = item.src.id;
                const raw = item.unit_type === 'multiplier'
                    ? Math.pow(item.value, item.mult)
                    : item.value * item.mult;

                if (!grouped.has(key)) {
                    grouped.set(key, {
                        src: item.src,
                        bonus: item.bonus,
                        mult: item.display_mult ?? item.mult,
                        flat: 0,
                        percent: 0,
                        multiplier: 1,
                    });
                }

                const entry = grouped.get(key);
                if (item.unit_type === 'flat') entry.flat += raw;
                else if (item.unit_type === 'percent') entry.percent += raw;
                else if (item.unit_type === 'multiplier') entry.multiplier *= raw;
            }

            return [...grouped.values()];
        }
    },
    methods: {
        typeColor(type) { return this.app.typeColor(type); },
        formatVal(v, u, ut) { return this.app.formatVal(v, u, ut); },
        unitFor(id, ut) { return this.app.unitFor(id, ut); },
        formatTotal(r) { return this.app.formatTotal(r); },
        itemLabel(item) {
            let s = this.app.sourceName(item.src);
            if (item.mult > 1) s += ' ×' + item.mult;
            if (item.src.available === false) s += ' (unavail.)';
            return s;
        },
        itemMultiplier(item) { return item.multiplier == null ? 1 : normalizeValue(item.multiplier); },
    },
    template: `
        <div class="max-panel-content">
            <div class="max-panel-header">
                <span>{{ showTabSwitcher === false ? (maxTab === 'avail' ? 'Max (Available)' : 'Max (All)') : 'Max' }}</span>
                <div class="max-tab-switcher" v-if="showTabSwitcher !== false">
                    <button class="max-tab-btn" :class="{ active: maxTab === 'avail' }" @click="$emit('update-tab', 'avail')">Available</button>
                    <button class="max-tab-btn" :class="{ active: maxTab === 'all' }"   @click="$emit('update-tab', 'all')">All</button>
                </div>
            </div>
            <div class="max-panel-body">
                <div class="max-panel-val">{{ formatTotal(maxResult) }}</div>
                <div class="breakdown">
                    <div v-for="item in displayItems" :key="item.src.id" class="bd-row" @click.stop="app.onMaxItemClick(item, $event)">
                        <div class="bd-name">
                            <span class="bd-dot" :style="{ background: typeColor(item.src.type) }"></span>
                            <span class="bd-name-text" @mousemove="app.showTooltip($event)" @mouseleave="app.hideTooltip()" :class="{ 'item-unavailable': item.src.available === false }">
                                {{ itemLabel(item) }}
                            </span>
                            <span v-if="app.srcTierLabel(item.src, item.bonus)" class="tag tag-tier">
                                {{ app.srcTierLabel(item.src, item.bonus) }}
                            </span>
                        </div>
                        <div class="bd-val">
                            <mixed-breakdown :app="app"
                                             :bonus-id="app.selectedBonus"
                                             :flat="item.flat || null"
                                             :percent="item.percent || null"
                                             :multiplier="itemMultiplier(item)" />
                        </div>
                    </div>
                    <div class="bd-total">
                        <span>Total</span>
                        <div style="text-align: right">
                            <div>{{ formatTotal(maxResult) }}</div>
                            <mixed-breakdown :app="app"
                                             :bonus-id="app.selectedBonus"
                                             :flat="maxResult.flat"
                                             :percent="maxResult.percent"
                                             :multiplier="maxResult.multiplier" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};
