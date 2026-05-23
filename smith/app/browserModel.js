export function resolveSelectedSmithActId(data, actId) {
    const tabs = data?.tabs ?? [];
    if (tabs.some(tab => tab.id === actId)) return actId;
    return tabs[0]?.id ?? '';
}

export function resolveSelectedSmithItemId(data, itemId, fallbackActId) {
    if (itemId && data?.itemsById?.[itemId]) return itemId;
    const activeActId = resolveSelectedSmithActId(data, fallbackActId);
    const tab = (data?.tabs ?? []).find(entry => entry.id === activeActId) ?? null;
    if (!tab) return '';
    return tab.item_ids[0] ?? '';
}

export function buildSmithGridEntries(tab, itemById, selectedItemId) {
    return (tab?.item_ids ?? [])
        .map(itemId => itemById[itemId] ?? null)
        .filter(Boolean)
        .map(item => ({
            item,
            isSelected: item.id === selectedItemId
        }));
}

export function buildSmithTabSummaries(data, activeActId) {
    return (data?.tabs ?? []).map(tab => ({
        id: tab.id,
        label: tab.label,
        isActive: tab.id === activeActId
    }));
}

export function buildSmithMobileBrowseSections(data, selectedItemId) {
    return (data?.tabs ?? [])
        .map(tab => ({
            actId: tab.id,
            label: tab.label,
            entries: buildSmithGridEntries(tab, data?.itemsById, selectedItemId)
        }))
        .filter(section => section.entries.length > 0);
}
