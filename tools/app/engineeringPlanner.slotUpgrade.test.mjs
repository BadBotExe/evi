import assert from 'node:assert/strict';

import { engineeringPlannerMethods } from './engineeringPlanner.js';

const plannerConfig = {
    default_anchor_slot: 'sun_scroll',
    slot_upgrade: {
        source_id: 'gem_shop_engineer_slot_upgrade',
        default_level: 0
    },
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
};

function createPlannerApp() {
    const app = {
        data: {
            engineeringPlanner: plannerConfig,
            items: new Map([
                ['idea', { name: 'Idea' }],
                ['blueprint', { name: 'Blueprint' }],
                ['runic_blueprint', { name: 'Runic Blueprint' }],
                ['sun_scroll', { name: 'Sun Scroll' }]
            ]),
            sources: [
                {
                    id: 'gem_shop_engineer_slot_upgrade',
                    bonuses: [
                        { bonus: 'engineer_production_speed', unit_type: 'multiplier', value: 2 }
                    ],
                    enhancement: {
                        segments: [
                            {
                                costs: [
                                    { amount: { values: [150, 250, 350, 500] } }
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        engineeringPlannerState: {
            mode: 'requirements',
            inputMode: 'items',
            anchorSlot: 'sun_scroll',
            anchorSpeed: 0,
            anchorItemsPerHour: 10,
            throughputSpeeds: {
                idea: 0,
                blueprint: 0,
                runic_blueprint: 0,
                sun_scroll: 0
            },
            throughputItemsPerHour: {
                idea: 7200,
                blueprint: 240,
                runic_blueprint: 60,
                sun_scroll: 10
            },
            slotUpgradeLevel: 0
        },
        resolveValue(entry) {
            return Number(entry?.value ?? 0);
        },
        categoryLabel(id) {
            return id;
        }
    };
    Object.assign(app, engineeringPlannerMethods);
    return app;
}

{
    const app = createPlannerApp();

    for (let level = 0; level <= 4; level += 1) {
        app.engineeringPlannerState.slotUpgradeLevel = level;

        const resolvedSlots = app.engineeringPlannerResolvedSlots();
        for (let index = 0; index < resolvedSlots.length; index += 1) {
            const slot = resolvedSlots[index];
            const expectedBaseTime = index < level
                ? Number(slot.rawBaseTime) / 2
                : Number(slot.rawBaseTime);
            assert.equal(
                slot.effectiveBaseTime,
                expectedBaseTime,
                `slot upgrade tier ${level} should only halve base time for the first ${level} slot(s)`
            );
        }

        const requirementRows = app.engineeringPlannerRequirementRows();
        requirementRows.forEach((row, index) => {
            assert.equal(
                Number.isFinite(row.targetSpeed),
                true,
                `requirements/items tier ${level} should keep a finite target speed for slot ${index + 1}`
            );
        });

        app.engineeringPlannerState.mode = 'throughput_game';
        const throughputRows = app.engineeringPlannerRows();
        throughputRows.forEach((row, index) => {
            assert.equal(
                row.currentCapacityRatePerHour > 0,
                true,
                `in-game/items tier ${level} should keep a positive current capacity for slot ${index + 1}`
            );
        });
        app.engineeringPlannerState.mode = 'requirements';
    }
}

console.log('tools/app/engineeringPlanner.slotUpgrade.test.mjs passed');
