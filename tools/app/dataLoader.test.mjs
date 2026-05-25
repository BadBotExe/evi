import assert from 'node:assert/strict';

import { ToolsDataLoader } from './dataLoader.js';

function createResponse(jsonValue) {
    return {
        async json() {
            return jsonValue;
        }
    };
}

const bonusesData = {
    tiers_formula: null,
    categories: [],
    types: {}
};

const engineeringFile = {
    type: 'engineering_production',
    tiers_formula: {
        type: 'linear',
        label_prefix: 'Level'
    },
    planner: {
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
    },
    bonuses: []
};

const gemShopFile = {
    type: 'gem_shop',
    tiers_formula: {
        type: 'linear',
        label_prefix: 'Tier'
    },
    bonuses: [
        {
            id: 'gem_shop_engineer_slot_upgrade',
            name: 'Engineer Slot Upgrade',
            bonuses: [
                { bonus: 'engineer_production_speed', unit_type: 'multiplier', value: 2 }
            ],
            enhancement: {
                segments: [
                    {
                        costs: [
                            {
                                item: 'gem',
                                amount: {
                                    type: 'table',
                                    values: [150, 250, 350, 500]
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ]
};

const itemsData = [];

{
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        const target = String(url);
        if (target.includes('bonuses.json')) return createResponse(bonusesData);
        if (target.includes('engineering_production.json')) return createResponse(engineeringFile);
        if (target.includes('gem_shop.json')) return createResponse(gemShopFile);
        if (target.includes('items.json')) return createResponse(itemsData);
        throw new Error(`Unexpected fetch: ${target}`);
    };

    const app = {
        engineeringPlannerState: {},
        data: null,
        engineeringPlannerSlotUpgrade() {
            const config = this.data?.engineeringPlanner?.slot_upgrade;
            if (!config?.source_id) return null;
            const src = this.data?.sources?.find(source => source.id === config.source_id) ?? null;
            if (!src) return null;
            const multiplier = Number(src.bonuses?.find(b => b.bonus === 'engineer_production_speed' && b.unit_type === 'multiplier')?.value ?? 1);
            const maxLevel = Math.max(
                Number(src.enhancement?.max_level ?? 0),
                ...((src.bonuses ?? []).map(b => Number(b.tiers_formula?.max_tier ?? 0))),
                ...((src.enhancement?.segments ?? []).flatMap(segment =>
                    (segment.costs ?? []).map(cost => Array.isArray(cost.amount?.values) ? cost.amount.values.length : 0)
                ))
            );
            return {
                sourceId: config.source_id,
                defaultLevel: Number(config.default_level ?? 0),
                name: src.name,
                multiplier,
                maxLevel
            };
        }
    };

    const loader = new ToolsDataLoader(app);
    await loader.load();

    assert.equal(
        app.engineeringPlannerSlotUpgrade()?.multiplier,
        2,
        'engineer slot upgrade should keep its explicit multiplier instead of inheriting an empty file-level tier formula'
    );
    assert.equal(
        app.engineeringPlannerSlotUpgrade()?.maxLevel,
        4,
        'engineer slot upgrade should still infer its max tier from gem cost table length'
    );

    globalThis.fetch = originalFetch;
}

console.log('tools/app/dataLoader.test.mjs passed');
