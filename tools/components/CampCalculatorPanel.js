import { ToolsMobileTabs, TOOLS_TAB_ICONS } from './ToolsMobileTabs.js';
import { ToolsField } from './ToolsField.js';
import { ToolsDisclosure, ToolsResultsTable, ToolsSplitLayout } from './ToolsResults.js';
import { formatFixedNumber } from '../../bonuses/lib/utils.js';
import { CAMP } from '../lib/campData.js';
import { calculateCamp, campHiringGuide, campStars, campTargets } from '../lib/campCalculator.js';

const PERK_NAMES = { '': 'None', ...CAMP.perkNames };

const METRIC_COLUMNS = [
    { key: 'label' },
    { key: 'value', numeric: true }
];

const RESOURCE_COLUMNS = [
    { key: 'item', label: 'Resource' },
    { key: 'rate', label: 'Per hour', numeric: true }
];
const CREW_COLUMNS = [
    { key: 'stars', label: 'Building level' },
    { key: 'crew', label: 'Cats to hire' }
];

export const CampCalculatorPanel = {
    components: { ToolsDisclosure, ToolsField, ToolsMobileTabs, ToolsResultsTable, ToolsSplitLayout },
    props: { app: { type: Object, required: true }, mobile: Boolean },
    computed: {
        state() { return this.app.campState; },
        result() { return calculateCamp(this.state); },
        buildings() {
            return CAMP.buildings.map(building => {
                const { id } = building;
                const stars = campStars(this.state, id);
                const config = this.state.buildings[id];
                const targets = campTargets(id, stars);
                const slots = building.workerSlots[stars - 1] ?? 0;
                const workers = config.workers.slice(0, slots);
                return {
                    ...building, stars, config,
                    targets, workers,
                    production: this.result.production.find(row => row.id === id)
                };
            });
        },
        building() {
            const id = this.mobile && this.showBuilding ? this.state.mobileTab : this.state.buildingId;
            return this.buildings.find(building => building.id === id);
        },
        mobileTabs() {
            return [
                { id: 'summary', label: 'Summary', icon: TOOLS_TAB_ICONS.results },
                { id: 'parameters', label: 'Parameters', icon: TOOLS_TAB_ICONS.input },
                ...this.buildings.map(({ id, name, image }) => ({ id, label: name, image }))
            ];
        },
        showBuilding() {
            return !this.mobile || this.buildings.some(({ id }) => id === this.state.mobileTab);
        },
        metricColumns() { return METRIC_COLUMNS; },
        summaryGroups() {
            const result = this.result;
            const value = amount => result.valid && amount !== null ? this.format(amount) : '-';
            const rows = entries => entries.map(([label, value]) => ({ key: label, label, value }));
            return [
                { key: 'crew', rows: rows([['Active cats', result.active + ' / ' + result.activeCap]]) },
                { key: 'store', title: this.buildings.find(({ id }) => id === 'store').name, rows: rows([
                    ['Storage capacity', value(result.capacity)],
                    ['Resource types', result.usedSlots + ' / ' + result.slots],
                    ['Free chest slots', Math.max(0, result.slots - result.usedSlots)],
                    ['Hours to fill chest', value(result.storageHours)]
                ]) },
                { key: 'hall', title: this.buildings.find(({ id }) => id === 'hall').name, rows: rows([
                    ['RP per hour', value(result.rpHourly)],
                    ['RP cap', this.format(result.rpCap)],
                    ['Hours to RP cap', value(result.rpHours)]
                ]) }
            ];
        },
        resourceColumns() { return RESOURCE_COLUMNS; },
        crewColumns() { return CREW_COLUMNS; },
        hiringGuide() { return this.building ? campHiringGuide(this.building) : []; },
        maxLevels() { return CAMP.maxLevels; },
        perkNames() { return PERK_NAMES; },
        rarities() { return CAMP.rarities; },
        purchaseLimits() { return { active: CAMP.activePurchase.max_tier, slots: CAMP.slotPurchase.max_tier }; }
    },
    methods: {
        selectMobileTab(id) {
            this.state.mobileTab = id;
            if (Object.hasOwn(this.state.buildings, id)) this.state.buildingId = id;
            const panel = this.$el.closest('.mobile-item-browser');
            if (panel) panel.scrollTop = 0;
        },
        format: formatFixedNumber,
        setBranches(building, level) {
            building.config.levels.fill(level, 0, building.stars);
        },
        setRank(cat, tier) {
            cat.tier = tier;
            this.commitLevel(cat);
        },
        itemName(itemId) { return this.$label(this.app.data?.items?.get(itemId)?.name ?? itemId); },
        targetLabel(target) { return this.itemName(target[1]) + ' (' + this.$label('Act') + ' ' + target[2] + ')'; },
        commitLevel(cat) {
            if (cat.level === null || cat.level === '') {
                cat.level = null;
                return;
            }
            cat.level = Math.min(Math.max(1, Math.floor(Number(cat.level) || 1)), this.maxLevels[cat.tier]);
        }
    },
    template: `
        <section class="source-section engineering-planner-panel tools-camp-panel"
                 :style="{ '--section-color': app.typeColor('camp_production') }">
            <header class="section-header engineering-planner-header">
                <span>Camp Calculator</span>
            </header>
            <tools-mobile-tabs v-if="mobile" :tabs="mobileTabs" :active-tab="state.mobileTab"
                               label="Camp calculator view" scrollable @select="selectMobileTab"></tools-mobile-tabs>
            <tools-split-layout class="engineering-planner-body" sticky-results>
                <aside v-show="!mobile || state.mobileTab === 'summary'" class="tools-result-card tools-camp-summary" aria-label="Camp summary">
                    <h3 class="tools-recipe-section-label">Camp summary</h3>
                    <section v-for="group in summaryGroups" :key="group.key" class="tools-result-card">
                        <h4 v-if="group.title" class="tools-recipe-section-label">{{ group.title }}</h4>
                        <tools-results-table :columns="metricColumns" :rows="group.rows" hide-header></tools-results-table>
                    </section>
                    <p v-if="!result.valid" role="alert">There are more working cats than the camp can support.</p>
                    <p v-else-if="result.usedSlots > result.slots" role="status">The chest has too few slots for all selected resources. Reduce the number of resource types or add chest slots to calculate when it fills.</p>
                    <p v-else-if="result.resources.length">Chest fill time assumes an empty chest and fixed cat levels.</p>
                    <p v-else>Assign cats to resources to calculate production.</p>
                    <tools-results-table v-if="result.valid && result.resources.length"
                                         :columns="resourceColumns" :rows="result.resources">
                        <template #item="{ row }">{{ itemName(row.itemId) }}</template>
                        <template #rate="{ row }">{{ format(row.hourly) }}</template>
                    </tools-results-table>
                </aside>
                <div v-show="!mobile || state.mobileTab !== 'summary'" class="tools-camp-settings">
                    <div v-show="!mobile || state.mobileTab === 'parameters'" class="tools-result-card">
                        <div class="tools-afk-input-grid">
                            <tools-field label="Stored RP">
                                <input class="engineering-input tools-number-input" type="number" min="0" :max="result.rpCap" v-model.number="state.storedRP">
                            </tools-field>
                            <tools-field label="Active cat purchases" select>
                                <select class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                        v-model.number="state.activeBought">
                                    <option v-for="count in purchaseLimits.active + 1" :key="count" :value="count - 1">{{ count - 1 }}</option>
                                </select>
                            </tools-field>
                            <tools-field label="Chest slot purchases" select>
                                <select class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                        v-model.number="state.slotsBought">
                                    <option v-for="count in purchaseLimits.slots + 1" :key="count" :value="count - 1">{{ count - 1 }}</option>
                                </select>
                            </tools-field>
                        </div>
                    </div>
                    <nav v-if="!mobile" class="engineering-mode-switch tools-camp-choices tools-camp-building-nav"
                         aria-label="Buildings">
                        <button v-for="entry in buildings" :key="entry.id" type="button" class="engineering-mode-btn"
                                :data-camp-building-tab="entry.id"
                                :class="{ active: entry.id === state.buildingId }"
                                :aria-pressed="entry.id === state.buildingId"
                                @click="state.buildingId = entry.id">{{ entry.name }}</button>
                    </nav>
                    <section v-if="building && showBuilding" :key="building.id" :data-building="building.id"
                             class="tools-result-card tools-camp-building">
                        <h3>
                            <strong>{{ building.name }}</strong> · {{ building.stars }}★
                            <template v-if="result.valid && building.production?.rate">
                                · {{ format(building.production.rate) }} {{ $label('per hour') }}
                            </template>
                        </h3>
                        <div class="tools-afk-input-grid">
                            <div class="engineering-field">
                                <span class="engineering-field-label">Stars</span>
                                <div class="engineering-mode-switch tools-camp-choices" role="group" aria-label="Stars">
                                    <button v-if="!building.starting_star" type="button" class="engineering-mode-btn"
                                            :class="{ active: !building.stars }" :aria-pressed="!building.stars"
                                            @click="building.config.stars = 0">0&#9733;</button>
                                    <button v-for="stars in 3"
                                            :key="stars" type="button" class="engineering-mode-btn"
                                            :class="{ active: stars === building.stars }" :aria-pressed="stars === building.stars"
                                            :disabled="building.id !== 'hall' && stars > state.buildings.hall.stars"
                                            @click="building.config.stars = stars">{{ stars }}&#9733;</button>
                                </div>
                            </div>
                        </div>
                        <p v-if="building.id === 'house'" class="tools-info-note" role="note">Housing stars increase the active cat limit. Housing branch upgrades only increase cat XP.</p>
                        <div v-else class="engineering-mode-switch tools-camp-choices">
                            <tools-field v-for="branch in 3" :key="branch" :label="$label('Branch') + ' ' + branch">
                                <input class="engineering-input tools-number-input tools-number-input-compact" type="number"
                                       inputmode="numeric" min="0" step="1" :disabled="branch > building.stars"
                                       v-model.number="building.config.levels[branch - 1]">
                            </tools-field>
                            <div class="tools-number-input-actions tools-number-input-actions-inline"
                                 role="group" aria-label="Set all unlocked branches">
                                <button v-for="level in [0, 50, 100]" :key="level" type="button"
                                        class="engineering-card-badge tools-inline-action" :disabled="!building.stars"
                                        @click="setBranches(building, level)">{{ $label('All to {0}', [level]) }}</button>
                            </div>
                        </div>
                        <fieldset v-for="(cat, index) in building.workers" :key="index" class="tools-result-card">
                            <legend class="tools-recipe-section-label">{{ $label('Worker') }} {{ index + 1 }}</legend>
                            <div class="tools-afk-input-grid">
                                <tools-field label="Resource" select>
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full"
                                            :value="building.targets.some(([id]) => id === cat.target) ? cat.target : ''"
                                            @change="cat.target = $event.target.value">
                                        <option value="">Unassigned</option>
                                        <option v-for="target in building.targets" :key="target[0]" :value="target[0]">{{ targetLabel(target) }}</option>
                                    </select>
                                </tools-field>
                                <tools-field label="Rank" select>
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" :value="cat.tier"
                                            @change="setRank(cat, Number($event.target.value))">
                                        <option v-for="(rarity, tier) in rarities" :key="tier" :value="tier">{{ rarity }}</option>
                                    </select>
                                </tools-field>
                                <tools-field label="Level">
                                    <input class="engineering-input tools-number-input" type="number" min="1" :max="maxLevels[cat.tier]"
                                           aria-label="Level" :value="cat.level ?? maxLevels[cat.tier]"
                                           @input="cat.level = $event.target.value === '' ? '' : $event.target.valueAsNumber"
                                           @change="commitLevel(cat)">
                                    <template #actions>
                                        <button type="button" class="engineering-card-badge tools-inline-action"
                                                aria-label="Set worker level to the maximum for this rank"
                                                @click="cat.level = null">Max</button>
                                    </template>
                                </tools-field>
                            </div>
                            <div class="tools-afk-input-grid">
                                <tools-field v-for="(slot, perkIndex) in ['job', 'perk']" :key="slot" :label="$label('Skill') + ' ' + (perkIndex + 1)" select>
                                    <select class="engineering-input tools-input-surface tools-input-filled tools-input-full" v-model="cat[slot]">
                                        <option v-for="(name, key) in perkNames" :key="key" :value="key"
                                                :disabled="!!key && cat[slot === 'job' ? 'perk' : 'job'] === key">{{ name }}</option>
                                    </select>
                                </tools-field>
                            </div>
                        </fieldset>
                        <tools-disclosure v-if="hiringGuide.length" :label="$label('Hiring guide')">
                            <div class="tools-result-card">
                                <p>Higher-rarity cats give larger production bonuses.</p>
                                <tools-results-table :columns="crewColumns" :rows="hiringGuide">
                                    <template #stars="{ row }">
                                        <strong>{{ row.stars }}&#9733;</strong>
                                    </template>
                                    <template #crew="{ row }">
                                        <div v-for="group in row.crew" :key="group.key">
                                            <strong>{{ group.count }} &times;</strong>
                                            {{ $label(perkNames[group.job]) }} + {{ $label(perkNames[group.perk]) }}
                                        </div>
                                    </template>
                                </tools-results-table>
                                <p>{{ $label(perkNames.jack) }} increases only the power of the cat with that perk, in any building. {{ $label(perkNames.lead) }} increases the power of every cat working in the same building, including the cat with the perk.</p>
                            </div>
                        </tools-disclosure>
                    </section>
                </div>
            </tools-split-layout>
        </section>`
};
