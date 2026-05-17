export function normalizeCardSearchQuery(rawQuery) {
    return String(rawQuery ?? '').toLowerCase().trim();
}

export function matchesCardSearchQuery(card, query) {
    if (!query) return true;
    return (card.name || '').toLowerCase().includes(query) || (card.short_name || '').toLowerCase().includes(query);
}

export function cardMatchesBrowserFilters(card, activeFilters, query) {
    if (card.placeholder) return false;
    if (activeFilters.size > 0 && !activeFilters.has(card.bonus_type)) return false;
    return matchesCardSearchQuery(card, query);
}

export function buildDesktopBrowserSections(categories, { activeFilters, query, selectedId }) {
    const sections = [];
    const filterActive = activeFilters.size > 0;

    for (const category of categories ?? []) {
        const realMatching = (category.cards ?? []).filter(card => cardMatchesBrowserFilters(card, activeFilters, query));
        if ((filterActive || query) && realMatching.length === 0) continue;

        const entries = [];
        for (const card of category.cards ?? []) {
            if (card.placeholder) {
                if (!filterActive && !query) entries.push({ kind: 'placeholder' });
                continue;
            }
            if (!cardMatchesBrowserFilters(card, activeFilters, query)) continue;
            entries.push({
                kind: 'card',
                card,
                isSelected: card.id === selectedId
            });
        }

        sections.push({
            label: category.label,
            entries
        });
    }

    return {
        sections,
        showEmptyMessage: sections.length === 0 && Boolean(query)
    };
}

export function buildMobileBrowserSections(categories, { activeFilters, query, selectedId }) {
    const sections = [];

    for (const category of categories ?? []) {
        const cards = (category.cards ?? []).filter(card => cardMatchesBrowserFilters(card, activeFilters, query));
        if (cards.length === 0) continue;

        sections.push({
            label: category.label,
            entries: cards.map(card => ({
                card,
                isSelected: card.id === selectedId
            }))
        });
    }

    return {
        sections,
        showEmptyMessage: sections.length === 0 && Boolean(query)
    };
}
