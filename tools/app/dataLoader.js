import { loadSmithData } from '../../smith/app/dataLoader.js?v=7323378b25';

const BONUSES_DATA_URL = new URL('../../bonuses/bonuses.json?v=586e1af080', import.meta.url);
const ENGINEERING_DATA_URL = new URL('../../bonuses/sources/engineering_production.json?v=3143453e57', import.meta.url);
const GEM_SHOP_DATA_URL = new URL('../../bonuses/sources/gem_shop.json?v=8a0b55ec76', import.meta.url);
const ITEMS_DATA_URL = new URL('../../items/items.json?v=93b68f4c1c', import.meta.url);
const SMITH_MODULE_URL = new URL('../../smith/module.js?v=5839e28594', import.meta.url).toString();

function buildItemsMap(rawItems) {
    return new Map(
        (rawItems ?? [])
            .filter(item => item?.id)
            .map(item => [item.id, item])
    );
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
        const [bonusesResponse, engineeringResponse, gemShopResponse, itemsResponse, smithData] = await Promise.all([
            fetch(BONUSES_DATA_URL),
            fetch(ENGINEERING_DATA_URL),
            fetch(GEM_SHOP_DATA_URL),
            fetch(ITEMS_DATA_URL),
            shouldLoadSmithData
                ? loadSmithData({ moduleUrl: SMITH_MODULE_URL })
                : Promise.resolve(null)
        ]);

        const [bonusesData, engineeringFile, gemShopFile, rawItems] = await Promise.all([
            bonusesResponse.json(),
            engineeringResponse.json(),
            gemShopResponse.json(),
            itemsResponse.json()
        ]);

        const engineeringSources = resolveSourceFile(engineeringFile, bonusesData.tiers_formula);
        const gemShopSources = resolveSourceFile(gemShopFile, bonusesData.tiers_formula);
        const relevantGemShopSourceIds = new Set(
            (engineeringFile?.planner?.slot_upgrade?.source_id ? [engineeringFile.planner.slot_upgrade.source_id] : [])
                .concat(['gem_shop_smeltery_speed', 'gem_shop_smeltery_multicraft'])
        );

        this.app.data = {
            engineeringPlanner: engineeringFile?.planner ?? null,
            items: buildItemsMap(rawItems),
            categories: bonusesData?.categories ?? [],
            types: bonusesData?.types ?? {},
            sources: engineeringSources.concat(
                gemShopSources.filter(src => relevantGemShopSourceIds.has(src.id))
            ),
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
