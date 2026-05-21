function mapItemAssetPath(assetPath) {
    if (typeof assetPath !== 'string') return null;
    const trimmed = assetPath.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('images/')) return `../items/${trimmed}`;
    return trimmed;
}

function normalizeBonusId(bonusId) {
    if (typeof bonusId !== 'string') return '';
    const trimmed = bonusId.trim();
    if (!trimmed) return '';
    if (trimmed.toLowerCase() === 'nothing') return 'nothing';
    return trimmed;
}

function resolveBonusLabel(bonusTypesById, bonusId) {
    if (bonusId === 'nothing') return 'Nothing';
    return bonusTypesById.get(bonusId)?.label ?? bonusId;
}

function resolveItemIdFromRef(ref) {
    if (typeof ref !== 'string') return null;
    return ref.startsWith('item:') ? ref.slice(5) : null;
}

function resolveLocalRef(root, ref) {
    if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
    return ref
        .slice(2)
        .split('/')
        .reduce((value, segment) => value?.[segment], root);
}

function formatBonusNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? '');
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toFixed(2).replace(/\.?0+$/, '');
}

function resolveFormulaValue(formula, starIndex) {
    const tierNumber = starIndex + 1;
    const init = Number(formula?.init ?? 0);
    const coeff = Number(formula?.coeff ?? 0);
    return init + coeff * tierNumber;
}

function formatBonusValue(bonusId, unitType, formula, starIndex, bonusTypesById) {
    const value = resolveFormulaValue(formula, starIndex);
    const label = resolveBonusLabel(bonusTypesById, bonusId);
    const formattedValue = formatBonusNumber(value);

    if (unitType === 'multiplier') {
        return `x${formattedValue} ${label}`;
    }
    if (unitType === 'percent') {
        return `+${formattedValue}% ${label}`;
    }
    return `+${formattedValue} ${label}`;
}

function buildBonusMap(bonusEntry, starCount, bonusTypesById) {
    const bonusId = normalizeBonusId(bonusEntry?.bonus);
    const bonuses = {};
    for (let starIndex = 0; starIndex <= starCount; starIndex += 1) {
        bonuses[String(starIndex)] = formatBonusValue(
            bonusId,
            bonusEntry?.unit_type,
            bonusEntry?.tiers_formula,
            starIndex,
            bonusTypesById
        );
    }
    return bonuses;
}

function buildItemsById(rawItems, rawDropItems = {}) {
    const itemsById = {};
    for (const item of rawItems ?? []) {
        if (!item?.id) continue;
        itemsById[item.id] = {
            id: item.id,
            name: item.name ?? item.id,
            image: mapItemAssetPath(item.icon ?? item.image ?? null)
        };
    }

    for (const [itemId, override] of Object.entries(rawDropItems ?? {})) {
        const baseItem = itemsById[itemId] ?? { id: itemId, name: itemId, image: null };
        itemsById[itemId] = {
            ...baseItem,
            ...override
        };
    }

    if (!itemsById.exp) {
        itemsById.exp = {
            id: 'exp',
            name: 'Experience',
            image: '../cards/images/items/exp.png?v=17d6d6d2a9'
        };
    }

    return itemsById;
}

function resolveCardName(card, itemsById) {
    const itemId = card?.item_id;
    const itemName = itemsById[itemId]?.name;
    if (!itemName) {
        throw new Error(`Missing card item metadata for item "${itemId}"`);
    }
    return itemName.replace(/\s+Card$/, '');
}

function buildBonusTypes(rawBonusTypes, usedBonusIds) {
    return (rawBonusTypes ?? [])
        .filter(entry => entry?.id && usedBonusIds.has(normalizeBonusId(entry.id)))
        .map(entry => ({
            id: normalizeBonusId(entry.id),
            label: entry.label ?? entry.id
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
}

function buildBonusDefinitions(rawBonusData) {
    const definitions = new Map();
    for (const source of rawBonusData?.bonuses ?? []) {
        const itemId = resolveItemIdFromRef(source?.$ref);
        if (!itemId) continue;

        const tier = Array.isArray(source?.tier)
            ? source.tier
            : resolveLocalRef(rawBonusData, source?.tier?.$ref);
        const bonusEntry = source?.bonuses?.[0] ?? null;
        if (!Array.isArray(tier) || !tier.length || !bonusEntry) continue;

        definitions.set(itemId, {
            itemId,
            bonusId: normalizeBonusId(bonusEntry.bonus),
            thresholds: tier.map(Number),
            bonusEntry
        });
    }
    return definitions;
}

function mergeCard(card, bonusDefinition, bonusTypesById, itemsById) {
    const thresholds = bonusDefinition.thresholds;
    const starCount = Math.max(0, thresholds.length - 1);

    return {
        ...card,
        name: resolveCardName(card, itemsById),
        bonus_type: bonusDefinition.bonusId,
        stars: starCount,
        tiers: thresholds,
        bonuses: buildBonusMap(bonusDefinition.bonusEntry, starCount, bonusTypesById)
    };
}

export function buildCardsData(rawCardsData, rawBonusData, rawBonusesCatalog, rawItems) {
    const bonusDefinitions = buildBonusDefinitions(rawBonusData);
    const itemsById = buildItemsById(rawItems, rawCardsData?.drop_items);
    const bonusTypesById = new Map(
        (rawBonusesCatalog?.bonus_types ?? []).map(entry => [normalizeBonusId(entry.id), entry])
    );
    const usedBonusIds = new Set();

    const categories = (rawCardsData?.categories ?? []).map(category => ({
        ...category,
        cards: (category.cards ?? []).map(card => {
            if (card?.placeholder) return { ...card };
            const bonusDefinition = bonusDefinitions.get(card?.item_id);
            if (!bonusDefinition) {
                throw new Error(`Missing card bonus definition for item "${card?.item_id}"`);
            }
            usedBonusIds.add(bonusDefinition.bonusId);
            return mergeCard(card, bonusDefinition, bonusTypesById, itemsById);
        })
    }));

    return {
        ...rawCardsData,
        bonus_types: buildBonusTypes(rawBonusesCatalog?.bonus_types, usedBonusIds),
        items: itemsById,
        categories
    };
}

export function resolveCardsDataUrl(moduleUrl = import.meta.url) {
    return new URL('./cards.json?v=0b30eb3365', moduleUrl).toString();
}

export function resolveCardsBonusDataUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/sources/cards.json?v=24fc3fd9eb', moduleUrl).toString();
}

export function resolveBonusesCatalogUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/bonuses.json?v=7191193bc2', moduleUrl).toString();
}

export function resolveItemsDataUrl(moduleUrl = import.meta.url) {
    return new URL('../items/items.json?v=e95c839e1a', moduleUrl).toString();
}

export async function loadCardsData({
    fetchImpl = fetch,
    moduleUrl = import.meta.url
} = {}) {
    const [cardsResponse, cardBonusesResponse, bonusesCatalogResponse, itemsResponse] = await Promise.all([
        fetchImpl(resolveCardsDataUrl(moduleUrl)),
        fetchImpl(resolveCardsBonusDataUrl(moduleUrl)),
        fetchImpl(resolveBonusesCatalogUrl(moduleUrl)),
        fetchImpl(resolveItemsDataUrl(moduleUrl))
    ]);

    const [rawCardsData, rawBonusData, rawBonusesCatalog, rawItems] = await Promise.all([
        cardsResponse.json(),
        cardBonusesResponse.json(),
        bonusesCatalogResponse.json(),
        itemsResponse.json()
    ]);

    return buildCardsData(rawCardsData, rawBonusData, rawBonusesCatalog, rawItems);
}
