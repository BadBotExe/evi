export const BONUS_TYPE_ALL_SUBFILTER = '__all__';
export const BONUS_TYPE_SLOT_SUBFILTER_PREFIX = 'slot:';

export function buildBonusTypeSubfilterEntries({
    entries,
    dataCategories = [],
    defaultCategoryId,
    type,
    categoryLabel,
    categoryColor,
    itemTypeLabel,
    typeColor,
    slotLabel,
    slotColor
}) {
    const sourceEntries = entries ?? [];
    if (!sourceEntries.length) return [];

    const hasCategories = sourceEntries.some(entry => !!entry?.src?.category);
    if (!hasCategories) {
        return [...new Set(sourceEntries.map(entry => entry?.src?.slot).filter(Boolean))]
            .map(slot => ({
                id: `${BONUS_TYPE_SLOT_SUBFILTER_PREFIX}${slot}`,
                label: slotLabel(slot),
                color: slotColor(slot),
                count: sourceEntries.filter(entry => entry?.src?.slot === slot).length
            }))
            .filter(entry => entry.count > 0);
    }

    const categoryCounts = new Map();
    let uncategorizedCount = 0;

    for (const entry of sourceEntries) {
        const categoryId = entry?.src?.category;
        if (!categoryId) {
            uncategorizedCount += 1;
            continue;
        }
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    }

    const subfilters = dataCategories
        .map(category => ({
            id: category.id,
            label: category.label,
            color: category.color,
            count: categoryCounts.get(category.id) ?? 0
        }))
        .filter(entry => entry.count > 0);

    for (const [categoryId, count] of categoryCounts.entries()) {
        if (subfilters.some(entry => entry.id === categoryId)) continue;
        subfilters.push({
            id: categoryId,
            label: categoryLabel(categoryId),
            color: categoryColor(categoryId),
            count
        });
    }

    if (uncategorizedCount > 0) {
        subfilters.push({
            id: defaultCategoryId,
            label: itemTypeLabel(type),
            color: typeColor(type),
            count: uncategorizedCount
        });
    }

    return subfilters;
}

export function resolveActiveBonusTypeSubfilter(selectedId, subfilters) {
    const validIds = new Set((subfilters ?? []).map(entry => entry.id));
    return validIds.has(selectedId) ? selectedId : BONUS_TYPE_ALL_SUBFILTER;
}

export function filterBonusTypeEntries(entries, activeSubfilter, defaultCategoryId) {
    const sourceEntries = entries ?? [];
    if (!sourceEntries.length) return [];
    if (activeSubfilter === BONUS_TYPE_ALL_SUBFILTER) return sourceEntries;
    if (activeSubfilter?.startsWith(BONUS_TYPE_SLOT_SUBFILTER_PREFIX)) {
        const slotId = activeSubfilter.slice(BONUS_TYPE_SLOT_SUBFILTER_PREFIX.length);
        return sourceEntries.filter(entry => entry?.src?.slot === slotId);
    }
    if (activeSubfilter === defaultCategoryId) {
        return sourceEntries.filter(entry => !entry?.src?.category);
    }
    return sourceEntries.filter(entry => entry?.src?.category === activeSubfilter);
}

export function shouldShowBonusTypeSubfilters(isCollapsed, subfilters) {
    return !isCollapsed && (subfilters?.length ?? 0) > 1;
}
