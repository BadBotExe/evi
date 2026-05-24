import assert from 'node:assert/strict';

import {
    buildSmithData,
    loadSmithData,
    resolveBonusesCatalogUrl,
    resolveGearDataUrl,
    resolveGemShopDataUrl,
    resolveItemsDataUrl,
    resolveSmithDataUrl
} from './dataLoader.js';

const rawSmithData = {
    default_act_id: 'inf',
    tabs: [
        {
            id: 'act1',
            key: 'a1',
            label: 'Act 1',
            items: [
                { $ref: 'item:bronze_boots' },
                { $ref: 'item:copper_boots' },
                { $ref: 'item:iron_boots' },
                { $ref: 'item:steel_boots' }
            ]
        },
        {
            id: 'inf',
            key: 'if',
            label: 'Inf',
            items: [{ $ref: 'item:infinite_boots_2' }]
        },
        {
            id: 'smeltery',
            key: 'sm',
            label: 'Smeltery',
            items: [{ $ref: 'item:copper_bar' }]
        }
    ],
    recipes: {
        infinite_boots_2: {
            ingredients: [
                { $ref: 'item:sunstone_boots', quantity: 1 },
                { $ref: 'item:jotunn_eye', quantity: 1000 }
            ]
        }
    }
};

const rawItems = [
    { id: 'copper_bar', key: 'cbr', name: 'Copper Bar', icon: 'images/smeltery/copper_bar.png?v=0' },
    { id: 'bronze_boots', key: 'bbt', name: 'Bronze Boots', icon: 'images/gear/act1/bronze_boots.png?v=1' },
    { id: 'copper_boots', key: 'cbt', name: 'Copper Boots', icon: 'images/gear/act1/copper_boots.png?v=2' },
    { id: 'iron_boots', key: 'ibt', name: 'Iron Boots', icon: 'images/gear/act1/iron_boots.png?v=3' },
    { id: 'steel_boots', key: 'sbt', name: 'Steel Boots', icon: 'images/gear/act1/steel_boots.png?v=4' },
    { id: 'sunstone_boots', key: 'ubt', name: 'Sunstone Boots', icon: 'images/gear/act3/sunstone_boots.png?v=5', description: 'Drops from Act 3 Smith' },
    { id: 'jotunn_eye', name: 'Jötunn Eye', icon: 'images/materials/act2/jotunn_eye.png?v=6' },
    { id: 'infinite_boots_2', key: 'i2b', name: 'Infinity Boots II', icon: 'images/gear/hard/infinite_boots_2.png?v=7' }
];

const rawGearData = {
    bonuses: [
        {
            id: 'infinite_boots_2',
            $ref: 'item:infinite_boots_2',
            slot: 'boots',
            bonuses: [
                { bonus: 'phys_defence', unit_type: 'flat', tiers_formula: { init: 120 } },
                { bonus: 'strength', unit_type: 'flat', value: 60 },
                { bonus: 'movement_speed', unit_type: 'percent', value: 15 }
            ]
        }
    ]
};

const rawBonusesCatalog = {
    bonus_types: [
        { id: 'phys_defence', label: 'Phys. Defence' },
        { id: 'strength', label: 'STR' },
        { id: 'movement_speed', label: 'Movement Speed' }
    ]
};

const rawGemShopData = {
    bonuses: [
        {
            id: 'gem_shop_smeltery_speed',
            name: 'Smeltery Speed',
            bonuses: [
                { bonus: 'smeltery_speed', unit_type: 'multiplier', tiers_formula: { init: 1, coeff: 0.5, max_tier: 4 } }
            ]
        },
        {
            id: 'gem_shop_smeltery_multicraft',
            name: 'Smeltery Multicraft',
            bonuses: [
                { bonus: 'smeltery_multicraft', unit_type: 'percent', tiers_formula: { coeff: 50, max_tier: 4 } }
            ]
        }
    ]
};

const atlasManifest = {
    atlases: {
        'items:gear:act1': {
            path: '../items/images/gear/act1/__atlas.png?v=atlas1',
            width: 193,
            height: 430
        }
    },
    entries: {
        bronze_boots: {
            atlas: 'items:gear:act1',
            x: 8,
            y: 40,
            width: 32,
            height: 32,
            source: { root: 'items', dir: 'images/gear/act1', name: 'bronze_boots', extension: 'png' }
        }
    }
};

