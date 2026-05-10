export class BonusSourceResolver {
    constructor(app) {
        this.app = app;
    }

    resolveRelativeAssetPath(baseFilePath, assetPath) {
        if (typeof assetPath !== 'string') return assetPath;
        const trimmed = assetPath.trim();
        if (!trimmed) return assetPath;
        if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(trimmed)) return assetPath;

        try {
            const resolved = new URL(trimmed, new URL(baseFilePath, window.location.href));
            return `${resolved.pathname}${resolved.search}${resolved.hash}`;
        } catch {
            return assetPath;
        }
    }

    resolveItemFileRefs(file, filePath) {
        const items = Array.isArray(file) ? file : (file.items ?? []);
        return items.map(item => ({
            ...item,
            icon: this.resolveRelativeAssetPath(filePath, item?.icon),
            image: this.resolveRelativeAssetPath(filePath, item?.image)
        }));
    }

    resolveItemRef(ref) {
        if (typeof ref !== 'string') return null;
        const trimmed = ref.trim();
        if (!trimmed.startsWith('item:')) return null;
        const itemId = trimmed.slice(5).trim();
        return itemId ? (this.app.data?.items?.get(itemId) ?? null) : null;
    }

    resolveSourceItemRef(src) {
        if (!src || typeof src !== 'object' || typeof src.$ref !== 'string') return src;
        const item = this.resolveItemRef(src.$ref);
        if (!item) return src;

        const { $ref, image, ...overrides } = src;
        const resolved = {
            ...item,
            item_id: item.id,
            ...overrides
        };
        if (resolved.image == null && image != null) resolved.image = image;
        if (resolved.image == null && item.icon != null) resolved.image = item.icon;
        return resolved;
    }

    bonusEntriesForBonusView(src, bonusIds) {
        return this.expandDerivedBonuses(src.bonuses ?? []).filter(b =>
            bonusIds.includes(b.bonus) && this.app._bonusMatchesClass(b, src)
        );
    }

    expandDerivedBonuses(bonuses) {
        const derivedMaps = this.app.data?.derived_bonus_maps ?? {};
        const expanded = [];

        for (const bonus of bonuses) {
            if (!bonus) continue;
            expanded.push(bonus);

            const mapIds = new Set([bonus.bonus]);
            const explicitMapIds = Array.isArray(bonus.derived_bonus_maps)
                ? bonus.derived_bonus_maps
                : (bonus.derived_bonus_map ? [bonus.derived_bonus_map] : []);
            explicitMapIds.filter(Boolean).forEach(id => mapIds.add(id));

            for (const mapId of mapIds) {
                const derivedEntries = derivedMaps[mapId] ?? [];
                for (const derived of derivedEntries) {
                    expanded.push(this.buildDerivedBonusEntry(bonus, derived));
                }
            }
        }

        return expanded;
    }

    buildDerivedBonusEntry(baseBonus, derivedDef) {
        const multiplier = Number(derivedDef.multiplier ?? 1);
        const derivedBonus = {
            ...baseBonus,
            ...derivedDef,
            bonus: derivedDef.bonus,
            unit_type: derivedDef.unit_type ?? baseBonus.unit_type,
            derived_from: baseBonus.bonus
        };

        if (baseBonus.value !== undefined && derivedDef.value === undefined) {
            derivedBonus.value = this.scaleDerivedValue(baseBonus.value, multiplier);
        }

        if (baseBonus.tiers_formula && derivedDef.tiers_formula === undefined) {
            derivedBonus.tiers_formula = this.scaleDerivedFormula(baseBonus.tiers_formula, multiplier);
        }

        return derivedBonus;
    }

    scaleDerivedValue(value, multiplier) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric * multiplier : value;
    }

    scaleDerivedFormula(formula, multiplier) {
        if (!formula || typeof formula !== 'object') return formula;

        const scaled = { ...formula };
        const scaleField = field => {
            if (typeof scaled[field] === 'number') scaled[field] *= multiplier;
        };

        scaleField('init');
        if (scaled.type !== 'base_percent') {
            scaleField('coeff');
        }

        return scaled;
    }

    tierPopoverNotice(entry) {
        if (!entry?.src || !Array.isArray(entry?.bonuses)) return null;

        for (const bonus of entry.bonuses) {
            const formula = this.app._resolveFormula(entry.src, bonus);
            if (!formula?.infinite) continue;

            const effectiveMaxTier = this.app._enhancementPositiveInt(formula.max_tier);
            if (effectiveMaxTier == null) return 'Max tier is not specified.';
            return `Max tier is not specified. Values shown up to tier ${effectiveMaxTier.toLocaleString()}.`;
        }

        return null;
    }
}
