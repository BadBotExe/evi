import { loadSmithData } from '../../smith/app/dataLoader.js?v=93efaaada4';
import { CURIO_GUIDS } from '../../bonuses/app/saveMappings.js?v=434569d500';
import { buildCurioGachaData } from '../lib/curioGacha.js?v=26d6252d36';
import {
    atlasSourcePathToImageAsset,
    resolveAtlasPathFromManifest
} from '../../shell/lib/imageAtlas.js?v=2593e30b08';

const BONUSES_DATA_URL = new URL('../../bonuses/bonuses.json?v=a7cbfde2ac', import.meta.url);
const ENGINEERING_DATA_URL = new URL('../../bonuses/sources/engineering_production.json?v=6eb068e617', import.meta.url);
const GEM_SHOP_DATA_URL = new URL('../../bonuses/sources/gem_shop.json?v=beacdace22', import.meta.url);
const CURIOS_DATA_URL = new URL('../../bonuses/sources/curios.json?v=e25ed851d2', import.meta.url);
const GEAR_DATA_URL = new URL('../../bonuses/sources/gear.json?v=7ab6b2a1b8', import.meta.url);
const ITEMS_DATA_URL = new URL('../../items/items.json?v=128105bb1d', import.meta.url);
const CARDS_DATA_URL = new URL('../../cards/cards.json?v=17f6e5be1c', import.meta.url);
const IMAGE_ATLAS_MANIFEST_URL = new URL('../../generated/image-atlas-manifest.json?v=2b63aad3b7', import.meta.url);
const SMITH_MODULE_URL = new URL('../../smith/module.js?v=2aad890bbd', import.meta.url).toString();

function buildItemsMap(rawItems, curioAtlasManifest = null) {
    return new Map(
        (rawItems ?? [])
            .filter(item => item?.id)
            .map(item => [item.id, resolveToolItem(item, curioAtlasManifest)])
    );
}

function resolveCurioAtlasPath(atlasPath) {
    return resolveAtlasPathFromManifest(atlasPath, {
        manifestUrl: IMAGE_ATLAS_MANIFEST_URL.toString()
    });
}

function resolveToolItem(item, curioAtlasManifest = null) {
    const icon = item?.icon;
    const image = item?.image;
    const iconPath = typeof icon === 'string' && icon ? `items/${icon}` : '';
    const atlasImage = curioAtlasManifest && iconPath
        ? atlasSourcePathToImageAsset(curioAtlasManifest, iconPath, resolveCurioAtlasPath)
        : null;
    const resolvedImage = typeof image === 'string' && image.startsWith('images/')
        ? `../items/${image}`
        : image ?? null;
    return {
        ...item,
        image: atlasImage ?? (typeof icon === 'string' && icon
            ? `../items/${icon}`
            : resolvedImage)
    };
}

function resolveFormulaSteps(formula, tierOffset = 1) {
    const step = formula.step ?? 1;
    const startOffset = formula.init_at_unlock_tier ? 0 : 1;
    return Math.max(0, Math.floor((formula.max_tier - tierOffset + startOffset) / step));
}

function roundFormulaValue(value, mode = 'none') {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    if (mode === 'floor') return Math.floor(numeric);
    if (mode === 'ceil') return Math.ceil(numeric);
    if (mode === 'none') return numeric;
    return Math.round(numeric);
}

function applyFormula(formula, tierOffset = 1) {
    if (formula.type === 'table') {
        const values = Array.isArray(formula.values) ? formula.values : [];
        const index = Math.max(0, Math.floor(Number(formula.max_tier ?? tierOffset) - tierOffset));
        const value = values[Math.min(index, Math.max(0, values.length - 1))];
        return Number(value ?? 0);
    }

    const steps = resolveFormulaSteps(formula, tierOffset);
    if (formula.type === 'base_percent') {
        const init = Number(formula.init ?? 0);
        const percent = Number(formula.percent ?? formula.coeff ?? 0);
        const growthPerStep = init * (percent / 100);
        return roundFormulaValue(
            init + (steps * growthPerStep),
            formula.rounding ?? 'none'
        );
    }
    return Number(formula.init ?? 0) + (steps * Number(formula.coeff ?? 0));
}

function hasResolvableFormulaValue(formula) {
    if (formula?.type === 'table' && Array.isArray(formula.values)) return formula.values.length > 0;
    return ['init', 'coeff', 'percent'].some(key => Number.isFinite(Number(formula?.[key])));
}

function resolveBonusFormula(globalFormula, fileFormula, srcFormula, bonusFormula) {
    if (srcFormula === false || bonusFormula === false) return null;
    const resolved = Object.assign({}, globalFormula ?? {}, fileFormula ?? {}, srcFormula ?? {}, bonusFormula ?? {});
    return hasResolvableFormulaValue(resolved) ? resolved : null;
}

