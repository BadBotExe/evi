import {
    BONFIRE_ASH_KEYS,
    BONFIRE_SACRIFICE_KEYS,
    CURIO_GUIDS,
    ENGINEER_UPGRADE_KEYS,
    GEAR_GUIDS,
    GEM_SHOP_KEYS,
    HUNTER_UPGRADE_KEYS,
    PROGRESSION_KEYS,
    RUNE_GUIDS,
    RUNEWORD_GUIDS,
    SAVE_CONDITION_RESOLVERS,
    SOURCE_SAVE_RULES,
} from './saveMappings.js?v=8051e324a0';

function cloneSources(sources) {
    return JSON.parse(JSON.stringify(sources ?? []));
}

function annotateActualTier(bonus, tier) {
    if (!bonus) return bonus;
    return {
        ...bonus,
        _actualTier: Math.max(0, Number(tier ?? 0))
    };
}

function sumEnhancements(values, keys) {
    return (keys ?? []).reduce((total, key) => total + Number(values?.[key] ?? 0), 0);
}

function applyBonusGroups(src, groups, values) {
    const nextBonuses = (src.bonuses ?? []).map((bonus, index) => {
        const tier = sumEnhancements(values, groups?.[index] ?? []);
        return annotateActualTier(bonus, tier);
    });
    return {
        ...src,
        actual_available: nextBonuses.some((bonus, index) => sumEnhancements(values, groups?.[index] ?? []) > 0),
        bonuses: nextBonuses
    };
}

export class BonusSaveIntegration {
    constructor(app) {
        this.app = app;
        this._consumedRuneCounts = new Map();
    }

    applySaveContext(context, heroIndex) {
        const baseSources = this.app.data?._base_sources ?? [];
        const hero = context?.heroes?.[heroIndex] ?? null;
        this.app.selectedSaveHeroIndex = hero?.index ?? null;
        this.app.saveContext = context ?? null;
        this.app.actualCalcContext = null;
        this.app.resetMaxPanel('actual');

        if (!context || !hero) {
            this._consumedRuneCounts = new Map();
            this.app.data.sources = cloneSources(baseSources);
            this.app.parameters = (this.app.data.parameters ?? []).map(parameter => this.app._dataLoader.buildParameter({ ...parameter }));
            this.app.activeConditions = new Set();
            this.app._calcCache = {};
            return;
        }

        this._consumedRuneCounts = this._buildConsumedRuneCounts(baseSources, context);
        const sources = cloneSources(baseSources).map(src => this._applySourceSaveState(src, context, hero));
        this.app.data.sources = sources;
        this.app.selectedClass = hero.classId;
        this._applyHeroParameters(hero);
        this.app._calcCache = {};
    }

    _applyHeroParameters(hero) {
        const nextParameters = (this.app.data.parameters ?? []).map(parameter => ({ ...parameter }));
        const overrides = {
            level: hero.level,
            mining_level: hero.miningLevel,
            woodcutting_level: hero.woodcuttingLevel,
            heat: Math.round(Number(this.app.saveContext?.raw?.Bonfire?.lit ? (this.app.saveContext?.raw?.Bonfire?.burner?.fuel ?? 0) : 0)),
            achievements: Number(this.app.saveContext?.achievementCount ?? 0)
        };
        this.app.parameters = nextParameters.map(parameter => {
            const built = this.app._dataLoader.buildParameter(parameter);
            if (Object.prototype.hasOwnProperty.call(overrides, built.id)) {
                built.value = overrides[built.id];
            }
            return built;
        });
        this.app.activeConditions = new Set(
            Object.entries(SAVE_CONDITION_RESOLVERS)
                .filter(([conditionId, resolve]) => resolve(this.app.saveContext, hero) && this.app.data?.conditions?.some(condition => condition.id === conditionId))
                .map(([conditionId]) => conditionId)
        );
        this._applyDerivedActualParameters();
    }

    _applyDerivedActualParameters() {
        const statParamByBonus = {
            strength: 'str',
            dexterity: 'dex'
        };
        const previousBonus = this.app.selectedBonus;
        const previousCache = this.app._calcCache;

        try {
            for (const [bonusId, parameterId] of Object.entries(statParamByBonus)) {
                this.app.selectedBonus = bonusId;
                this.app._calcCache = {};
                const items = this.app._calcItems(true, this.app.data.sources, 'actual');
                const total = this.app._compoundTotal(items);
                const parameter = this.app.parameters.find(entry => entry.id === parameterId);
                if (!parameter) continue;
                const min = Number(parameter.min ?? 0);
                const max = Number(parameter.max ?? Infinity);
                parameter.value = Math.max(min, Math.min(max, Math.round(Number(total?.value ?? 0))));
            }
        } finally {
            this.app.selectedBonus = previousBonus;
            this.app._calcCache = previousCache ?? {};
        }
    }

