import { atlasSourcePathToImageAsset, resolveAtlasPathFromManifest } from '../../shell/lib/imageAtlas.js?v=2593e30b08';

function resolveSmithAtlasManifestUrl(moduleUrl = import.meta.url) {
    return new URL('../../generated/image-atlas-manifest.json?v=8bd831398f', moduleUrl).toString();
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

function normalizeRefListEntry(entry, contextLabel) {
    const itemId = resolveItemIdFromRef(entry?.$ref);
    if (!itemId) {
        throw new Error(`Invalid item ref in ${contextLabel}`);
    }
    return itemId;
}

function buildItemsById(rawItems, atlasManifest, moduleUrl = import.meta.url) {
    const itemsById = {};
    for (const item of rawItems ?? []) {
        if (!item?.id) continue;
        itemsById[item.id] = {
            id: item.id,
            key: typeof item.key === 'string' ? item.key.trim() : '',
            name: item.name ?? item.id,
            image: mapItemAssetPath(item.icon ?? item.image ?? null, atlasManifest, moduleUrl),
            description: typeof item.description === 'string' ? item.description.trim() : ''
        };
    }
    return itemsById;
}

function createFallbackItem(itemId) {
    return {
        id: itemId,
        name: itemId || 'unknown',
        image: null,
        description: ''
    };
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
    const itemId = resolveItemIdFromRef(entry?.$ref);
    const quantity = Number(entry.quantity);
    const normalizedItemId = itemId ?? '';
    const item = itemsById[normalizedItemId] ?? createFallbackItem(normalizedItemId || String(entry?.$ref ?? 'unknown'));
    const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : String(entry?.quantity ?? '');

    return {
        item_id: item.id,
        quantity: normalizedQuantity,
        item
    };
}

function normalizeRecipeBaseTime(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeRecipes(rawRecipes, itemsById) {
    const recipesByItemId = {};
    for (const [itemId, recipe] of Object.entries(rawRecipes ?? {})) {
        if (!itemsById[itemId]) continue;
        const ingredients = (recipe?.ingredients ?? []).map(entry => normalizeRecipeEntry(entry, itemsById));
        recipesByItemId[itemId] = {
            item_id: itemId,
            ingredients,
            base_time: normalizeRecipeBaseTime(recipe?.base_time)
        };
    }
    return recipesByItemId;
}

function normalizeTabs(rawSmithData, itemsById) {
    const seenTabKeys = new Map();
    const seenItemKeys = new Map();

    return (rawSmithData?.tabs ?? []).map(tab => {
        if (!tab?.id) throw new Error('Smith tab is missing id');
        if (!tab?.label) throw new Error(`Smith tab "${tab.id}" is missing label`);
        if (!tab?.key) throw new Error(`Smith tab "${tab.id}" is missing key`);
        if (seenTabKeys.has(tab.key)) {
            throw new Error(`Duplicate smith tab key "${tab.key}" for tabs "${seenTabKeys.get(tab.key)}" and "${tab.id}"`);
        }
        seenTabKeys.set(tab.key, tab.id);

        const itemIds = [];
        for (const entry of tab.items ?? []) {
            const itemId = normalizeRefListEntry(entry, `smith tab "${tab.id}"`);
            const item = itemsById[itemId];
            if (!item) {
                throw new Error(`Unknown smith item "${itemId}" in tab "${tab.id}"`);
            }
            if (!item.key) {
                throw new Error(`Smith item "${itemId}" is missing key`);
            }
            const previousItemId = seenItemKeys.get(item.key);
            if (previousItemId && previousItemId !== itemId) {
                throw new Error(`Duplicate smith item key "${item.key}" for items "${previousItemId}" and "${itemId}"`);
            }
            seenItemKeys.set(item.key, itemId);
            itemIds.push(itemId);
        }

        return {
            id: tab.id,
            key: tab.key,
            label: tab.label,
            item_ids: itemIds
        };
    });
}

function buildRecipesByItemId(rawSmithData, itemsById) {
    return normalizeRecipes(rawSmithData?.recipes, itemsById);
}

function buildSmelteryItemIds(tabs) {
    const smelteryTab = (tabs ?? []).find(tab => tab.id === 'smeltery');
    return new Set(smelteryTab?.item_ids ?? []);
}

function buildSmelteryUpgradeConfig(rawGemShopData, {
    id,
    bonusId,
    unitType,
    fallbackName
} = {}) {
    const entry = (rawGemShopData?.bonuses ?? []).find(bonus => bonus?.id === id) ?? null;
    const multiplierBonus = entry?.bonuses?.find(bonus => bonus?.bonus === bonusId && bonus?.unit_type === unitType) ?? null;
    const tiers = multiplierBonus?.tiers_formula ?? null;
    const init = Number(tiers?.init);
    const coeff = Number(tiers?.coeff);
    const maxTier = Number(tiers?.max_tier);
    const usesPercentScale = unitType === 'percent';

    return {
        name: entry?.name ? `Gemshop ${entry.name}` : fallbackName,
        initMultiplier: usesPercentScale
            ? 1 + ((Number.isFinite(init) ? init : 0) / 100)
            : (Number.isFinite(init) && init > 0 ? init : 1),
        tierStep: usesPercentScale
            ? ((Number.isFinite(coeff) ? coeff : 0) / 100)
            : (Number.isFinite(coeff) ? coeff : 0),
        maxLevel: Number.isFinite(maxTier) && maxTier >= 0 ? maxTier : 0
    };
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
        smelteryItemIds: buildSmelteryItemIds(tabs),
        smelteryGemshop: buildSmelteryUpgradeConfig(options.rawGemShopData, {
            id: 'gem_shop_smeltery_speed',
            bonusId: 'smeltery_speed',
            unitType: 'multiplier',
            fallbackName: 'Gemshop Smeltery Speed'
        }),
        smelteryMulticraft: buildSmelteryUpgradeConfig(options.rawGemShopData, {
            id: 'gem_shop_smeltery_multicraft',
            bonusId: 'smeltery_multicraft',
            unitType: 'percent',
            fallbackName: 'Gemshop Smeltery Multicraft'
        }),
        default_act_id: rawSmithData?.default_act_id ?? tabs[0]?.id ?? ''
    };
}

export function resolveSmithDataUrl(moduleUrl = import.meta.url) {
    return new URL('./smith.json?v=3765ec59db', moduleUrl).toString();
}

export function resolveItemsDataUrl(moduleUrl = import.meta.url) {
    return new URL('../items/items.json?v=3e49b54eea', moduleUrl).toString();
}

export function resolveGearDataUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/sources/gear.json?v=0f97d399e1', moduleUrl).toString();
}