function resolveSourceBonusValue(globalFormula, fileFormula, src, bonusEntry) {
    const formula = resolveBonusFormula(
        globalFormula,
        fileFormula,
        typeof src?.tiers_formula === 'object' ? src.tiers_formula : null,
        typeof bonusEntry?.tiers_formula === 'object' ? bonusEntry.tiers_formula : null
    );
    if (!formula) return Number(bonusEntry?.value ?? 0);
    return applyFormula(formula, bonusEntry?.unlock_at_tier ?? 1);
}

function resolveSourceFile(file, globalFormula) {
    const fileFormula = file?.tiers_formula ?? null;
    return (file?.bonuses ?? []).map(src => ({
        ...src,
        type: src.type ?? file.type,
        _file_tiers_formula: fileFormula,
        bonuses: (src.bonuses ?? []).map(bonusEntry => ({
            ...bonusEntry,
            value: resolveSourceBonusValue(globalFormula, fileFormula, src, bonusEntry)
        }))
    }));
}

export class ToolsDataLoader {
    constructor(app) {
        this.app = app;
    }

    async load() {
        const shouldLoadSmithData = !!this.app?.smithCalculatorState;
        const [bonusesResponse, engineeringResponse, gemShopResponse, curiosResponse, gearResponse, itemsResponse, cardsResponse, curioAtlasResponse, smithData] = await Promise.all([
            fetch(BONUSES_DATA_URL),
            fetch(ENGINEERING_DATA_URL),
            fetch(GEM_SHOP_DATA_URL),
            fetch(CURIOS_DATA_URL),
            fetch(GEAR_DATA_URL),
            fetch(ITEMS_DATA_URL),
            fetch(CARDS_DATA_URL),
            fetch(IMAGE_ATLAS_MANIFEST_URL),
            shouldLoadSmithData
                ? loadSmithData({ moduleUrl: SMITH_MODULE_URL })
                : Promise.resolve(null)
        ]);

        const [bonusesData, engineeringFile, gemShopFile, curiosFile, gearFile, rawItems, cardsData, curioAtlasManifest] = await Promise.all([
            bonusesResponse.json(),
            engineeringResponse.json(),
            gemShopResponse.json(),
            curiosResponse.json(),
            gearResponse.json(),
            itemsResponse.json(),
            cardsResponse.json(),
            curioAtlasResponse.json()
        ]);

        const engineeringSources = resolveSourceFile(engineeringFile, bonusesData.tiers_formula);
        const gemShopSources = resolveSourceFile(gemShopFile, bonusesData.tiers_formula);
        const gearSources = resolveSourceFile(gearFile, bonusesData.tiers_formula);
        const relevantGemShopSourceIds = new Set(
            (engineeringFile?.planner?.slot_upgrade?.source_id ? [engineeringFile.planner.slot_upgrade.source_id] : [])
                .concat(['gem_shop_smeltery_speed', 'gem_shop_smeltery_multicraft'])
        );

        const items = buildItemsMap(rawItems, curioAtlasManifest);

        this.app.data = {
            engineeringPlanner: engineeringFile?.planner ?? null,
            items,
            categories: bonusesData?.categories ?? [],
            types: bonusesData?.types ?? {},
            sources: engineeringSources.concat(
                gemShopSources.filter(src => relevantGemShopSourceIds.has(src.id))
            ),
            gearSources,
            cards: cardsData,
            curioGacha: buildCurioGachaData({
                curioSources: curiosFile?.bonuses ?? [],
                items,
                guidBySourceId: CURIO_GUIDS
            }),
            smith: smithData
        };

        this.initializeEngineeringPlannerState();
    }

    initializeEngineeringPlannerState() {
        const planner = this.app.data.engineeringPlanner;
        const slots = planner?.slots ?? [];

        this.app.engineeringPlannerState.mode = 'requirements';
        this.app.engineeringPlannerState.anchorSlot =
            planner?.default_anchor_slot
            ?? slots[0]?.id
            ?? null;
        this.app.engineeringPlannerState.inputMode = 'items';
        this.app.engineeringPlannerState.anchorSpeed = 0;
        this.app.engineeringPlannerState.anchorItemsPerHour = null;
        this.app.engineeringPlannerState.slotUpgradeLevel = this.app.engineeringPlannerSlotUpgrade()?.defaultLevel ?? 0;
        this.app.engineeringPlannerState.throughputSpeeds = slots.reduce((acc, slot) => {
            acc[slot.id] = 0;
            return acc;
        }, {});
        this.app.engineeringPlannerState.throughputItemsPerHour = slots.reduce((acc, slot) => {
            acc[slot.id] = null;
            return acc;
        }, {});
    }
}
