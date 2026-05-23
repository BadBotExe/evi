function chunkEntries(entries, size) {
    const rows = [];
    const width = Math.max(1, Number(size) || 1);
    for (let index = 0; index < entries.length; index += width) {
        rows.push(entries.slice(index, index + width));
    }
    return rows;
}

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

export function buildSmithGridRows(tab, itemById, selectedItemId) {
    const items = (tab?.item_ids ?? [])
        .map(itemId => itemById[itemId] ?? null)
        .filter(Boolean)
        .map(item => ({
            item,
            isSelected: item.id === selectedItemId
        }));

    return chunkEntries(items, tab?.items_per_row);
}

export function buildSmithTabSummaries(data, activeActId) {
    return (data?.tabs ?? []).map(tab => ({
        id: tab.id,
        label: tab.label,
        isActive: tab.id === activeActId
    }));
}
