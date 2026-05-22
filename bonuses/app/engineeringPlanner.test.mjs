import assert from 'node:assert/strict';
import { engineeringPlannerMethods } from './engineeringPlanner.js';

const context = {
    data: {
        engineeringPlanner: {
            default_anchor_slot: 'sun_scroll',
            slots: [
                {
                    id: 'idea',
                    key: 'i',
                    label: 'Idea',
                    bonus: 'engineer_idea_production_speed',
                    base_time: 5,
                    produces: { idea: 1 }
                },
                {
                    id: 'blueprint',
                    key: 'b',
                    label: 'Blueprint',
                    bonus: 'engineer_blueprint_production_speed',
                    base_time: 180,
                    consumes: { idea: 30 },
                    produces: { blueprint: 1 }
                },
                {
                    id: 'runic_blueprint',
                    key: 'r',
                    label: 'Runic Blueprint',
                    bonus: 'engineer_runic_blueprint_production_speed',
                    base_time: 540,
                    consumes: { idea: 70, blueprint: 1 },
                    produces: { runic_blueprint: 1 }
                },
                {
                    id: 'sun_scroll',
                    key: 's',
                    label: 'Sun Scroll',
                    bonus: 'engineer_sun_scroll_production_speed',
                    base_time: 1980,
                    consumes: { blueprint: 14, runic_blueprint: 10 },
                    produces: { sun_scroll: 1 }
                }
            ]
        },
        sources: []
    },
    engineeringPlannerState: {
        mode: 'throughput',
        inputMode: 'items',
        anchorSlot: 'sun_scroll',
        anchorSpeed: 0,
        anchorItemsPerHour: null,
        slotUpgradeLevel: 0,
        throughputSpeeds: {
            idea: 0,
            blueprint: 0,
            runic_blueprint: 0,
            sun_scroll: 0
        },
        throughputItemsPerHour: {
            idea: 600,
            blueprint: 40,
            runic_blueprint: 10,
            sun_scroll: 1
        }
    },
    _engineeringPlannerResolvedSlotsCache: null,
    _engineeringPlannerRowsCache: null,
    _resolveValue(entry) {
        return Number(entry?.value ?? 0);
    },
    categoryLabel(id) {
        return id;
    }
};

for (const [name, fn] of Object.entries(engineeringPlannerMethods)) {
    context[name] = fn;
}

const rows = context.engineeringPlannerThroughputRows();
const sunScroll = rows.find(row => row.id === 'sun_scroll');

assert.equal(rows.length, 4, 'throughput rows resolve for every planner slot');
assert.equal(Number(sunScroll.netRatePerHour.toFixed(2)), 0.42, 'throughput rows compute stable chain output for the current entered values');
assert.equal(sunScroll.blocking, false, 'anchor is not marked blocking when its entered rate matches target');

context.engineeringPlannerState.anchorSlot = 'blueprint';
context.engineeringPlannerState.throughputItemsPerHour.idea = 720;
context.engineeringPlannerState.throughputItemsPerHour.blueprint = 20;
context._engineeringPlannerResolvedSlotsCache = null;
context._engineeringPlannerRowsCache = null;

const blueprintRows = context.engineeringPlannerThroughputRows();
const idea = blueprintRows.find(row => row.id === 'idea');

assert.equal(Number(idea.currentCapacityRatePerHour.toFixed(3)), 720, 'idea keeps its gross entered output for blueprint anchor');
assert.equal(Number(idea.grossOutputRatePerHour.toFixed(3)), 720, 'idea gross output is shown as the real production rate');
assert.equal(Number(idea.currentRatePerHour.toFixed(3)), 600, 'idea chain usage reflects only the amount blueprint consumes');
assert.equal(Number(idea.spendRatePerHour.toFixed(3)), 600, 'idea spend rate matches blueprint demand');
assert.equal(Number(idea.netRatePerHour.toFixed(3)), 120, 'idea net rate keeps the unused remainder of gross production');
assert.deepEqual(idea.consumerLabels, ['Blueprint'], 'idea row names the downstream slot that consumes the output');

console.log('bonuses/app/engineeringPlanner.test.mjs passed');
