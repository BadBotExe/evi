import assert from 'node:assert/strict';

import {
    buildSelectedSmithDependencyRows,
    buildSmithRequirementPlan,
    buildSmithTimingRows,
    combineSmithRequirementPlans,
    createSmithOwnedState,
    preservePerItemTreeRows,
    preserveCombinedRequirementRows,
    replaceSelectedSmithRecipeRows
} from './smithCalculator.js';

const itemsById = {
    bar: { id: 'bar', name: 'Bar' },
    ore: { id: 'ore', name: 'Ore' },
    coal: { id: 'coal', name: 'Coal' },
    sword: { id: 'sword', name: 'Sword' },
    mega: { id: 'mega', name: 'Mega' }
};

const recipesByItemId = {
    bar: {
        item_id: 'bar',
        base_time: 10,
        ingredients: [
            { item_id: 'ore', quantity: 3, item: itemsById.ore },
            { item_id: 'coal', quantity: 1, item: itemsById.coal }
        ]
    },
    sword: {
        item_id: 'sword',
        ingredients: [
            { item_id: 'bar', quantity: 2, item: itemsById.bar }
        ]
    },
    mega: {
        item_id: 'mega',
        ingredients: [
            { item_id: 'ore', quantity: 1000000, item: itemsById.ore }
        ]
    }
};

const smelteryItemIds = new Set(['bar']);

{
    const swordPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });

    assert.equal(swordPlan.rows.find(row => row.itemId === 'sword').required, 3);
    assert.equal(swordPlan.rows.find(row => row.itemId === 'bar').required, 6);
    assert.equal(swordPlan.rows.find(row => row.itemId === 'bar').craftCount, 3, 'smeltery multicraft halves required bar crafts');
    assert.equal(swordPlan.rows.find(row => row.itemId === 'ore').required, 9);
}

{
    const swordPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 2,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const barPlan = buildSmithRequirementPlan({
        itemId: 'bar',
        quantity: 4,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const combined = combineSmithRequirementPlans([swordPlan, barPlan]);

    assert.equal(combined.find(row => row.itemId === 'ore').required, 12);
    assert.equal(combined.find(row => row.itemId === 'ore').missing, 12);
}

{
    const swordPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 2,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const combined = combineSmithRequirementPlans([swordPlan]);

    const filtered = replaceSelectedSmithRecipeRows(
        combined,
        [swordPlan.itemId],
        buildSelectedSmithDependencyRows([swordPlan])
    );

    assert.equal(filtered.some(row => row.itemId === 'sword'), false, 'combined rows should hide a selected final recipe when nothing else requires it');
    assert.equal(filtered.find(row => row.itemId === 'bar').required, 4, 'combined rows should keep intermediate craft rows');
    assert.equal(filtered.find(row => row.itemId === 'ore').required, 6, 'combined rows should keep ingredient rows');
}

{
    const swordPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 2,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const barPlan = buildSmithRequirementPlan({
        itemId: 'bar',
        quantity: 4,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const combined = combineSmithRequirementPlans([swordPlan, barPlan]);
    const filtered = replaceSelectedSmithRecipeRows(
        combined,
        [swordPlan.itemId, barPlan.itemId],
        buildSelectedSmithDependencyRows([swordPlan, barPlan])
    );

    assert.equal(filtered.some(row => row.itemId === 'sword'), false, 'combined rows should hide a selected root item that is not required by another selected item');
    assert.equal(filtered.some(row => row.itemId === 'bar'), true, 'combined rows should keep a selected item when another selected item requires it');
    assert.equal(filtered.find(row => row.itemId === 'bar').required, 4, 'combined rows should keep the selected dependency only at the quantity required by another selected item');
    assert.equal(filtered.find(row => row.itemId === 'ore').required, 12, 'combined rows should keep aggregated ingredient rows');
}

{
    const ownedState = createSmithOwnedState({ ore: 9 });
    const swordPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 2,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2,
        ownedState
    });
    const barPlan = buildSmithRequirementPlan({
        itemId: 'bar',
        quantity: 4,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2,
        ownedState
    });

    assert.equal(swordPlan.rows.find(row => row.itemId === 'ore').ownedUsed, 6, 'top row consumes shared stock first');
    assert.equal(barPlan.rows.find(row => row.itemId === 'ore').ownedUsed, 3, 'remaining stock passes to later rows');
}

{
    const plan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2,
        ownedState: createSmithOwnedState({ bar: 6 })
    });

    assert.equal(plan.rows.find(row => row.itemId === 'bar').ownedUsed, 6, 'owned craftable items satisfy their own row first');
    assert.equal(plan.rows.find(row => row.itemId === 'bar').missing, 0, 'owned craftable items stop additional crafting for that row');
    assert.equal(plan.rows.some(row => row.itemId === 'ore'), false, 'owned craftable items suppress their ingredient subtree in aggregate rows');
    assert.equal(plan.treeRows.some(row => row.itemId === 'ore'), true, 'per-item tree rows should keep child entries visible even when owned craftable items fully cover the parent');
    assert.equal(plan.treeRows.find(row => row.itemId === 'ore').required, 0, 'covered per-item child rows should remain visible at zero required');
}

