export function buildCardIndex(data) {
    const cardIndex = {};
    for (const category of data.categories ?? []) {
        for (const card of category.cards ?? []) {
            cardIndex[card.id] = { card, cat: category };
        }
    }
    return cardIndex;
}

export function resolveCardField(field, modeData, card, category, modeId) {
    return modeData[field] ?? card[field] ?? category.modes?.[modeId]?.[field] ?? category[field] ?? null;
}

export function resolveCardFooter(modeData, card, category, modeId) {
    return modeData.footer ?? card.footer ?? category.modes?.[modeId]?.footer ?? category.footer ?? [];
}

export function resolveItemReference(items, ref) {
    const base = ref.item ? (items?.[ref.item] ?? {}) : {};
    return { ...base, ...ref };
}

export function countCardsForBonus(categories, bonusId) {
    let count = 0;
    for (const category of categories ?? []) {
        for (const card of category.cards ?? []) {
            if (!card.placeholder && card.bonus_type === bonusId) count++;
        }
    }
    return count;
}

export function findFirstCardForMode(categories, modeId, predicate = () => true) {
    for (const category of categories ?? []) {
        for (const card of category.cards ?? []) {
            if (card.modes?.[modeId] && predicate(card)) return card;
        }
    }
    return null;
}

export function resolveActiveModeId(data, requestedMode) {
    if (requestedMode && data.modes.find(mode => mode.id === requestedMode)) {
        return requestedMode;
    }
    return data.modes?.[0]?.id ?? 'normal';
}

export function resolveSelectedCardId(data, cardIndex, requestedCard) {
    if (requestedCard && cardIndex[requestedCard]) {
        return requestedCard;
    }
    return data.categories?.[0]?.cards.find(card => !card.placeholder)?.id ?? null;
}

export function buildFooterItems(modeData, footerItemsRef) {
    if (footerItemsRef.length) return footerItemsRef;
    return [
        { image: null, color: '#c8a020', value: modeData.gold },
        { image: null, color: '#8040cc', value: modeData.exp }
    ].filter(item => item.value != null);
}
