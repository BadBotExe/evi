function isFiniteRecipeQuantity(value) {
    return Number.isFinite(value) && value > 0;
}

function normalizeRecipeMultiplier(value) {
    return isFiniteRecipeQuantity(Number(value)) ? Number(value) : null;
}

function multiplyRecipeQuantities(parentMultiplier, directQuantity) {
    const normalizedDirectQuantity = normalizeRecipeMultiplier(directQuantity);
    if (normalizedDirectQuantity == null) return directQuantity;
    if (parentMultiplier == null) return normalizedDirectQuantity;
    return parentMultiplier * normalizedDirectQuantity;
}

function createRecipePath(parentPath, itemId, index) {
    return `${parentPath}/${index}:${itemId || 'unknown'}`;
}

function resolveSmelteryOutputMultiplier(itemId, smelteryItemIds, smelteryMulticraftMultiplier) {
    if (!smelteryItemIds?.has(itemId)) return 1;
    return isFiniteRecipeQuantity(Number(smelteryMulticraftMultiplier)) ? Number(smelteryMulticraftMultiplier) : 1;
}

export function hasSmithRecipe(recipesByItemId, itemId) {
    return (recipesByItemId?.[itemId]?.ingredients?.length ?? 0) > 0;
}

export function buildSmithRecipeTree({
    itemId,
    recipesByItemId,
    itemsById,
    expandedPaths = new Set(),
    smelteryItemIds = new Set(),
    smelteryMulticraftMultiplier = 1
} = {}) {
    const rootRecipe = recipesByItemId?.[itemId] ?? null;
    if (!rootRecipe) return [];

    return (rootRecipe.ingredients ?? []).map((entry, index) => buildSmithRecipeNode({
        entry,
        depth: 0,
        parentPath: itemId || 'root',
        index,
        parentMultiplier: 1,
        recipesByItemId,
        itemsById,
        expandedPaths,
        smelteryItemIds,
        smelteryMulticraftMultiplier,
        ancestry: new Set([itemId])
    }));
}

export function flattenSmithRecipeTree(nodes) {
    const rows = [];

    for (const node of nodes ?? []) {
        rows.push(node);
        if (node.isExpanded && node.children.length > 0) {
            rows.push(...flattenSmithRecipeTree(node.children));
        }
    }

    return rows;
}

export function buildFlattenedSmithRecipeRows(options = {}) {
    return flattenSmithRecipeTree(buildSmithRecipeTree(options));
}

function buildSmithRecipeNode({
    entry,
    depth,
    parentPath,
    index,
    parentMultiplier,
    recipesByItemId,
    itemsById,
    expandedPaths,
    smelteryItemIds,
    smelteryMulticraftMultiplier,
    ancestry
}) {
    const itemId = entry?.item_id ?? '';
    const path = createRecipePath(parentPath, itemId, index);
    const item = itemsById?.[itemId] ?? entry?.item ?? null;
    const directQuantity = entry?.quantity ?? '';
    const effectiveQuantity = multiplyRecipeQuantities(parentMultiplier, directQuantity);
    const hasRecipe = hasSmithRecipe(recipesByItemId, itemId);
    const hasCycle = ancestry.has(itemId);
    const canExpand = hasRecipe && !hasCycle;
    const isExpanded = canExpand && expandedPaths.has(path);
    const nextAncestry = new Set(ancestry);
    const nextParentMultiplier = normalizeRecipeMultiplier(effectiveQuantity);
    const outputMultiplier = resolveSmelteryOutputMultiplier(itemId, smelteryItemIds, smelteryMulticraftMultiplier);
    nextAncestry.add(itemId);

    return {
        item_id: itemId,
        item,
        directQuantity,
        effectiveQuantity,
        depth,
        path,
        canExpand,
        isExpanded,
        hasCycle,
        children: isExpanded
            ? (recipesByItemId?.[itemId]?.ingredients ?? []).map((ingredient, ingredientIndex) => buildSmithRecipeNode({
                entry: ingredient,
                depth: depth + 1,
                parentPath: path,
                index: ingredientIndex,
                parentMultiplier: nextParentMultiplier == null ? nextParentMultiplier : nextParentMultiplier / outputMultiplier,
                recipesByItemId,
                itemsById,
                expandedPaths,
                smelteryItemIds,
                smelteryMulticraftMultiplier,
                ancestry: nextAncestry
            }))
            : []
    };
}
