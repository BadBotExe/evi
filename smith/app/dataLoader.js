import { atlasSourcePathToImageAsset, resolveAtlasPathFromManifest } from '../../shell/lib/imageAtlas.js?v=2593e30b08';

function resolveSmithAtlasManifestUrl(moduleUrl = import.meta.url) {
    return new URL('../../generated/image-atlas-manifest.json?v=0b94192dcd', moduleUrl).toString();
}

function resolveSmithAtlasAssetUrl(atlasPath, moduleUrl = import.meta.url) {
    return resolveAtlasPathFromManifest(atlasPath, {
        manifestUrl: resolveSmithAtlasManifestUrl(moduleUrl)
    });
}

function resolveSmithAtlasSourcePath(assetPath) {
    if (typeof assetPath !== 'string') return null;
    const trimmed = assetPath.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('images/')) return `items/${trimmed}`;
    if (trimmed.startsWith('../items/images/')) return trimmed.slice(3);
    return null;
}

function mapItemAssetPath(assetPath, atlasManifest, moduleUrl = import.meta.url) {
    if (typeof assetPath !== 'string') return null;
    const trimmed = assetPath.trim();
    if (!trimmed) return null;
    const atlasSourcePath = resolveSmithAtlasSourcePath(trimmed);
    if (atlasSourcePath) {
        const atlasAsset = atlasSourcePathToImageAsset(
            atlasManifest,
            atlasSourcePath,
            value => resolveSmithAtlasAssetUrl(value, moduleUrl)
        );
        if (atlasAsset) return atlasAsset;
    }
    if (trimmed.startsWith('images/')) return `../items/${trimmed}`;
    return trimmed;
}

function resolveItemIdFromRef(ref) {
    if (typeof ref !== 'string') return null;
    return ref.startsWith('item:') ? ref.slice(5) : null;
}

function buildItemsById(rawItems, atlasManifest, moduleUrl = import.meta.url) {
    const itemsById = {};
    for (const item of rawItems ?? []) {
        if (!item?.id) continue;
        itemsById[item.id] = {
            id: item.id,
            name: item.name ?? item.id,
            image: mapItemAssetPath(item.icon ?? item.image ?? null, atlasManifest, moduleUrl),
            description: typeof item.description === 'string' ? item.description.trim() : ''
        };
    }
    return itemsById;
}

function buildBonusLabelsById(rawBonusesCatalog) {
    return new Map(
        (rawBonusesCatalog?.bonus_types ?? [])
            .filter(entry => entry?.id)
            .map(entry => [entry.id, entry.label ?? entry.id])
    );
}

