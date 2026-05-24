import {
    buildSmelteryTimingRows,
    calculateSmelteryGemshopMultiplier,
    calculateSmelteryMulticraftMultiplier,
    calculateSmelteryEffectiveTime,
    formatSmelterySeconds
} from '../../smith/app/smelteryModel.js?v=af4efceeda';

function normalizePositiveQuantity(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeNonNegativeQuantity(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function outputMultiplierForItem(itemId, smelteryItemIds, smelteryMulticraftMultiplier) {
    if (!smelteryItemIds?.has(itemId)) return 1;
    const numeric = Number(smelteryMulticraftMultiplier);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function ensureAggregateRow(map, itemId, item, recipe, smelteryItemIds) {
    if (!map.has(itemId)) {
        map.set(itemId, {
            itemId,
            item,
            recipe,
            required: 0,
            craftCount: 0,
            ownedUsed: 0,
            hasRecipe: Boolean(recipe?.ingredients?.length),
            isSmelteryItem: smelteryItemIds?.has(itemId) ?? false,
            baseTime: recipe?.base_time ?? null
        });
    }
    return map.get(itemId);
}

function decorateRequirementRow(row) {
    const required = normalizePositiveQuantity(row?.required);
    const ownedUsed = Math.min(required, normalizeNonNegativeQuantity(row?.ownedUsed));
    const missing = Math.max(0, required - ownedUsed);
    const percent = required > 0 ? Math.min(100, (ownedUsed / required) * 100) : 100;
    return {
        ...row,
        ownedUsed,
        missing,
        percent,
        percentLabel: `${Math.round(percent)}%`
    };
}

function summarizeRequirementRows(rows = []) {
    const totalRequired = rows.reduce((sum, row) => sum + normalizePositiveQuantity(row?.required), 0);
    const totalOwned = rows.reduce((sum, row) => sum + Math.min(normalizeNonNegativeQuantity(row?.ownedUsed), normalizePositiveQuantity(row?.required)), 0);
    const totalPercent = totalRequired > 0 ? Math.max(0, Math.min(100, (totalOwned / totalRequired) * 100)) : 100;
    return `${Math.round(totalPercent)}% covered`;
}

function sortRequirementRows(rows) {
    return [...rows].sort((left, right) => {
        const leftCraftable = left.hasRecipe ? 0 : 1;
        const rightCraftable = right.hasRecipe ? 0 : 1;
        if (leftCraftable !== rightCraftable) return leftCraftable - rightCraftable;
        return (left.item?.name ?? left.itemId).localeCompare(right.item?.name ?? right.itemId);
    });
}

function takeOwnedAmount(ownedState, itemId, required) {
    if (!ownedState?.remaining || !itemId) return 0;
    const needed = normalizePositiveQuantity(required);
    if (!needed) return 0;
    const available = normalizeNonNegativeQuantity(ownedState.remaining[itemId] ?? 0);
    const used = Math.min(available, needed);
    ownedState.remaining[itemId] = available - used;
    return used;
}

function decorateTreeRequirementRow(row) {
    const required = normalizeNonNegativeQuantity(row?.required);
    const ownedUsed = Math.min(required, normalizeNonNegativeQuantity(row?.ownedUsed));
    const missing = Math.max(0, required - ownedUsed);
    const percent = required > 0 ? Math.min(100, (ownedUsed / required) * 100) : 100;
    return {
        ...row,
        required,
        ownedUsed,
        missing,
        percent,
        percentLabel: `${Math.round(percent)}%`
    };
}

export function createSmithOwnedState(owned = {}) {
    const remaining = {};
    for (const [itemId, value] of Object.entries(owned ?? {})) {
        remaining[itemId] = normalizeNonNegativeQuantity(value);
    }
    return { remaining };
}

export function buildSmithRequirementPlan({
    itemId,
    quantity,
    recipesByItemId,
    itemsById,
    smelteryItemIds,
    smelteryMulticraftMultiplier,
    ownedState = null
} = {}) {
    const requiredQuantity = normalizePositiveQuantity(quantity);
    if (!itemId || !requiredQuantity) {
        return {
            itemId,
            quantity: requiredQuantity,
            rows: [],
            rowMap: new Map(),
            treeRows: [],
            summary: '100% covered'
        };
    }

    const rowMap = new Map();
    const treeRows = [];
    const visit = (currentItemId, neededQuantity, ancestry = new Set(), depth = 0, includeInTree = true, treeParentPath = null) => {
        const normalizedQuantity = normalizePositiveQuantity(neededQuantity);
        if (!currentItemId) return;

        const item = itemsById?.[currentItemId] ?? null;
        const recipe = recipesByItemId?.[currentItemId] ?? null;
        const ingredientEntries = recipe?.ingredients ?? [];
        const hasRecipe = ingredientEntries.length > 0;
        const hasCycle = ancestry.has(currentItemId);
        const aggregateRow = normalizedQuantity > 0
            ? ensureAggregateRow(rowMap, currentItemId, item, recipe, smelteryItemIds)
            : null;
        if (aggregateRow) {
            aggregateRow.required += normalizedQuantity;
        }
        const ownedUsed = normalizedQuantity > 0 ? takeOwnedAmount(ownedState, currentItemId, normalizedQuantity) : 0;
        if (aggregateRow) {
            aggregateRow.ownedUsed += ownedUsed;
        }
        const missingQuantity = Math.max(0, normalizedQuantity - ownedUsed);
        const rowPath = `${depth}:${treeRows.length}:${currentItemId}`;

        if (includeInTree) {
            treeRows.push(decorateTreeRequirementRow({
                path: rowPath,
                parentPath: treeParentPath,
                itemId: currentItemId,
                item,
                recipe,
                required: normalizedQuantity,
                ownedUsed,
                hasRecipe,
                hasChildren: hasRecipe && !hasCycle,
                depth
            }));
        }

        if (!hasRecipe || hasCycle) return;

        const outputMultiplier = outputMultiplierForItem(
            currentItemId,
            smelteryItemIds,
            smelteryMulticraftMultiplier
        );
        const craftCount = missingQuantity / outputMultiplier;
        if (aggregateRow) {
            aggregateRow.craftCount += craftCount;
        }

        const nextAncestry = new Set(ancestry);
        nextAncestry.add(currentItemId);

        for (const ingredient of recipe.ingredients) {
            const ingredientQuantity = normalizePositiveQuantity(ingredient?.quantity);
            if (!ingredientQuantity) continue;
            visit(
                ingredient.item_id,
                ingredientQuantity * craftCount,
                nextAncestry,
                depth + 1,
                true,
                includeInTree ? rowPath : treeParentPath
            );
        }
    };

    visit(itemId, requiredQuantity, new Set(), 0, false, null);
    const rows = sortRequirementRows([...rowMap.values()].map(decorateRequirementRow));

    return {
        itemId,
        quantity: requiredQuantity,
        rowMap,
        rows,
        treeRows,
        summary: summarizeRequirementRows(rows)
    };
}

export function combineSmithRequirementPlans(plans = []) {
    const combinedMap = new Map();
    for (const plan of plans) {
        for (const row of plan?.rows ?? []) {
            const aggregateRow = ensureAggregateRow(
                combinedMap,
                row.itemId,
                row.item,
                row.recipe,
                new Set(row.isSmelteryItem ? [row.itemId] : [])
            );
            aggregateRow.required += row.required;
            aggregateRow.craftCount += row.craftCount;
            aggregateRow.ownedUsed += normalizeNonNegativeQuantity(row.ownedUsed);
            aggregateRow.hasRecipe = row.hasRecipe;
            aggregateRow.isSmelteryItem = row.isSmelteryItem;
            aggregateRow.baseTime = row.baseTime;
        }
    }
    return sortRequirementRows([...combinedMap.values()].map(decorateRequirementRow));
}

export function excludeSelectedSmithRecipeRows(rows = [], selectedItemIds = []) {
    const selectedIds = new Set(
        (selectedItemIds ?? []).filter(itemId => typeof itemId === 'string' && itemId)
    );
    if (!selectedIds.size) return [...rows];
    return rows.filter(row => !selectedIds.has(row?.itemId));
}

export function preserveCombinedRequirementRows(baseRows = [], effectiveRows = []) {
    const baseIds = new Set();
    const effectiveById = new Map(
        (effectiveRows ?? []).map(row => [row?.itemId, row]).filter(([itemId]) => typeof itemId === 'string' && itemId)
    );
    const mergedRows = [];

    for (const baseRow of baseRows ?? []) {
        const itemId = baseRow?.itemId;
        if (typeof itemId !== 'string' || !itemId) continue;
        baseIds.add(itemId);
        const effectiveRow = effectiveById.get(itemId);
        if (effectiveRow) {
            mergedRows.push({
                ...baseRow,
                ...effectiveRow,
                item: effectiveRow.item ?? baseRow.item,
                recipe: effectiveRow.recipe ?? baseRow.recipe
            });
            continue;
        }
        mergedRows.push(decorateRequirementRow({
            ...baseRow,
            required: 0,
            craftCount: 0,
            ownedUsed: 0
        }));
    }

    for (const effectiveRow of effectiveRows ?? []) {
        const itemId = effectiveRow?.itemId;
        if (typeof itemId !== 'string' || !itemId || baseIds.has(itemId)) continue;
        mergedRows.push(effectiveRow);
    }

    return sortRequirementRows(mergedRows);
}

export function preservePerItemTreeRows(baseRows = [], effectiveRows = []) {
    const effectiveByPath = new Map(
        (effectiveRows ?? [])
            .map(row => [row?.path, row])
            .filter(([path]) => typeof path === 'string' && path)
    );

    return (baseRows ?? []).map(baseRow => {
        const effectiveRow = effectiveByPath.get(baseRow?.path);
        if (effectiveRow) {
            return {
                ...baseRow,
                ...effectiveRow,
                item: effectiveRow.item ?? baseRow.item,
                recipe: effectiveRow.recipe ?? baseRow.recipe,
                parentPath: effectiveRow.parentPath ?? baseRow.parentPath,
                hasChildren: effectiveRow.hasChildren ?? baseRow.hasChildren
            };
        }
        return decorateTreeRequirementRow({
            ...baseRow,
            required: 0,
            ownedUsed: 0
        });
    });
}

export function applyOwnedAmounts(rows = [], owned = {}) {
    return rows.map(row => {
        const ownedAmount = normalizePositiveQuantity(owned?.[row.itemId] ?? 0);
        const missing = Math.max(0, row.required - ownedAmount);
        const percent = row.required > 0 ? Math.min(100, (ownedAmount / row.required) * 100) : 100;
        return {
            ...row,
            owned: ownedAmount,
            missing,
            percent,
            percentLabel: `${Math.round(percent)}%`
        };
    });
}

export function allocateOwnedAmounts(plans = [], owned = {}) {
    const remaining = Object.fromEntries(
        Object.entries(owned ?? {}).map(([itemId, value]) => [itemId, normalizePositiveQuantity(value)])
    );

    return plans.map(plan => {
        const rows = plan.rows.map(row => {
            const available = normalizePositiveQuantity(remaining[row.itemId] ?? 0);
            const ownedUsed = Math.min(available, row.required);
            remaining[row.itemId] = available - ownedUsed;
            const missing = Math.max(0, row.required - ownedUsed);
            const percent = row.required > 0 ? Math.min(100, (ownedUsed / row.required) * 100) : 100;
            return {
                ...row,
                ownedUsed,
                missing,
                percent,
                percentLabel: `${Math.round(percent)}%`
            };
        });

        const totalRequired = rows.reduce((sum, row) => sum + row.required, 0);
        const totalMissing = rows.reduce((sum, row) => sum + row.missing, 0);
        const totalPercent = totalRequired > 0 ? Math.max(0, Math.min(100, ((totalRequired - totalMissing) / totalRequired) * 100)) : 100;

        return {
            plan,
            rows: sortRequirementRows(rows),
            summary: `${Math.round(totalPercent)}% covered`
        };
    });
}

export function buildSmithTimingRows(rows = [], {
    smelterySpeedPercent = 0,
    smelteryGemshopLevel = 0,
    smelteryGemshopConfig = null
} = {}) {
    const gemshopMultiplier = calculateSmelteryGemshopMultiplier(
        smelteryGemshopLevel,
        smelteryGemshopConfig ?? {}
    );

    return rows
        .filter(row => row.hasRecipe && row.baseTime != null && row.craftCount > 0)
        .map(row => {
            const effectiveTime = calculateSmelteryEffectiveTime(
                row.baseTime,
                smelterySpeedPercent,
                gemshopMultiplier
            );
            const totalSeconds = Number.isFinite(effectiveTime) ? effectiveTime * row.craftCount : null;
            return {
                ...row,
                totalSeconds,
                totalTimeLabel: totalSeconds == null ? 'Not available' : formatSmelterySeconds(totalSeconds),
                timingRows: buildSmelteryTimingRows(
                    { base_time: row.baseTime },
                    smelterySpeedPercent,
                    gemshopMultiplier
                ),
                requiredQuantity: row.required
            };
        })
        .sort((left, right) => (left.item?.name ?? left.itemId).localeCompare(right.item?.name ?? right.itemId));
}

export function resolveSmelteryMulticraftMultiplier(level, config) {
    return calculateSmelteryMulticraftMultiplier(level, config ?? {});
}
