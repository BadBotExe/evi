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

export function hasSmithRecipe(recipesByItemId, itemId) {
    return (recipesByItemId?.[itemId]?.ingredients?.length ?? 0) > 0;
}

export function buildSmithRecipeTree({
    itemId,
    recipesByItemId,
    itemsById,
    expandedPaths = new Set()
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
                parentMultiplier: normalizeRecipeMultiplier(effectiveQuantity),
                recipesByItemId,
                itemsById,
                expandedPaths,
                ancestry: nextAncestry
            }))
            : []
    };
}
