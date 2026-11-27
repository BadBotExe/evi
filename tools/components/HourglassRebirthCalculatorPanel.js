import { BOARD_SIZE, CHAINS, GOALS, normalizeHourglassCount } from '../lib/hourglassRebirthCalculator.js?v=dfc6a45030';
import { persistHourglassState } from '../app/hourglassRebirthState.js?v=02a53a2b83';

const GOAL_DETAILS = {
    one: 'Final merge is 3 × T5 → 1 × T6. Spend as few new T1 as possible.',
    two: 'Final merge is 5 × T5 → 2 × T6. Spend as few new T1 as possible and ignore the leftovers.',
    five: 'Final merge is 5 × T5 → 2 × T6, and every tier merges by 5 wherever possible, even if that takes more new T1 than these two T6 strictly need.'
};

const TABS = [
    { id: 'input', label: 'Input', icon: 'M4 5h16M4 12h16M4 19h10' },
    { id: 'board', label: 'Board', icon: 'M4 7h16M7 4v6M17 4v6M8 15h8M10 19h4' },
    { id: 'timeline', label: 'Timeline', icon: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8' },
    { id: 'sand', label: 'Sand', icon: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8' }
];

const HourglassChainResult = {
    props: { chain: Object, result: Object, occupied: Number, mobile: Boolean },
    computed: {
        otherName() { return this.chain.id === 'sand' ? 'Timeline' : 'Sand'; },
        target() { return this.chain.prefix + '6'; },
        groups() {
            const groups = [];
            for (const op of this.result?.ops ?? []) {
                const previous = groups.at(-1);
                if (previous?.t === op.t && previous.tier === op.tier && previous.chain === op.chain) {
                    previous.count++;
                } else {
                    groups.push({ ...op, count: 1 });
                }
            }
            return groups;
        },
        leftovers() {
            return this.result?.leftovers?.map((count, index) => count
                ? count + ' × ' + this.chain.prefix + (index + 1) : '').filter(Boolean).reverse().join(', ');
        },
        mergeTotals() {
            const totals = new Map();
            for (const { t, tier, chain, count } of this.groups) {
                if (t === 'spawn') continue;
                const prefix = CHAINS.find(({ id }) => id === chain).prefix;
                const label = prefix + tier + ' → ' + prefix + (tier + 1);
                if (!totals.has(label)) totals.set(label, { label, chain, tier, m5: 0, m3: 0 });
                totals.get(label)[t] += count;
            }
            return [...totals.values()].sort((a, b) => a.chain.localeCompare(b.chain) || a.tier - b.tier);
        }
    },
    methods: {
        stepText({ t, tier, chain, count }) {
            const prefix = CHAINS.find(({ id }) => id === chain).prefix;
            if (t === 'spawn') return 'Spawn ' + count + ' × ' + prefix + '1';
            const [from, to] = t === 'm5' ? [5, 2] : [3, 1];
            return 'Merge ' + from + ' × ' + prefix + tier + ' → ' + to + ' × ' + prefix + (tier + 1)
                + (count > 1 ? ' (' + count + ' times)' : '');
        }
    },
    template: `
        <component :is="mobile ? 'section' : 'details'" v-if="result"
                   class="tools-result-card tools-hourglass-result" :open="mobile ? null : true">
            <component :is="mobile ? 'header' : 'summary'" class="tools-result-card-head tools-hourglass-summary">
                <h3>
                    <span class="tools-hourglass-summary-title tools-recipe-section-label">Can {{ chain.label }} reach T6?</span>
                    <span v-if="result.yield" class="tools-hourglass-summary-yield"
                          :class="result.yield === 2 ? 'tools-hourglass-yes' : 'tools-hourglass-one'">
                        {{ result.yield }} × {{ target }}
                    </span>
                    <span class="tools-hourglass-summary-status"
                          :class="result.yield ? 'tools-hourglass-yes' : 'tools-hourglass-no'">
                        {{ result.yield ? 'Yes' : 'No' }}
                    </span>
                </h3>
            </component>
            <div class="tools-hourglass-result-body">
                <div class="tools-result-card tools-hourglass-verdict tools-hourglass-yes" v-if="result.yield">
                    <span class="tools-hourglass-verdict-icon" aria-hidden="true">✓</span>
                    <strong>Yes, {{ target }} is reachable</strong>
                    <span v-if="result.spawns">Spawn {{ result.spawns }} new {{ chain.prefix }}1 and follow the plan below.</span>
                    <span v-else>Everything needed is already on the board.</span>
                </div>
                <div class="tools-result-card tools-hourglass-verdict tools-hourglass-no" v-else>
                    <span class="tools-hourglass-verdict-icon" aria-hidden="true">×</span>
                    <template v-if="result.needed === null">
                        <strong>No, {{ target }} is not reachable</strong>
                        <span>Even with plenty of free cells, this layout cannot reach T6.</span>
                    </template>
                    <template v-else>
                        <strong>No, not enough space</strong>
                        <span>{{ target }} needs {{ result.needed }} free cells, {{ result.free }} free now
                            (after merging the other chain). Short by {{ result.needed - result.free }}
                            {{ result.needed - result.free === 1 ? 'cell' : 'cells' }}.</span>
                    </template>
                </div>
                <div v-if="result.yield" class="tools-result-card tools-hourglass-yield"
                     :class="result.yield === 2 ? 'tools-hourglass-yes' : 'tools-hourglass-one'">
                    <span class="tools-recipe-section-label">Final merge yields</span>
                    <strong>{{ result.yield }} × {{ target }}</strong>
                    <span>{{ result.yield === 2 ? 5 : 3 }} × {{ chain.prefix }}5 → {{ result.yield }} × {{ target }}<template v-if="result.fallback">.
                        2 × {{ target }} is not possible here: not enough space for 5 × {{ chain.prefix }}5.</template></span>
                </div>
                <dl v-if="result.yield || result.needed !== null" class="tools-hourglass-metrics">
                    <div v-if="result.yield" class="tools-result-card">
                        <dt>New {{ chain.prefix }}1</dt><dd>{{ result.spawns }}</dd>
                        <small v-if="result.spawns > result.minimumSpawns">
                            {{ result.spawns - result.minimumSpawns }} more than the minimum ({{ result.minimumSpawns }})
                        </small>
                        <small v-else>minimum</small>
                    </div>
                    <div class="tools-result-card">
                        <dt>Free cells needed</dt><dd>{{ result.needed ?? '-' }}</dd>
                        <small>{{ result.yield ? 'free now: ' + result.free : 'minimum' }}</small>
                    </div>
                    <div v-if="result.yield" class="tools-result-card">
                        <dt>Peak occupancy</dt><dd>{{ result.peak }}</dd><small>of 25 cells</small>
                    </div>
                    <div v-if="result.leftovers" class="tools-result-card">
                        <dt>Leftover cells</dt><dd>{{ result.leftovers.reduce((sum, count) => sum + count, 0) }}</dd>
                        <small>{{ leftovers || 'nothing left' }}</small>
                    </div>
                    <template v-if="!result.yield">
                        <div class="tools-result-card">
                            <dt>Free now</dt><dd>{{ result.free }}</dd><small>after merging the other chain</small>
                        </div>
                        <div class="tools-result-card">
                            <dt>Short by</dt><dd>{{ result.needed - result.free }}</dd>
                            <small>{{ result.needed - result.free === 1 ? 'cell' : 'cells' }}</small>
                        </div>
                    </template>
                    <div v-if="result.preparation" class="tools-result-card">
                        <dt>{{ otherName }}</dt><dd>{{ result.preparation.before }} → {{ result.preparation.after }}</dd>
                        <small>{{ result.preparation.after === 1 ? 'cell' : 'cells' }} after merging</small>
                    </div>
                </dl>
                <div v-if="mergeTotals.length" class="tools-results-table-wrap">
                <table class="tools-results-table">
                    <thead><tr><th>Merge</th><th>5 → 2</th><th>3 → 1</th></tr></thead>
                    <tbody>
                        <tr v-for="row in mergeTotals" :key="row.label">
                            <td>{{ row.label }}</td><td>{{ row.m5 }}</td><td>{{ row.m3 }}</td>
                        </tr>
                    </tbody>
                </table>
                </div>
                <details v-if="groups.length" class="tools-hourglass-plan">
                    <summary>Steps ({{ groups.length }})</summary>
                    <ol class="tools-hourglass-steps">
                        <li v-for="(group, index) in groups" :key="index">{{ stepText(group) }}</li>
                    </ol>
                </details>
            </div>
        </component>
        <section v-else class="tools-result-card">
            <strong>Does not fit on the board</strong>
            <span>{{ occupied }} items need {{ occupied }} cells, but the board has 25. Reduce the number of items.</span>
        </section>
    `
};

export const HourglassRebirthCalculatorPanel = {
    components: { HourglassChainResult },
    props: { app: Object, mobile: Boolean },
    data() {
        return { mobileTab: 'input', tabs: TABS, chains: CHAINS, goals: GOALS, goalDetails: GOAL_DETAILS, boardSize: BOARD_SIZE };
    },
    computed: {
        state() { return this.app.hourglassState; },
        board() { return this.app.hourglassBoard; }
    },
    methods: {
        setCount(chain, tier, value) {
            const count = normalizeHourglassCount(value);
            this.state[chain][tier - 1] = count;
            persistHourglassState(this.state);
        },
        setGoal(event) {
            this.state.goal = event.target.value;
            persistHourglassState(this.state);
        },
        adjustCount(chain, tier, delta) {
            this.setCount(chain, tier, this.state[chain][tier - 1] + delta);
        },
        itemName(chain, tier) {
            return chain.label + ' T' + tier + (tier === 6 ? ', already built' : '');
        },
        commitCount(chain, tier, event) {
            event.target.value = this.state[chain][tier - 1];
        }
    },
    template: `
        <section class="source-section engineering-planner-panel tools-hourglass-panel" :style="{ '--section-color': app.typeColor('engineering_production') }">
            <div class="section-header engineering-planner-header"><span>Hourglass Rebirth Calculator</span></div>
            <div class="engineering-planner-body">
                <nav class="mobile-tabbar tools-afk-mobile-tabs" aria-label="Hourglass calculator view">
                    <button v-for="tab in tabs" :key="tab.id" type="button" class="mobile-tab"
                            :class="{ active: mobileTab === tab.id }" :aria-pressed="mobileTab === tab.id"
                            :aria-label="tab.id === 'board' && board.overflow ? 'Board, ' + board.occupied + ' of ' + boardSize + ' cells occupied' : null"
                            @click="mobileTab = tab.id">
                        <span v-if="tab.id === 'board' && board.overflow"
                              class="tools-hourglass-tab-overflow tools-hourglass-no" aria-hidden="true">
                            {{ board.occupied }}/{{ boardSize }}
                        </span>
                        <span v-else class="mobile-tab-icon tools-afk-tab-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path :d="tab.icon"></path></svg>
                        </span>
                        <span>{{ tab.label }}</span>
                    </button>
                </nav>
                <div class="tools-afk-layout">
                    <div class="tools-afk-controls" :class="{ active: mobileTab === 'input' }">
                        <p class="tools-hourglass-note">A 5×5 board with two kinds of items: Timeline (TL) and Sand (S).
                            Three items of one tier merge into one of the next tier, five merge into two.
                            Enter what is on the board and the calculator tells you whether Timeline can reach T6
                            and whether Sand can, if you focus on it. The starting values are an example.</p>
                        <section class="tools-result-card">
                            <h2 class="tools-recipe-section-label">What is on the board</h2>
                            <div v-for="chain in chains" :key="chain.id" class="tools-hourglass-counts">
                                <h3 class="tools-recipe-section-label">{{ chain.label }}</h3>
                                <div v-for="tier in 6" :key="tier" class="tools-hourglass-row">
                                    <div class="tools-hourglass-item">
                                        <span class="tools-hourglass-token" :class="[chain.id, 'tier-' + tier]">{{ chain.prefix }}{{ tier }}</span>
                                        <span>{{ itemName(chain, tier) }}</span>
                                    </div>
                                    <div class="tools-hourglass-stepper">
                                        <button type="button" class="tools-input-surface"
                                                :aria-label="'Decrease: ' + itemName(chain, tier)"
                                                @click="adjustCount(chain.id, tier, -1)">-</button>
                                        <input class="engineering-input tools-number-input" type="text" inputmode="numeric"
                                               pattern="[0-9]*" :aria-label="itemName(chain, tier)"
                                               :value="state[chain.id][tier - 1]"
                                               @input="setCount(chain.id, tier, $event.target.value)"
                                               @change="commitCount(chain.id, tier, $event)">
                                        <button type="button" class="tools-input-surface"
                                                :aria-label="'Increase: ' + itemName(chain, tier)"
                                                @click="adjustCount(chain.id, tier, 1)">+</button>
                                    </div>
                                </div>
                            </div>
                            <h3 :id="mobile ? 'hourglass-goal-title-mobile' : 'hourglass-goal-title'"
                                class="tools-recipe-section-label">Goal</h3>
                            <div class="tools-hourglass-goals" role="radiogroup"
                                 :aria-labelledby="mobile ? 'hourglass-goal-title-mobile' : 'hourglass-goal-title'">
                                <label v-for="goal in goals" :key="goal.id">
                                    <input type="radio" :name="mobile ? 'hourglass-goal-mobile' : 'hourglass-goal'" :checked="state.goal === goal.id" :value="goal.id" @change="setGoal($event)">
                                    <span>{{ goal.label }}<small>{{ goalDetails[goal.id] }}</small></span>
                                </label>
                            </div>
                            <p class="tools-hourglass-note">New T1 items can always be created, and each one takes a cell immediately.
                                Timeline merges only with Timeline, Sand only with Sand. Items already at T6 only take up cells.
                                When one chain is calculated, the other is merged as tightly as possible first to free up cells.
                                On the diagram Timeline runs along the top from left to right, Sand along the bottom from right to left.</p>
                        </section>
                    </div>
                    <div class="tools-hourglass-output">
                        <section class="tools-afk-results" :class="{ active: mobileTab === 'board' }">
                            <div class="tools-result-card">
                                <h3 class="tools-recipe-section-label">Board now</h3>
                                <div v-if="board.overflow" class="tools-result-card tools-hourglass-no" role="alert">
                                    <strong>Does not fit on the board</strong>
                                    <span>{{ board.occupied }} items need {{ board.occupied }} cells, but the board has {{ boardSize }}. Reduce the number of items.</span>
                                </div>
                                <template v-else>
                                    <div class="tools-hourglass-board" role="img" aria-label="Board, 5 by 5">
                                        <div v-for="(cell, index) in board.cells" :key="index" class="tools-hourglass-cell"
                                             :class="cell ? [cell.id, 'tier-' + cell.tier] : 'empty'"
                                             :title="cell ? cell.name : 'Empty cell'">{{ cell?.label }}</div>
                                    </div>
                                    <div aria-live="polite">
                                        Occupied {{ board.occupied }} of {{ boardSize }}, {{ boardSize - board.occupied }} free.
                                    </div>
                                </template>
                            </div>
                        </section>
                        <section class="tools-hourglass-results" aria-live="polite">
                            <h2 class="tools-recipe-section-label tools-hourglass-result-heading">Result</h2>
                            <div v-for="chain in chains" :key="chain.id" class="tools-afk-results"
                                 :class="{ active: mobileTab === chain.id, 'tools-hourglass-duplicate': chain.id === 'sand' && board.overflow }">
                                <hourglass-chain-result :chain="chain" :result="app.hourglassResults[chain.id]" :occupied="board.occupied" :mobile="mobile" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </section>
    `
};
