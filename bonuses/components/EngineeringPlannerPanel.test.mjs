import assert from 'node:assert/strict';
import { EngineeringPlannerPanel } from './EngineeringPlannerPanel.js';
import { engineeringPlannerMethods } from '../app/engineeringPlanner.js';

assert.match(
    EngineeringPlannerPanel.template,
    /<div class="engineering-planner-header-actions">[\s\S]*?<button type="button" class="engineering-planner-help-btn" ref="helpButton" @click.stop="toggleHelp">Help<\/button>[\s\S]*?<span class="section-chev"/,
    'engineering planner header actions should keep the shared Help trigger and collapse chevron'
);

const ctx = {
    isItemsInputMode: true,
    roundUp: EngineeringPlannerPanel.methods.roundUp,
    formatPercent: EngineeringPlannerPanel.methods.formatPercent,
    formatSeconds: EngineeringPlannerPanel.methods.formatSeconds,
    formatRatePerHour: EngineeringPlannerPanel.methods.formatRatePerHour,
    throughputIncreaseLabel: EngineeringPlannerPanel.methods.throughputIncreaseLabel,
    throughputFootLabel: EngineeringPlannerPanel.methods.throughputFootLabel
};

function rate(value) {
    return ctx.formatRatePerHour.call(ctx, value);
}

assert.equal(
    ctx.formatSeconds.call(ctx, 12345),
    '12345.0s',
    'sub-day craft times keep the existing seconds-only format'
);

assert.equal(
    ctx.formatSeconds.call(ctx, 12345 * 3600),
    '514d 9h 0m 0s',
    'long craft times include days instead of growing hours without bound'
);

{
    const label = ctx.throughputIncreaseLabel.call(ctx, {
        inDependencyChain: true,
        blocking: true,
        uiRequiredRateIncreasePerHour: 170.6
    });

    assert.equal(label, `+${rate(170.6)}`, 'blocking rows show only the immediate useful increase');
}

{
    const label = ctx.throughputFootLabel.call(ctx, {
        inDependencyChain: true,
        currentCapacityRatePerHour: 720,
        blocking: true,
        blockingConsumers: ['Blueprint', 'Runic Blueprint'],
        uiRequiredRateIncreasePerHour: 170.6,
        targetRatePerHour: 890.6,
        fullTargetRatePerHour: 1067
    });

    assert.equal(
        label,
        `Blocking Blueprint, Runic Blueprint. Useful right now: increase this slot by ${rate(170.6)} to reach ${rate(890.6)} actual output. ${rate(1067)} is only future chain demand after the other blockers are fixed.`,
        'blocking rows clearly separate useful-now increase from future demand'
    );
}

{
    const label = ctx.throughputFootLabel.call(ctx, {
        inDependencyChain: true,
        currentCapacityRatePerHour: 40,
        blocking: false,
        starved: true,
        uiLossOutputRatePerHour: 2.52,
        starvationSources: ['Idea'],
        starvationContenders: ['Blueprint', 'Sun Scroll']
    });

    assert.equal(
        label,
        `Short on Idea at the current chain split. Losing ${rate(2.52)} of output. Contended by Blueprint, Sun Scroll.`,
        'starved rows report direct starvation sources and contention separately from demand targets'
    );
}

{
    const label = ctx.throughputFootLabel.call(ctx, {
        inDependencyChain: true,
        currentCapacityRatePerHour: 20,
        blocking: false,
        starved: false,
        spendRatePerHour: 9.96,
        actualOutputRatePerHour: 20,
        consumerLabels: ['Runic Blueprint', 'Sun Scroll']
    });

    assert.equal(
        label,
        `Runic Blueprint, Sun Scroll consume ${rate(9.96)}. Actual output is ${rate(20)}, so ${rate(10.04)} is currently surplus.`,
        'surplus rows explain current spend versus actual output without implying a shortage'
    );
}

{
    const app = {
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
                idea: 1067,
                blueprint: 12,
                runic_blueprint: null,
                sun_scroll: null
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
        app[name] = fn;
    }

    const runicRow = app.engineeringPlannerThroughputRows().find(row => row.id === 'runic_blueprint');
    const label = ctx.throughputFootLabel.call(ctx, runicRow);

    assert.equal(
        label,
        `Short on Blueprint at the current chain split. Increase this slot by ${rate(11.515151515151512)} to reach ${rate(18.18181818181818)}. Blocking Sun Scroll.`,
        'shared-input starvation keeps the shortage explanation but also exposes the required increase and blocking consumer'
    );
}

{
    const app = {
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
                idea: 1067,
                blueprint: 12,
                runic_blueprint: null,
                sun_scroll: null
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
        app[name] = fn;
    }

    const blueprintRow = app.engineeringPlannerThroughputRows().find(row => row.id === 'blueprint');
    const label = ctx.throughputFootLabel.call(ctx, blueprintRow);

    assert.equal(
        label,
        `Short on downstream demand. Increase this slot by ${rate(20.121212121212118)} to reach ${rate(32.12121212121212)}. Blocking Runic Blueprint, Sun Scroll.`,
        'a blamed shortage-source slot explains the required production increase and stays in the blocking/yellow state'
    );
}

console.log('bonuses/components/EngineeringPlannerPanel.test.mjs passed');