const data = buildSmithData(rawSmithData, rawItems, rawGearData, rawBonusesCatalog);
const atlasData = buildSmithData(rawSmithData, rawItems, rawGearData, rawBonusesCatalog, {
    atlasManifest,
    moduleUrl: 'https://example.com/smith/module.js',
    rawGemShopData
});

assert.equal(data.default_act_id, 'inf');
assert.equal(data.tabs[0].key, 'a1');
assert.equal(data.itemsById.bronze_boots.key, 'bbt');
assert.equal(data.itemsById.bronze_boots.image, '../items/images/gear/act1/bronze_boots.png?v=1');
assert.equal(data.itemsById.sunstone_boots.description, 'Drops from Act 3 Smith');
assert.deepEqual(data.tabs[1].item_ids, ['infinite_boots_2']);
assert.deepEqual(data.tabs[2].item_ids, ['copper_bar']);
assert.equal(data.recipesByItemId.infinite_boots_2.ingredients[0].item.name, 'Sunstone Boots');
assert.equal(data.recipesByItemId.infinite_boots_2.ingredients[1].quantity, 1000);
assert.equal(data.recipesByItemId.infinite_boots_2.base_time, null);
assert.equal(data.smelteryItemIds.has('copper_bar'), true);
assert.equal(data.smelteryItemIds.has('bronze_boots'), false);
assert.deepEqual(data.smelteryGemshop, {
    name: 'Gemshop Smeltery Speed',
    initMultiplier: 1,
    tierStep: 0,
    maxLevel: 0
});
assert.deepEqual(data.smelteryMulticraft, {
    name: 'Gemshop Smeltery Multicraft',
    initMultiplier: 1,
    tierStep: 0,
    maxLevel: 0
});
assert.deepEqual(atlasData.smelteryGemshop, {
    name: 'Gemshop Smeltery Speed',
    initMultiplier: 1,
    tierStep: 0.5,
    maxLevel: 4
});
assert.deepEqual(atlasData.smelteryMulticraft, {
    name: 'Gemshop Smeltery Multicraft',
    initMultiplier: 1,
    tierStep: 0.5,
    maxLevel: 4
});
assert.deepEqual(data.gearByItemId.get('infinite_boots_2').stats, [
    { id: 'phys_defence', label: 'Phys. Defence', value: '+120' },
    { id: 'strength', label: 'STR', value: '+60' },
    { id: 'movement_speed', label: 'Movement Speed', value: '+15%' }
]);
assert.deepEqual(atlasData.itemsById.bronze_boots.image, {
    kind: 'atlas',
    ref: 'bronze_boots',
    url: 'https://example.com/items/images/gear/act1/__atlas.png?v=atlas1',
    x: 8,
    y: 40,
    width: 32,
    height: 32,
    sheetWidth: 193,
    sheetHeight: 430
});

