const typeFamilies = ['curio', 'pet', 'rune'];
const typeByAssetFolder = {
    cards: 'card', materials: 'material', runes: 'rune', pets: 'pet',
    gear: 'gear', usables: 'usable'
};

function itemTypes(item) {
    const categories = [item.category ?? []].flat().filter(category => !/^act\d+$/.test(category));
    const families = typeFamilies.filter(family => categories.some(category => category.startsWith(family + '_')));
    const assetType = item.id.startsWith('recipe_') ? 'recipe'
        : typeByAssetFolder[(item.icon ?? item.image)?.split('/')[1]];
    return [...new Set([...families, ...categories, ...(assetType ? [assetType] : [])])];
}

export function catalogFilterTypes(items) {
    const types = new Set(items.flatMap(item => item.types));
    return [...types].filter(type => !typeFamilies.some(family => type.startsWith(family + '_')));
}

function sourceMechanics(source, sourcesById, visited = new Set()) {
    if (!source || visited.has(source.id)) return [];
    visited.add(source.id);
    if (source.type === 'source_group') {
        return (source.source_refs ?? []).flatMap(id => sourceMechanics(sourcesById.get(id), sourcesById, visited));
    }
    const mechanic = source.mechanic ?? source.type;
    return mechanic ? [mechanic] : [];
}

function resolveSource(ref, sourcesById) {
    const entry = typeof ref === 'string' ? { ref } : ref;
    const source = sourcesById.get(entry.ref);
    if (!source) return null;
    return {
        ...source,
        modes: entry.modes ?? [],
        recipes: entry.recipes ?? source.recipes ?? [],
        during: (entry.during_refs ?? []).map(id => sourcesById.get(id)).filter(Boolean)
    };
}

function indexDrops(cardsData, itemsById, sourcesById) {
    const index = new Map();
    for (const category of cardsData.categories ?? []) {
        for (const card of category.cards ?? []) {
            if (card.placeholder) continue;
            const pond = cardsData.fishing?.ponds?.[card.id];
            const cardItem = itemsById.get(card.item_id);
            const locations = (cardItem?.source_refs ?? []).map(ref => resolveSource(ref, sourcesById))
                .filter(source => ['fishing', 'tree', 'vein', 'zone', 'boss'].includes(source?.type));
            const location = locations.length === 1 ? locations[0] : null;
            const act = location?.act ?? pond?.act ?? (Number(/^act(\d+)$/.exec(category.id)?.[1]) || null);
            const type = pond ? 'fishing' : location?.type ?? 'zone';
            const name = card.name ?? cardItem?.name?.replace(/ Card$/i, '') ?? card.id;
            for (const [mode, data] of Object.entries(card.modes ?? {})) {
                const ids = new Set((data.drops ?? []).filter(drop => drop.baseRate !== 0).map(drop => drop.item));
                if (pond) {
                    for (const id of [...Object.keys(pond.fish), ...Object.keys(pond.extra ?? {}), card.item_id, 'old_boot']) {
                        ids.add(id);
                    }
                }
                for (const id of ids) {
                    if (!itemsById.has(id)) continue;
                    if (!index.has(id)) index.set(id, new Map());
                    const drops = index.get(id);
                    if (!drops.has(card.id)) drops.set(card.id, { card, type, name, act, location, modes: [] });
                    drops.get(card.id).modes.push(mode);
                }
            }
        }
    }
    return index;
}

function indexItemBonuses(sources) {
    const byItem = new Map();
    for (const source of sources) {
        const id = source.item_id ?? source.id;
        if (!byItem.has(id)) byItem.set(id, new Set());
        for (const bonus of source.bonuses ?? []) byItem.get(id).add(bonus.bonus);
    }
    return byItem;
}