function resolveStatValue(bonus) {
    if (Number.isFinite(Number(bonus?.value))) {
        return Number(bonus.value);
    }
    if (Number.isFinite(Number(bonus?.tiers_formula?.init))) {
        return Number(bonus.tiers_formula.init);
    }
    return null;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatStatValue(value, unitType) {
    const formatted = formatNumber(value);
    if (!formatted) return '';
    if (unitType === 'multiplier') return `x${formatted}`;
    if (unitType === 'percent') return `${value >= 0 ? '+' : ''}${formatted}%`;
    return `${value >= 0 ? '+' : ''}${formatted}`;
}

function buildStatsRows(gearEntry, bonusLabelsById) {
    return (gearEntry?.bonuses ?? [])
        .map(bonus => {
            const value = resolveStatValue(bonus);
            if (value == null) return null;
            return {
                id: bonus.bonus ?? '',
                label: bonusLabelsById.get(bonus.bonus) ?? bonus.bonus ?? 'Unknown',
                value: formatStatValue(value, bonus.unit_type)
            };
        })
        .filter(Boolean);
}

function buildGearByItemId(rawGearData, bonusLabelsById) {
    const gearByItemId = new Map();
    for (const entry of rawGearData?.bonuses ?? []) {
        const itemId = resolveItemIdFromRef(entry?.$ref);
        if (!itemId) continue;
        gearByItemId.set(itemId, {
            itemId,
            slot: entry.slot ?? '',
            stats: buildStatsRows(entry, bonusLabelsById)
        });
    }
    return gearByItemId;
}

function normalizeRecipeEntry(entry, itemsById) {
    if (!entry?.item_id || !itemsById[entry.item_id]) {
        throw new Error(`Unknown smith recipe item "${entry?.item_id ?? ''}"`);
    }
    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for smith recipe item "${entry.item_id}"`);
    }

    return {
        item_id: entry.item_id,
        quantity,
        item: itemsById[entry.item_id]
    };
}

function normalizeRecipes(rawRecipes, itemsById) {
    const recipesByItemId = {};
    for (const [itemId, recipe] of Object.entries(rawRecipes ?? {})) {
        if (!itemsById[itemId]) {
            throw new Error(`Unknown smith recipe target "${itemId}"`);
        }
        const ingredients = (recipe?.ingredients ?? []).map(entry => normalizeRecipeEntry(entry, itemsById));
        recipesByItemId[itemId] = {
            item_id: itemId,
            ingredients
        };
    }
    return recipesByItemId;
}

function normalizeTabs(rawSmithData, itemsById) {
    return (rawSmithData?.tabs ?? []).map(tab => {
        if (!tab?.id) throw new Error('Smith tab is missing id');
        if (!tab?.label) throw new Error(`Smith tab "${tab.id}" is missing label`);
        const itemsPerRow = Number(tab.items_per_row);
        if (!Number.isInteger(itemsPerRow) || itemsPerRow <= 0) {
            throw new Error(`Smith tab "${tab.id}" has invalid items_per_row`);
        }

        const itemIds = [];
        for (const itemId of tab.item_ids ?? []) {
            if (!itemsById[itemId]) {
                throw new Error(`Unknown smith item "${itemId}" in tab "${tab.id}"`);
            }
            itemIds.push(itemId);
        }

        return {
            id: tab.id,
            label: tab.label,
            items_per_row: itemsPerRow,
            item_ids: itemIds
        };
    });
}

function buildRecipesByItemId(rawSmithData, itemsById) {
    return normalizeRecipes(rawSmithData?.recipes, itemsById);
}

export function buildSmithData(rawSmithData, rawItems, rawGearData, rawBonusesCatalog, options = {}) {
    const itemsById = buildItemsById(rawItems, options.atlasManifest, options.moduleUrl);
    const bonusLabelsById = buildBonusLabelsById(rawBonusesCatalog);
    const gearByItemId = buildGearByItemId(rawGearData, bonusLabelsById);
    const tabs = normalizeTabs(rawSmithData, itemsById);
    const recipesByItemId = buildRecipesByItemId(rawSmithData, itemsById);

    return {
        tabs,
        itemsById,
        recipesByItemId,
        gearByItemId,
        default_act_id: rawSmithData?.default_act_id ?? tabs[0]?.id ?? ''
    };
}

export function resolveSmithDataUrl(moduleUrl = import.meta.url) {
    return new URL('./smith.json?v=6a928136ff', moduleUrl).toString();
}

export function resolveItemsDataUrl(moduleUrl = import.meta.url) {
    return new URL('../items/items.json?v=d6c9bf4504', moduleUrl).toString();
}

export function resolveGearDataUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/sources/gear.json?v=68ac81b1e7', moduleUrl).toString();
}

export function resolveBonusesCatalogUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/bonuses.json?v=717ec7641a', moduleUrl).toString();
}

export async function loadSmithAtlasManifest({
    fetchImpl = fetch,
    moduleUrl = import.meta.url
} = {}) {
    try {
        const response = await fetchImpl(resolveSmithAtlasManifestUrl(moduleUrl));
        if (!response.ok) return { atlases: {}, entries: {} };
        return await response.json();
    } catch {
        return { atlases: {}, entries: {} };
    }
}

export async function loadSmithData({
    fetchImpl = fetch,
    moduleUrl = import.meta.url
} = {}) {
    const [smithResponse, itemsResponse, gearResponse, bonusesResponse, atlasManifest] = await Promise.all([
        fetchImpl(resolveSmithDataUrl(moduleUrl)),
        fetchImpl(resolveItemsDataUrl(moduleUrl)),
        fetchImpl(resolveGearDataUrl(moduleUrl)),
        fetchImpl(resolveBonusesCatalogUrl(moduleUrl)),
        loadSmithAtlasManifest({ fetchImpl, moduleUrl })
    ]);

    const [rawSmithData, rawItems, rawGearData, rawBonusesCatalog] = await Promise.all([
        smithResponse.json(),
        itemsResponse.json(),
        gearResponse.json(),
        bonusesResponse.json()
    ]);

    return buildSmithData(rawSmithData, rawItems, rawGearData, rawBonusesCatalog, {
        atlasManifest,
        moduleUrl
    });
}
