import assert from 'node:assert/strict';
import { BonusUrlState } from './urlState.js';

{
    const app = {
        data: {
            bonus_types: [],
            classes: [],
            types: {},
            categories: [],
            conditions: [],
            engineeringPlanner: {
                default_anchor_slot: 'idea',
                slots: [
                    { id: 'idea', key: 'i' },
                    { id: 'blueprint', key: 'b' }
                ]
            }
        },
        sectionKind: 'bonuses',
        calcEntries: [],
        parameters: [],
        engineeringPlannerState: {},
        itemTypeEntries: [],
        itemSubfilterEntries: [],
        itemSubfilterMode: null,
        hiddenItemSections: new Set(),
        itemSectionAllMode: true,
        activeConditions: new Set(),
        collapsedSections: new Set(),
        selectedCalc: null,
        selectedBonus: null,
        selectedClass: null,
        itemSearch: '',
        viewMode: 'bonus',
        mobileTab: 'sources',
        normalizeHiddenItemSections(set) {
            return set;
        },
        engineeringPlannerSlotUpgrade() {
            return { defaultLevel: 0, maxLevel: 5 };
        },
        engineeringPlannerConfig() {
            return this.data.engineeringPlanner;
        },
        engineeringPlannerSlotByKey(key) {
            return this.data.engineeringPlanner.slots.find(slot => slot.key === key) ?? null;
        },
        engineeringPlannerSpeedParamKey(slot) {
            return `ev${slot.key}`;
        },
        engineeringPlannerItemsParamKey(slot) {
            return `ei${slot.key}`;
        },
        _bindMobileScroll() {},
        resourceBreakdownModifierDefinitionsByKey() {
            return new Map();
        }
    };

    const state = new BonusUrlState(app);
    state.apply('?em=t&ea=b&eib=12.5&evb=33.3&eu=4');

    assert.equal(app.engineeringPlannerState.mode, 'throughput', 'URL state restores throughput mode');
    assert.equal(app.engineeringPlannerState.anchorSlot, 'blueprint', 'URL state resolves throughput anchor by slot key');
    assert.equal(app.engineeringPlannerState.throughputItemsPerHour.idea, null, 'missing throughput items/hr stay empty for manual input');
    assert.equal(app.engineeringPlannerState.throughputItemsPerHour.blueprint, 12.5, 'URL state restores per-slot throughput items/hr exactly');
    assert.equal(app.engineeringPlannerState.throughputSpeeds.blueprint, 33.3, 'URL state restores per-slot throughput speed');
    assert.equal(app.engineeringPlannerState.slotUpgradeLevel, 4, 'URL state restores slot upgrade level in throughput mode');
}

console.log('bonuses/app/engineeringPlannerUrlState.test.mjs passed');