export function buildCatalog(items, sourceData, cardsData, bonusSources = []) {
    const itemsById = new Map(items.map(item => [item.id, item]));
    const sourcesById = new Map(sourceData.sources.map(source => [source.id, source]));
    const dropIndex = indexDrops(cardsData, itemsById, sourcesById);
    const bonusesByItem = indexItemBonuses(bonusSources);
    const bonusFilters = Object.entries(sourceData.mechanic_bonus_filters ?? {});
    const itemFilters = Object.entries(sourceData.mechanic_item_filters ?? {});

    return [...itemsById.values()].map(item => {
        const types = itemTypes(item);
        const sources = (item.source_refs ?? []).map(ref => resolveSource(ref, sourcesById)).filter(Boolean);
        const drops = [...(dropIndex.get(item.id)?.values() ?? [])];
        const mechanics = new Set([
            ...itemFilters.filter(([, ids]) => ids.includes(item.id)).map(([mechanic]) => mechanic),
            ...sources.flatMap(source => [source, ...source.during].flatMap(entry => sourceMechanics(entry, sourcesById))),
            ...drops.map(drop => drop.type)
        ]);
        const mechanicBonuses = new Map();
        const itemBonuses = bonusesByItem.get(item.id);
        if (itemBonuses) {
            for (const [mechanic, bonuses] of bonusFilters) {
                const matches = bonuses.filter(id => itemBonuses.has(id));
                if (!matches.length) continue;
                mechanics.add(mechanic);
                mechanicBonuses.set(mechanic, matches);
            }
        }
        return { ...item, types, sources, drops, mechanics, mechanicBonuses };
    });
}

export function catalogSourceGroups(item) {
    const groups = new Map();
    const add = (type, entry) => {
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(entry);
    };

    for (const source of item.sources) {
        const linkedDrops = source.during.length ? [] : item.drops.filter(drop => drop.location?.id === source.id);
        const coveredModes = new Set(linkedDrops.flatMap(drop => drop.modes));
        const modes = source.modes.filter(mode => !coveredModes.has(mode));
        if (linkedDrops.length && !modes.length) continue;
        add(source.type, { source, modes });
    }
    for (const drop of item.drops) {
        add(drop.type, { source: drop.location, modes: drop.modes, drop });
    }
    return groups;
}

export function filterCatalog(items, { query = '', type = '', mechanic = '', ids = [], shared = false }, names) {
    if (shared) {
        const byId = new Map(items.map(item => [item.id, item]));
        return ids.map(id => byId.get(id)).filter(Boolean);
    }
    const normalize = value => value.toLowerCase().replaceAll('ё', 'е').replaceAll('_', ' ');
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    return items.filter(item =>
        (!type || item.types.includes(type)) &&
        (!mechanic || item.mechanics.has(mechanic)) &&
        (!terms.length || terms.every(term =>
            [...names(item), item.id].some(name => normalize(name).includes(term))
        ))
    );
}

export function catalogRouteKeys(items) {
    return {
        keyById: new Map(items.map(item => [item.id, item.key])),
        idByKey: new Map(items.map(item => [item.key, item.id]))
    };
}

export function parseCatalogSearch(search, idByKey) {
    const params = new URLSearchParams(search);
    const value = params.get('i') ?? params.get('items');
    const ids = (value ?? '').split(',').map(id => id.trim()).filter(Boolean)
        .map(id => idByKey?.get(id) ?? id);
    return { shared: value !== null, ids: [...new Set(ids)] };
}

export const catalogQueryLimit = 200;

function resolveFilter(value, choices, keys) {
    return choices.find(id => id === value || (value !== null && keys?.[id] === value)) ?? '';
}

export function parseCatalogFilters(search, types, mechanics, keys) {
    const params = new URLSearchParams(search);
    const type = params.get('t');
    const mechanic = params.get('m');
    return {
        query: (params.get('q') ?? '').slice(0, catalogQueryLimit),
        type: resolveFilter(type, types, keys?.types),
        mechanic: resolveFilter(mechanic, mechanics, keys?.mechanics)
    };
}

export function catalogHref(ids = [], keyById, { query, type, mechanic, shared = false } = {}, keys) {
    const params = new URLSearchParams();
    if (query?.trim()) params.set('q', query.slice(0, catalogQueryLimit));
    const typeKey = keys ? keys.types[type] : type;
    const mechanicKey = keys ? keys.mechanics[mechanic] : mechanic;
    if (typeKey) params.set('t', typeKey);
    if (mechanicKey) params.set('m', mechanicKey);
    const itemParam = shared || ids.length
        ? 'i=' + ids.map(id => encodeURIComponent(keyById?.get(id) ?? id)).join(',')
        : '';
    const search = [itemParam, params.toString()].filter(Boolean).join('&');
    return search ? '/items?' + search : '/items';
}
