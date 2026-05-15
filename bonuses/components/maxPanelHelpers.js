export function maxPanelItemBaseKey(item) {
    return `${item?.src?.id ?? ''}:${item?.tierBadge ?? item?.bonus?._tierBadgeLabel ?? ''}`;
}

export function maxPanelItemKey(item, instanceIndex = null) {
    const resolvedInstanceIndex = instanceIndex ?? item?._instanceIndex ?? null;
    const baseKey = item?._rowKey ?? maxPanelItemBaseKey(item);
    if (resolvedInstanceIndex == null) return baseKey;
    return `${maxPanelItemBaseKey(item)}:i${resolvedInstanceIndex + 1}`;
}

export function buildMaxPanelBreakdownRows(item, app, multiplier) {
    const rows = app.formatCompoundBreakdownRows({
        flat: item?.flat || null,
        percent: item?.percent || null,
        percentStages: item?.percentStages,
        multiplier
    }, app.selectedBonus, { compact: true });
    if (rows.length) return rows;
    const unitType = item?.unit_type || item?.bonus?.unit_type || 'flat';
    const zeroValue = unitType === 'multiplier' ? 1 : 0;
    return [{ text: app.formatBonusValue(zeroValue, app.selectedBonus, unitType) }];
}

export function maxPanelItemHasNodeEdits(item, hasDisabledNode = false) {
    const group = item?.bonus?._groupBonuses ?? [];
    if (group.length <= 1) return false;
    return hasDisabledNode || (item?.selectedTierBadges?.length ?? 0) > 0;
}
