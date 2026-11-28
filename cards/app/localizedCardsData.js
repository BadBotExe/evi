import { gameTerm, t, translateLabel } from '../../i18n/locale.js?v=d4fa2391a3';

const label = (group, entry, id = entry.id) => gameTerm(group, id, entry.label);

function localizeCard(card) {
    if (card.placeholder) return card;
    const name = gameTerm('card', card.id, card.name);
    const shortName = card.short_name && name?.split(',')[0];
    return {
        ...card,
        name,
        short_name: shortName || card.short_name,
        searchNames: [card.name, card.short_name, card.id.replaceAll('_', ' ')]
    };
}

export function createLocalizedCardsData(data) {
    return () => data.rebuild(({ cards, bonuses, catalog, items }) => ({
        cards: localizeCards(cards),
        bonuses,
        catalog: {
            ...catalog,
            bonus_types: catalog.bonus_types.map(stat => ({ ...stat, label: label('stat', stat) }))
        },
        items: items.map(item => ({ ...item, name: gameTerm('item', item.id, translateLabel(item.name)) }))
    }));
}

function localizeCards(cards) {
    return {
        ...cards,
        modes: cards.modes.map(mode => ({ ...mode, label: label('difficulty', mode) })),
        statDefs: cards.statDefs.map(stat => ({ ...stat, label: label('cardStat', stat, stat.key) })),
        categories: cards.categories.map(category => ({
            ...category,
            label: gameTerm('cardCategory', category.id, t(`cards.category.${category.id}`, {}, category.label)),
            cards: category.cards.map(localizeCard)
        })),
        drop_items: Object.fromEntries(Object.entries(cards.drop_items ?? {}).map(([id, item]) => [
            id,
            item.name == null ? item : { ...item, name: gameTerm('item', id, translateLabel(item.name)) }
        ]))
    };
}
