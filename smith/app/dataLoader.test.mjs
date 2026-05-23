import assert from 'node:assert/strict';

import {
    buildSmithData,
    resolveBonusesCatalogUrl,
    resolveGearDataUrl,
    resolveItemsDataUrl,
    resolveSmithDataUrl
} from './dataLoader.js';

const rawSmithData = {
    default_act_id: 'inf',
    tabs: [
        {
            id: 'act1',
            label: 'Act 1',
            item_ids: ['bronze_boots', 'copper_boots', 'iron_boots', 'steel_boots']
        },
        {
            id: 'inf',
            label: 'Inf',
            item_ids: ['infinite_boots_2']
        }
    ],
    recipes: {
        infinite_boots_2: {
            ingredients: [
                { item_id: 'sunstone_boots', quantity: 1 },
                { item_id: 'jotunn_eye', quantity: 1000 }
            ]
        }
    }
};

const rawItems = [
    { id: 'bronze_boots', name: 'Bronze Boots', icon: 'images/gear/act1/bronze_boots.png?v=1' },
    { id: 'copper_boots', name: 'Copper Boots', icon: 'images/gear/act1/copper_boots.png?v=2' },
    { id: 'iron_boots', name: 'Iron Boots', icon: 'images/gear/act1/iron_boots.png?v=3' },
    { id: 'steel_boots', name: 'Steel Boots', icon: 'images/gear/act1/steel_boots.png?v=4' },
    { id: 'sunstone_boots', name: 'Sunstone Boots', icon: 'images/gear/act3/sunstone_boots.png?v=5', description: 'Drops from Act 3 Smith' },
    { id: 'jotunn_eye', name: 'Jötunn Eye', icon: 'images/materials/act2/jotunn_eye.png?v=6' },
    { id: 'infinite_boots_2', name: 'Infinity Boots II', icon: 'images/gear/hard/infinite_boots_2.png?v=7' }
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
    moduleUrl: 'https://example.com/smith/module.js'
});

assert.equal(data.default_act_id, 'inf');
assert.equal(data.itemsById.bronze_boots.image, '../items/images/gear/act1/bronze_boots.png?v=1');
assert.equal(data.itemsById.sunstone_boots.description, 'Drops from Act 3 Smith');
assert.deepEqual(data.tabs[1].item_ids, ['infinite_boots_2']);
assert.equal(data.recipesByItemId.infinite_boots_2.ingredients[0].item.name, 'Sunstone Boots');
assert.equal(data.recipesByItemId.infinite_boots_2.ingredients[1].quantity, 1000);
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
            tabs: [{ id: 'act1', label: 'Act 1', item_ids: ['missing_item'] }],
            recipes: {}
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /Unknown smith item/
);

assert.throws(
    () => buildSmithData(
        {
            tabs: [{ id: 'act1', label: 'Act 1', item_ids: ['bronze_boots'] }],
            recipes: {
                bronze_boots: {
                    ingredients: [{ item_id: 'jotunn_eye', quantity: 0 }]
                }
            }
        },
        rawItems,
        rawGearData,
        rawBonusesCatalog
    ),
    /Invalid quantity/
);

assert.match(resolveSmithDataUrl('https://example.com/smith/module.js'), /\/smith\/smith\.json\?v=/);
assert.match(resolveItemsDataUrl('https://example.com/smith/module.js'), /\/items\/items\.json\?v=/);
assert.match(resolveGearDataUrl('https://example.com/smith/module.js'), /\/bonuses\/sources\/gear\.json\?v=/);
assert.match(resolveBonusesCatalogUrl('https://example.com/smith/module.js'), /\/bonuses\/bonuses\.json\?v=/);

console.log('smith/app/dataLoader.test.mjs passed');
