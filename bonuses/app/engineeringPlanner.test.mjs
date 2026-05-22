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

{
    const rows = context.engineeringPlannerThroughputRows();
    const idea = rows.find(row => row.id === 'idea');
    const blueprint = rows.find(row => row.id === 'blueprint');
    const runic = rows.find(row => row.id === 'runic_blueprint');
    const sunScroll = rows.find(row => row.id === 'sun_scroll');

    assert.equal(rows.length, 4, 'throughput rows resolve for every planner slot');
    assert.equal(Number(idea.netRatePerHour.toFixed(0)), -1300, 'idea row can go negative when downstream gross demand exceeds its gross output');
    assert.equal(idea.blocking, true, 'negative gross-demand gap highlights the slot as needing more production');
    assert.equal(Number(blueprint.netRatePerHour.toFixed(2)), 16, 'blueprint keeps positive net when it still exceeds downstream gross demand');
    assert.equal(runic.blocking, false, 'runic is not highlighted when its gross output already matches downstream gross demand');
    assert.equal(Number(sunScroll.netRatePerHour.toFixed(2)), 1, 'anchor net equals its own gross output when there are no downstream consumers');
}

context.engineeringPlannerState.anchorSlot = 'blueprint';
context.engineeringPlannerState.throughputItemsPerHour.idea = 720;
context.engineeringPlannerState.throughputItemsPerHour.blueprint = 20;
context._engineeringPlannerResolvedSlotsCache = null;
context._engineeringPlannerRowsCache = null;

{
    const rows = context.engineeringPlannerThroughputRows();
    const idea = rows.find(row => row.id === 'idea');
    const blueprint = rows.find(row => row.id === 'blueprint');

    assert.equal(Number(idea.currentCapacityRatePerHour.toFixed(3)), 720, 'idea keeps its gross entered output for blueprint anchor');
    assert.equal(Number(idea.actualOutputRatePerHour.toFixed(3)), 720, 'actual output stays equal to gross output in the game-style model');
    assert.equal(Number(idea.spendRatePerHour.toFixed(3)), 600, 'idea spend still matches blueprint gross demand');
    assert.equal(Number(idea.netRatePerHour.toFixed(3)), 120, 'idea net keeps the unused remainder of gross production');
    assert.equal(Number(blueprint.netRatePerHour.toFixed(3)), 20, 'anchor output becomes pure surplus when no downstream slot is active');
}

context.engineeringPlannerState.anchorSlot = 'sun_scroll';
context.engineeringPlannerState.throughputItemsPerHour.idea = 1067;
context.engineeringPlannerState.throughputItemsPerHour.blueprint = 12;
context.engineeringPlannerState.throughputItemsPerHour.runic_blueprint = null;
context.engineeringPlannerState.throughputItemsPerHour.sun_scroll = null;
context._engineeringPlannerResolvedSlotsCache = null;
context._engineeringPlannerRowsCache = null;

{
    const rows = context.engineeringPlannerThroughputRows();
    const idea = rows.find(row => row.id === 'idea');
    const blueprint = rows.find(row => row.id === 'blueprint');
    const runic = rows.find(row => row.id === 'runic_blueprint');

    assert.equal(Number(idea.netRatePerHour.toFixed(3)), 240.333, 'upstream idea slot keeps surplus under the game-style gross-demand model');
    assert.equal(Number(blueprint.netRatePerHour.toFixed(3)), -20.121, 'blueprint row can go negative when gross downstream demand exceeds its output');
    assert.equal(blueprint.starved, true, 'blueprint is marked short when its net is negative');
    assert.equal(blueprint.blocking, true, 'blueprint is highlighted as needing more production in the exact user scenario');
    assert.equal(Number(blueprint.requiredRateIncreasePerHour.toFixed(2)), 20.12, 'blueprint exposes the increase needed to cover the gross downstream shortage');
    assert.equal(Number(runic.netRatePerHour.toFixed(3)), -11.515, 'runic row can also go negative under the same model');
    assert.equal(runic.blocking, true, 'runic is highlighted when its own gross output is below downstream gross demand');
}

context.engineeringPlannerState.mode = 'throughput_calc';
context.engineeringPlannerState.anchorSlot = 'sun_scroll';
context.engineeringPlannerState.throughputItemsPerHour.idea = 600;
context.engineeringPlannerState.throughputItemsPerHour.blueprint = 40;
context.engineeringPlannerState.throughputItemsPerHour.runic_blueprint = 10;
context.engineeringPlannerState.throughputItemsPerHour.sun_scroll = 1;
context._engineeringPlannerResolvedSlotsCache = null;
context._engineeringPlannerRowsCache = null;

{
    const rows = context.engineeringPlannerThroughputRows();
    const idea = rows.find(row => row.id === 'idea');
    const blueprint = rows.find(row => row.id === 'blueprint');
    const runic = rows.find(row => row.id === 'runic_blueprint');
    const sunScroll = rows.find(row => row.id === 'sun_scroll');

    assert.equal(Number(idea.netRatePerHour.toFixed(3)), 0, 'calculator mode restores the steady-state balanced flow for idea');
    assert.equal(Number(blueprint.actualOutputRatePerHour.toFixed(3)), 12.632, 'calculator mode scales blueprint actual output by upstream shortages');
    assert.equal(Number(runic.actualOutputRatePerHour.toFixed(3)), 3.158, 'calculator mode scales runic actual output by the settled steady-state chain');
    assert.equal(Number(sunScroll.netRatePerHour.toFixed(3)), 0.316, 'calculator mode keeps the old steady-state anchor output');
}

console.log('bonuses/app/engineeringPlanner.test.mjs passed');