assert.throws(
    () => buildSmithData(
        {
            tabs: [{ id: 'act1', key: 'a1', label: 'Act 1', items: [{ $ref: 'item:missing_item' }] }],
            recipes: {}
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /Unknown smith item/
);

const tolerantData = buildSmithData(
    {
        tabs: [{ id: 'act1', key: 'a1', label: 'Act 1', items: [{ $ref: 'item:bronze_boots' }] }],
        recipes: {
            bronze_boots: {
                base_time: 12,
                ingredients: [
                    { $ref: 'item:missing_item', quantity: 1 },
                    { $ref: 'item:copper_boots', quantity: 0 }
                ]
            },
            missing_target: {
                ingredients: [{ $ref: 'item:bronze_boots', quantity: 1 }]
            }
        }
    },
    rawItems,
    rawGearData,
    rawBonusesCatalog
);
assert.deepEqual(tolerantData.recipesByItemId.bronze_boots.ingredients[0], {
    item_id: 'missing_item',
    quantity: 1,
    item: {
        id: 'missing_item',
        name: 'missing_item',
        image: null,
        description: ''
    }
});
assert.equal(tolerantData.recipesByItemId.bronze_boots.base_time, 12);
assert.equal(tolerantData.recipesByItemId.bronze_boots.ingredients[1].item.name, 'Copper Boots');
assert.equal(tolerantData.recipesByItemId.bronze_boots.ingredients[1].quantity, '0');
assert.equal('missing_target' in tolerantData.recipesByItemId, false);

const smelteryData = buildSmithData(
    {
        default_act_id: 'act1',
        tabs: [{ id: 'act1', key: 'a1', label: 'Act 1', items: [{ $ref: 'item:copper_bar' }] }],
        recipes: {
            copper_bar: {
                base_time: 20,
                ingredients: [{ $ref: 'item:copper_boots', quantity: 2 }]
            }
        }
    },
    rawItems,
    rawGearData,
    rawBonusesCatalog
);
assert.equal(smelteryData.recipesByItemId.copper_bar.base_time, 20);

const exampleModuleUrl = 'https://example.com/smith/module.js';
const fetchPayloads = new Map([
    [resolveSmithDataUrl(exampleModuleUrl), rawSmithData],
    [resolveItemsDataUrl(exampleModuleUrl), rawItems],
    [resolveGearDataUrl(exampleModuleUrl), rawGearData],
    [resolveGemShopDataUrl(exampleModuleUrl), rawGemShopData],
    [resolveBonusesCatalogUrl(exampleModuleUrl), rawBonusesCatalog],
    ['https://example.com/generated/image-atlas-manifest.json?v=0b94192dcd', { atlases: {}, entries: {} }]
]);

const loadedData = await loadSmithData({
    moduleUrl: exampleModuleUrl,
    fetchImpl: async (url) => ({
        ok: true,
        async json() {
            return fetchPayloads.get(url);
        }
    })
});
assert.equal(loadedData.tabs.at(-1).id, 'smeltery');
assert.equal(loadedData.tabs.at(-1).label, 'Smeltery');
assert.deepEqual(loadedData.tabs.at(-1).item_ids, ['copper_bar']);
assert.equal(loadedData.smelteryItemIds.has('copper_bar'), true);
assert.deepEqual(loadedData.smelteryGemshop, {
    name: 'Gemshop Smeltery Speed',
    initMultiplier: 1,
    tierStep: 0.5,
    maxLevel: 4
});
assert.deepEqual(loadedData.smelteryMulticraft, {
    name: 'Gemshop Smeltery Multicraft',
    initMultiplier: 1,
    tierStep: 0.5,
    maxLevel: 4
});
assert.equal(loadedData.default_act_id, 'inf');

assert.throws(
    () => buildSmithData(
        {
            tabs: [{ id: 'act1', key: 'a1', label: 'Act 1', items: [{ item: 'bronze_boots' }] }],
            recipes: {}
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /Invalid item ref in smith tab "act1"/
);

assert.throws(
    () => buildSmithData(
        {
            tabs: [{ id: 'act1', label: 'Act 1', items: [{ $ref: 'item:bronze_boots' }] }],
            recipes: {}
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /missing key/
);

assert.throws(
    () => buildSmithData(
        {
            tabs: [
                { id: 'act1', key: 'dup', label: 'Act 1', items: [{ $ref: 'item:bronze_boots' }] },
                { id: 'act2', key: 'dup', label: 'Act 2', items: [{ $ref: 'item:copper_boots' }] }
            ],
            recipes: {}
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /Duplicate smith tab key/
);

assert.match(resolveSmithDataUrl(exampleModuleUrl), /\/smith\/smith\.json\?v=/);
assert.match(resolveItemsDataUrl(exampleModuleUrl), /\/items\/items\.json\?v=/);
assert.match(resolveGearDataUrl(exampleModuleUrl), /\/bonuses\/sources\/gear\.json\?v=/);
assert.match(resolveGemShopDataUrl(exampleModuleUrl), /\/bonuses\/sources\/gem_shop\.json\?v=/);
assert.match(resolveBonusesCatalogUrl(exampleModuleUrl), /\/bonuses\/bonuses\.json\?v=/);

console.log('smith/app/dataLoader.test.mjs passed');