{
    const basePlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const ownedPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2,
        ownedState: createSmithOwnedState({ bar: 6 })
    });
    const mergedTree = preservePerItemTreeRows(basePlan.treeRows, ownedPlan.treeRows);

    assert.equal(mergedTree.find(row => row.itemId === 'bar').missing, 0, 'per-item rows should keep the covered intermediate row at zero needed');
    assert.equal(mergedTree.find(row => row.itemId === 'ore').required, 0, 'per-item rows should keep suppressed child rows visible at zero required');
    assert.equal(mergedTree.find(row => row.itemId === 'ore').percentLabel, '100%', 'per-item rows should show fully covered suppressed child rows as 100%');
    assert.equal(mergedTree.find(row => row.itemId === 'bar').hasChildren, true, 'per-item rows should mark craftable rows as collapsable tree nodes');
}

{
    const basePlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const ownedPlan = buildSmithRequirementPlan({
        itemId: 'sword',
        quantity: 3,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2,
        ownedState: createSmithOwnedState({ bar: 6 })
    });
    const combined = preserveCombinedRequirementRows(basePlan.rows, ownedPlan.rows);

    assert.equal(combined.find(row => row.itemId === 'bar').required, 6, 'combined rows should keep the covered intermediate row visible');
    assert.equal(combined.find(row => row.itemId === 'bar').missing, 0, 'covered intermediate row should show zero needed');
    assert.equal(combined.find(row => row.itemId === 'ore').required, 0, 'combined rows should reduce child required to zero when parent stock fully covers it');
    assert.equal(combined.find(row => row.itemId === 'ore').missing, 0, 'combined rows should keep child rows visible with zero needed');
    assert.equal(combined.find(row => row.itemId === 'coal').required, 0, 'combined rows should preserve every suppressed child row at zero required');
}

{
    const plan = buildSmithRequirementPlan({
        itemId: 'mega',
        quantity: 1,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 1,
        ownedState: createSmithOwnedState({ ore: 999999 })
    });

    const row = plan.rows.find(entry => entry.itemId === 'ore');
    const treeRow = plan.treeRows.find(entry => entry.itemId === 'ore');

    assert.equal(row.missing, 1, 'nearly covered combined rows should keep the exact remaining quantity');
    assert.equal(row.isComplete, false, 'nearly covered combined rows should not be marked complete');
    assert.equal(row.percentLabel, '99%', 'nearly covered combined rows should not round up to 100%');
    assert.equal(treeRow.missing, 1, 'nearly covered per-item rows should keep the exact remaining quantity');
    assert.equal(treeRow.isComplete, false, 'nearly covered per-item rows should not be marked complete');
    assert.equal(treeRow.percentLabel, '99%', 'nearly covered per-item rows should not round up to 100%');
    assert.equal(plan.summary, '99% covered', 'nearly covered summaries should not round up to 100% covered');
}

{
    const plan = buildSmithRequirementPlan({
        itemId: 'bar',
        quantity: 6,
        recipesByItemId,
        itemsById,
        smelteryItemIds,
        smelteryMulticraftMultiplier: 2
    });
    const timingRows = buildSmithTimingRows(plan.rows, {
        smelterySpeedPercent: 100,
        smelteryGemshopLevel: 0,
        smelteryGemshopConfig: { initMultiplier: 1, tierStep: 0, maxLevel: 0 }
    });

    assert.equal(timingRows[0].itemId, 'bar');
    assert.equal(timingRows[0].craftCount, 3);
    assert.equal(timingRows[0].outputQuantity, 6);
    assert.equal(timingRows[0].totalTimeLabel, '15s');
}

console.log('tools/lib/smithCalculator.test.mjs passed');