export function resolveGemShopDataUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/sources/gem_shop.json?v=beacdace22', moduleUrl).toString();
}

export function resolveBonusesCatalogUrl(moduleUrl = import.meta.url) {
    return new URL('../bonuses/bonuses.json?v=024371d2df', moduleUrl).toString();
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
    const [smithResponse, itemsResponse, gearResponse, gemShopResponse, bonusesResponse, atlasManifest] = await Promise.all([
        fetchImpl(resolveSmithDataUrl(moduleUrl)),
        fetchImpl(resolveItemsDataUrl(moduleUrl)),
        fetchImpl(resolveGearDataUrl(moduleUrl)),
        fetchImpl(resolveGemShopDataUrl(moduleUrl)),
        fetchImpl(resolveBonusesCatalogUrl(moduleUrl)),
        loadSmithAtlasManifest({ fetchImpl, moduleUrl })
    ]);

    const [rawSmithData, rawItems, rawGearData, rawGemShopData, rawBonusesCatalog] = await Promise.all([
        smithResponse.json(),
        itemsResponse.json(),
        gearResponse.json(),
        gemShopResponse.json(),
        bonusesResponse.json()
    ]);

    return buildSmithData(rawSmithData, rawItems, rawGearData, rawBonusesCatalog, {
        atlasManifest,
        moduleUrl,
        rawGemShopData
    });
}