    _applySourceSaveState(src, context, hero) {
        let nextSrc = this._applySourceRule(src);
        if (HUNTER_UPGRADE_KEYS[src.id]) {
            nextSrc = this._applyGlobalEnhancement(nextSrc, context.enhancements, HUNTER_UPGRADE_KEYS[src.id]);
        } else if (BONFIRE_SACRIFICE_KEYS[src.id]) {
            nextSrc = this._applyGlobalEnhancement(nextSrc, context.enhancements, BONFIRE_SACRIFICE_KEYS[src.id]);
        } else if (GEM_SHOP_KEYS[src.id]) {
            nextSrc = this._applyGlobalEnhancement(nextSrc, context.enhancements, GEM_SHOP_KEYS[src.id]);
        } else if (ENGINEER_UPGRADE_KEYS[src.id]) {
            nextSrc = this._applyGlobalEnhancement(nextSrc, context.enhancements, ENGINEER_UPGRADE_KEYS[src.id]);
        } else if (BONFIRE_ASH_KEYS[src.id]) {
            nextSrc = applyBonusGroups(nextSrc, BONFIRE_ASH_KEYS[src.id], context.enhancements);
        } else if (PROGRESSION_KEYS[src.id]) {
            nextSrc = applyBonusGroups(nextSrc, PROGRESSION_KEYS[src.id], hero.enhancements);
        } else if (src.type === 'gear') {
            nextSrc = this._applyGear(nextSrc, hero);
        } else if (src.type === 'curios') {
            nextSrc = this._applyCurio(nextSrc, context);
        } else if (src.type === 'pet') {
            nextSrc = this._applyPet(nextSrc, hero);
        } else if (src.type === 'runes') {
            nextSrc = this._applyRune(nextSrc, context);
        } else if (src.type === 'card') {
            nextSrc = this._applyCard(nextSrc, context);
        }
        return this._refreshResolvedBonusValues(nextSrc);
    }

    _applySourceRule(src) {
        const typeRule = SOURCE_SAVE_RULES[src.type];
        const idRule = SOURCE_SAVE_RULES[src.id];
        const rule = (typeRule?.match === 'type' ? typeRule : null) ?? idRule ?? null;
        if (!rule) return src;
        const { match, ...sourceState } = rule;
        return { ...src, ...sourceState };
    }

    _refreshResolvedBonusValues(src) {
        if (!src?.bonuses?.length) return src;
        const nextSrc = { ...src };
        nextSrc.bonuses = nextSrc.bonuses.map(bonus => ({
            ...bonus,
            value: this.app.resolveSourceBonusValue(nextSrc, bonus)
        }));
        return nextSrc;
    }

    _applyGlobalEnhancement(src, values, key) {
        const tier = Number(values?.[key] ?? 0);
        return {
            ...src,
            actual_available: tier > 0,
            bonuses: (src.bonuses ?? []).map(bonus => annotateActualTier(bonus, tier))
        };
    }

    _applyGear(src, hero) {
        const guid = this.app.data?.items?.get(src.id)?.guid ?? GEAR_GUIDS[src.id];
        const owned = guid ? hero.equippedGear.get(guid) : null;
        if (!owned) {
            return {
                ...src,
                actual_available: false
            };
        }
        return {
            ...src,
            actual_available: true,
            max: Math.max(1, Number(owned.count ?? 1)),
            bonuses: (src.bonuses ?? []).map(bonus => {
                if (!bonus.tiers_formula) return { ...bonus };
                return annotateActualTier(bonus, Number(owned.enhancementLevel ?? 0));
            })
        };
    }

    _applyCurio(src, context) {
        const guid = CURIO_GUIDS[src.id];
        const owned = guid ? context.equippedCurios.get(guid) : null;
        if (!owned) {
            return {
                ...src,
                actual_available: false
            };
        }
        return {
            ...src,
            actual_available: true,
            bonuses: (src.bonuses ?? []).map(bonus =>
                annotateActualTier(
                    bonus,
                    Number(bonus?._is_ascension ? (owned.tier ?? 0) : (owned.level ?? 1))
                )
            )
        };
    }

    _applyPet(src, hero) {
        const activePet = hero.activePet;
        if (!activePet || activePet.name !== src.name) {
            return {
                ...src,
                actual_available: false
            };
        }
        return {
            ...src,
            actual_available: true,
            _actualPetLevel: Math.max(1, Number(activePet.level ?? 1)),
            _actualPetTier: Math.max(1, Number(activePet.tier ?? 1))
        };
    }

    _buildConsumedRuneCounts(sources, context) {
        const counts = new Map();
        for (const src of sources ?? []) {
            const runewordGuid = RUNEWORD_GUIDS[src?.id];
            const activeCount = Number(runewordGuid ? (context.activeRunewords.get(runewordGuid) ?? 0) : 0);
            if (activeCount <= 0 || !Array.isArray(src?.runes)) continue;
            for (const runeId of src.runes) {
                const runeGuid = RUNE_GUIDS[runeId];
                if (!runeGuid) continue;
                counts.set(runeGuid, (counts.get(runeGuid) ?? 0) + activeCount);
            }
        }
        return counts;
    }

    _applyRune(src, context) {
        const guid = RUNE_GUIDS[src.id];
        const runewordGuid = RUNEWORD_GUIDS[src.id];
        const count = guid
            ? Math.max(0, Number(context.equippedRunes.get(guid) ?? 0) - Number(this._consumedRuneCounts.get(guid) ?? 0))
            : Number(runewordGuid ? (context.activeRunewords.get(runewordGuid) ?? 0) : 0);
        return {
            ...src,
            actual_available: count > 0,
            max: Math.max(0, count)
        };
    }

    _applyCard(src, context) {
        const cardItemId = src.item_id ?? src.card_id ?? null;
        const thresholds = this.app.data?.card_thresholds?.get(cardItemId);
        const saveKey = cardItemId ? this.app.data?.card_save_keys?.get(cardItemId) : null;
        const ownedCount = Number(saveKey ? (context.cards.get(saveKey) ?? 0) : 0);
        if (!thresholds?.length || ownedCount <= 0) {
            return {
                ...src,
                actual_available: ownedCount > 0
            };
        }
        let stars = 0;
        for (let index = 0; index < thresholds.length; index += 1) {
            if (ownedCount >= Number(thresholds[index] ?? Infinity)) stars = index;
        }
        const actualTier = stars + 1;
        return {
            ...src,
            actual_available: true,
            bonuses: (src.bonuses ?? []).map(bonus => annotateActualTier(bonus, actualTier))
        };
    }
}
