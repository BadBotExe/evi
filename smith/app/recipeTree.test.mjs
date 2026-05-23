import assert from 'node:assert/strict';

import {
    buildFlattenedSmithRecipeRows,
    buildSmithRecipeTree,
    hasSmithRecipe
} from './recipeTree.js';

const itemsById = {
    item_1: { id: 'item_1', name: 'Item 1' },
    item_2: { id: 'item_2', name: 'Item 2' },
    item_3: { id: 'item_3', name: 'Item 3' },
    item_4: { id: 'item_4', name: 'Item 4' },
    item_5: { id: 'item_5', name: 'Item 5' }
};

const recipesByItemId = {
    item_1: {
        item_id: 'item_1',
        ingredients: [
            { item_id: 'item_2', quantity: 5, item: itemsById.item_2 },
            { item_id: 'item_5', quantity: 7, item: itemsById.item_5 }
        ]
    },
    item_2: {
        item_id: 'item_2',
        ingredients: [
            { item_id: 'item_3', quantity: 3, item: itemsById.item_3 },
            { item_id: 'item_4', quantity: 2, item: itemsById.item_4 }
        ]
    },
    item_4: {
        item_id: 'item_4',
        ingredients: [
            { item_id: 'item_3', quantity: 11, item: itemsById.item_3 }
        ]
    }
};

assert.equal(hasSmithRecipe(recipesByItemId, 'item_1'), true);
assert.equal(hasSmithRecipe(recipesByItemId, 'item_3'), false);

const collapsedRows = buildFlattenedSmithRecipeRows({
    itemId: 'item_1',
    recipesByItemId,
    itemsById,
    expandedPaths: new Set()
});

assert.deepEqual(
    collapsedRows.map(row => ({
        item_id: row.item_id,
        depth: row.depth,
        effectiveQuantity: row.effectiveQuantity,
        canExpand: row.canExpand,
        isExpanded: row.isExpanded
    })),
    [
        { item_id: 'item_2', depth: 0, effectiveQuantity: 5, canExpand: true, isExpanded: false },
        { item_id: 'item_5', depth: 0, effectiveQuantity: 7, canExpand: false, isExpanded: false }
    ]
);

const expandedFirstLevel = buildFlattenedSmithRecipeRows({
    itemId: 'item_1',
    recipesByItemId,
    itemsById,
    expandedPaths: new Set(['item_1/0:item_2'])
});

assert.deepEqual(
    expandedFirstLevel.map(row => ({
        item_id: row.item_id,
        depth: row.depth,
        effectiveQuantity: row.effectiveQuantity,
        path: row.path
    })),
    [
        { item_id: 'item_2', depth: 0, effectiveQuantity: 5, path: 'item_1/0:item_2' },
        { item_id: 'item_3', depth: 1, effectiveQuantity: 15, path: 'item_1/0:item_2/0:item_3' },
        { item_id: 'item_4', depth: 1, effectiveQuantity: 10, path: 'item_1/0:item_2/1:item_4' },
        { item_id: 'item_5', depth: 0, effectiveQuantity: 7, path: 'item_1/1:item_5' }
    ]
);

const expandedNested = buildFlattenedSmithRecipeRows({
    itemId: 'item_1',
    recipesByItemId,
    itemsById,
    expandedPaths: new Set([
        'item_1/0:item_2',
        'item_1/0:item_2/1:item_4'
    ])
});

assert.deepEqual(
    expandedNested.map(row => ({
        item_id: row.item_id,
        depth: row.depth,
        effectiveQuantity: row.effectiveQuantity,
        path: row.path
    })),
    [
        { item_id: 'item_2', depth: 0, effectiveQuantity: 5, path: 'item_1/0:item_2' },
        { item_id: 'item_3', depth: 1, effectiveQuantity: 15, path: 'item_1/0:item_2/0:item_3' },
        { item_id: 'item_4', depth: 1, effectiveQuantity: 10, path: 'item_1/0:item_2/1:item_4' },
        { item_id: 'item_3', depth: 2, effectiveQuantity: 110, path: 'item_1/0:item_2/1:item_4/0:item_3' },
        { item_id: 'item_5', depth: 0, effectiveQuantity: 7, path: 'item_1/1:item_5' }
    ]
);

const cycleRecipesByItemId = {
    item_1: {
        item_id: 'item_1',
        ingredients: [{ item_id: 'item_2', quantity: 2, item: itemsById.item_2 }]
    },
    item_2: {
        item_id: 'item_2',
        ingredients: [{ item_id: 'item_1', quantity: 3, item: itemsById.item_1 }]
    }
};

const cycleTree = buildSmithRecipeTree({
    itemId: 'item_1',
    recipesByItemId: cycleRecipesByItemId,
    itemsById,
    expandedPaths: new Set(['item_1/0:item_2'])
});

assert.equal(cycleTree[0].canExpand, true);
assert.equal(cycleTree[0].children[0].item_id, 'item_1');
assert.equal(cycleTree[0].children[0].effectiveQuantity, 6);
assert.equal(cycleTree[0].children[0].canExpand, false);
assert.equal(cycleTree[0].children[0].hasCycle, true);

console.log('smith/app/recipeTree.test.mjs passed');
