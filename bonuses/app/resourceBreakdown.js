import { isPlainObject, deepCloneJson, deepMergeObjects } from '../utils.js?v=7e5a144c2d';

/**
 * Resource breakdown mixin.
 * Handles all enhancement and disenchantment cost/price breakdown logic,
 * including segment resolution, cumulative totals, formula display, and
 * the levels/totals/formula tab views shown in the PriceBreakdownPopover.
 */
export const resourceBreakdownMethods = {
    getResourceBreakdownMeta(kind = 'enhancement') {
        const meta = {
            enhancement: {
                kind: 'enhancement',
                icon: '../items/images/gold.png?v=68c77ec774',
                ariaLabel: 'Open enhancement price breakdown popover',
                emptyText: 'No enhancement prices',
                supportsTotals: true
            },
            disenchantment: {
                kind: 'disenchantment',
                icon: './images/salvage.png?v=a56ee3e91f',
                ariaLabel: 'Open disenchantment return breakdown popover',
                emptyText: 'No disenchantment returns',
                supportsTotals: false
            }
        };
        return meta[kind] ?? meta.enhancement;
    },

    _resourceBreakdownAliases(kind = 'enhancement') {
        if (kind === 'disenchantment') return ['disenchantment', 'disenchantement'];
        return [kind];
    },

    _resourceBreakdownKey(src, kind = 'enhancement') {
        if (!src || typeof src !== 'object') return null;
        return this._resourceBreakdownAliases(kind).find(key => key in src) ?? null;
    },

    _resourceBreakdownData(src, kind = 'enhancement') {
        const key = this._resourceBreakdownKey(src, kind);
        return key ? src?.[key] ?? null : null;
    },

    hasPriceBreakdown(src, kind = 'enhancement') {
        const breakdown = this._resourceBreakdownData(src, kind);
        if (!Array.isArray(breakdown?.segments) || !breakdown.segments.length) return false;
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const meta = this.getResourceBreakdownMeta(kind);
        return !!(
            (config.levels.enabled && config.levels.limit) ||
            (meta.supportsTotals && config.totals.enabled && config.totals.upto_level) ||
            config.formula.enabled
        );
    },

    getResourceBreakdownBadges(src) {
        return ['enhancement', 'disenchantment']
            .filter(kind => this.hasPriceBreakdown(src, kind))
            .map(kind => {
                const meta = this.getResourceBreakdownMeta(kind);
                return {
                    kind,
                    icon: meta.icon,
                    ariaLabel: meta.ariaLabel
                };
            });
    },

    _enhancementPositiveInt(value) {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
    },

    _resolveLocalRef(root, ref) {
        if (typeof ref !== 'string') return null;
        const trimmed = ref.trim();
        if (!trimmed) return null;

        let segments = null;
        if (trimmed.startsWith('#/')) {
            segments = trimmed
                .slice(2)
                .split('/')
                .map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        } else if (trimmed.startsWith('/')) {
            segments = trimmed
                .slice(1)
                .split('/')
                .filter(Boolean);
        } else {
            segments = trimmed
                .split('.')
                .map(part => part.trim())
                .filter(Boolean);
        }

        let current = root;
        for (const segment of segments) {
            if (current == null || typeof current !== 'object' || !(segment in current)) {
                return null;
            }
            current = current[segment];
        }
        return current;
    },

    _resolveResourceBreakdownRef(file, src, kind = 'enhancement') {
        const key = this._resourceBreakdownKey(src, kind);
        const breakdown = key ? src?.[key] : null;
        if (!isPlainObject(breakdown) || typeof breakdown.$ref !== 'string') return breakdown;

        const target = this._resolveLocalRef(file, breakdown.$ref);
        if (!isPlainObject(target)) {
            console.warn(`Failed to resolve ${kind} ref "${breakdown.$ref}" for source "${src?.id ?? 'unknown'}".`);
            return breakdown;
        }

        const { $ref, ...overrides } = breakdown;
        if (!Object.keys(overrides).length) return deepCloneJson(target);
        return deepMergeObjects(target, overrides);
    },

    _resolveBonusEntryRefs(file, entries, src, section = 'bonuses', seenRefs = new Set()) {
        if (!Array.isArray(entries) || !entries.length) return [];

        return entries.flatMap(entry => {
            if (!isPlainObject(entry) || typeof entry.$ref !== 'string') {
                return [deepCloneJson(entry)];
            }

            const refKey = `${src?.id ?? 'unknown'}:${section}:${entry.$ref}`;
            if (seenRefs.has(refKey)) {
                console.warn(`Detected circular bonus ref "${entry.$ref}" in source "${src?.id ?? 'unknown'}".`);
                return [];
            }

            const target = this._resolveLocalRef(file, entry.$ref);
            if (!Array.isArray(target) && !isPlainObject(target)) {
                console.warn(`Failed to resolve ${section} ref "${entry.$ref}" for source "${src?.id ?? 'unknown'}".`);
                return [];
            }

            const nextSeenRefs = new Set(seenRefs);
            nextSeenRefs.add(refKey);

            const { $ref, ...overrides } = entry;
            const resolvedTargets = Array.isArray(target)
                ? this._resolveBonusEntryRefs(file, target, src, section, nextSeenRefs)
                : this._resolveBonusEntryRefs(file, [target], src, section, nextSeenRefs);

            if (!Object.keys(overrides).length) return resolvedTargets;

            return resolvedTargets.map(resolvedEntry => (
                isPlainObject(resolvedEntry)
                    ? deepMergeObjects(resolvedEntry, overrides)
                    : deepCloneJson(resolvedEntry)
            ));
        });
    },

    _resolveSourceRefs(file, assetBasePath = './') {
        if (Array.isArray(file)) return file;
        if (!Array.isArray(file?.bonuses) || !file.bonuses.length) return file;

        return {
            ...file,
            bonuses: file.bonuses.map(rawSrc => {
                const src = this._sourceResolver.resolveSourceItemRef(rawSrc);
                const resolvedTier = isPlainObject(src?.tier) && typeof src.tier.$ref === 'string'
                    ? deepCloneJson(this._resolveLocalRef(file, src.tier.$ref) ?? src.tier)
                    : src?.tier;
                return {
                    ...src,
                    image: this._sourceResolver.resolveImageAsset(assetBasePath, src?.image_ref, src?.image),
                    tier: resolvedTier,
                    bonuses: this._resolveBonusEntryRefs(file, src?.bonuses, src, 'bonuses'),
                    ascension_bonuses: this._resolveBonusEntryRefs(file, src?.ascension_bonuses, src, 'ascension_bonuses'),
                    enhancement: this._resolveResourceBreakdownRef(file, src, 'enhancement'),
                    disenchantment: this._resolveResourceBreakdownRef(file, src, 'disenchantment')
                };
            })
        };
    },

    _enhancementAmountType(amountSpec) {
        if (amountSpec == null) return 'fixed';
        if (typeof amountSpec === 'number') return 'fixed';
        if (typeof amountSpec === 'string') {
            const trimmed = amountSpec.trim();
            if (trimmed === '') return null;
            return Number.isFinite(Number(trimmed)) ? 'fixed' : null;
        }
        if (typeof amountSpec !== 'object') return null;
        return amountSpec.type ?? 'fixed';
    },

    _resourceBreakdownUsesSymbolicFormula(amountSpec) {
        const type = this._enhancementAmountType(amountSpec);
        return !!type && !['fixed', 'table'].includes(type);
    },

    _inferEnhancementSegmentMaxLevel(segment) {
        const fromLevel = this._enhancementPositiveInt(segment?.from_level) ?? 1;
        const explicitToLevel = this._enhancementPositiveInt(segment?.to_level);

        if (Array.isArray(segment?.per_level)) {
            const derivedToLevel = fromLevel + Math.max(0, segment.per_level.length - 1);
            if (explicitToLevel != null && explicitToLevel !== derivedToLevel) return null;
            return explicitToLevel ?? derivedToLevel;
        }

        const costs = Array.isArray(segment?.costs) ? segment.costs : [];
        const tableLengths = [];

        for (const cost of costs) {
            const type = this._enhancementAmountType(cost?.amount);
            if (!type) return null;
            if (!['fixed', 'table'].includes(type)) {
                return explicitToLevel ?? null;
            }
            if (type === 'table') {
                const values = Array.isArray(cost?.amount?.values) ? cost.amount.values : null;
                if (!values?.length) return null;
                tableLengths.push(values.length);
            }
        }

        if (tableLengths.length) {
            const expectedLength = tableLengths[0];
            if (tableLengths.some(length => length !== expectedLength)) return null;
            const derivedToLevel = fromLevel + expectedLength - 1;
            if (explicitToLevel != null && explicitToLevel !== derivedToLevel) return null;
            return explicitToLevel ?? derivedToLevel;
        }

        return explicitToLevel ?? fromLevel;
    },

    _enhancementCyclingItems(segment) {
        const items = Array.isArray(segment?.cycling_items) ? segment.cycling_items : [];
        return items
            .map(item => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean);
    },

    _resolveEnhancementCyclingItem(segment, level, fallbackItem = null) {
        const items = this._enhancementCyclingItems(segment);
        if (!items.length) return fallbackItem;
        const fromLevel = Number(segment?.from_level ?? 1);
        const idx = ((level - fromLevel) % items.length + items.length) % items.length;
        return items[idx] ?? fallbackItem;
    },

    _resourceBreakdownSegments(src, kind = 'enhancement') {
        return this._resourceBreakdownData(src, kind)?.segments ?? [];
    },

    _resourceBreakdownIsInfinite(src) {
        return src?.infinite === true;
    },

    _inferEnhancementMaxLevel(enhancement) {
        const segments = Array.isArray(enhancement?.segments) ? enhancement.segments : [];
        if (!segments.length) return null;

        let maxLevel = null;
        for (const segment of segments) {
            const segmentMaxLevel = this._inferEnhancementSegmentMaxLevel(segment);
            if (segmentMaxLevel == null) return null;
            maxLevel = Math.max(maxLevel ?? segmentMaxLevel, segmentMaxLevel);
        }

        return maxLevel;
    },

    getResourceBreakdownDisplayConfig(src, kind = 'enhancement') {
        const breakdown = this._resourceBreakdownData(src, kind) ?? {};
        const display = breakdown.display ?? {};
        const levelsCfg = display.levels ?? {};
        const totalsCfg = display.totals ?? {};
        const formulaCfg = display.formula ?? {};
        const infinite = this._resourceBreakdownIsInfinite(src);
        const finiteMaxLevel = this._enhancementPositiveInt(breakdown.max_level)
            ?? this._inferEnhancementMaxLevel(breakdown);
        const supportsTotals = this.getResourceBreakdownMeta(kind).supportsTotals;

        return {
            initial_tab: display.initial_tab ?? null,
            levels: {
                enabled: levelsCfg.enabled ?? true,
                limit: this._enhancementPositiveInt(levelsCfg.limit) ?? finiteMaxLevel,
                every: this._enhancementPositiveInt(levelsCfg.every),
                tabs: this._enhancementPositiveInt(levelsCfg.tabs),
                items_per_tab: this._enhancementPositiveInt(levelsCfg.items_per_tab)
            },
            totals: {
                enabled: supportsTotals && (totalsCfg.enabled ?? (finiteMaxLevel != null)),
                upto_level: this._enhancementPositiveInt(totalsCfg.upto_level) ?? finiteMaxLevel,
                group_by: this._enhancementPositiveInt(totalsCfg.group_by)
            },
            formula: {
                enabled: formulaCfg.enabled ?? true
            },
            infinite,
            finiteMaxLevel
        };
    },

    formatResourceBreakdownAmount(value) {
        const normalized = this.normalizeValue(Number(value ?? 0), 2);
        return Number.isInteger(normalized) ? normalized.toLocaleString() : normalized.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    },

    priceBreakdownColumnCount(rows) {
        if (!rows?.length) return 1;

        const availableHeight = Math.max(320, (window.innerHeight || 900) - 48);
        const totalHeight = this._estimatePriceBreakdownHeight(rows);

        for (let columns = 1; columns <= 2; columns += 1) {
            if (totalHeight / columns <= availableHeight) return columns;
        }

        return 2;
    },

    _estimatePriceBreakdownRowHeight(row) {
        const costCount = row?.costs?.length ?? 0;
        return 22 + Math.max(1, costCount) * 34 + Math.max(0, costCount - 1) * 6 + 8;
    },

    _estimatePriceBreakdownHeight(rows) {
        const rowGap = Math.max(0, (rows.length - 1) * 8);
        return rows.reduce((sum, row) => sum + this._estimatePriceBreakdownRowHeight(row), 0) + rowGap;
    },

    resourceBreakdownResourceLabel(itemId) {
        if (!itemId) return 'Unknown';
        const item = this.data?.items?.get(itemId);
        if (item?.name) return item.name;
        return itemId
            .split('_')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    },

    resourceBreakdownResourceImage(itemId) {
        if (!itemId) return null;
        return this.data?.items?.get(itemId)?.icon ?? null;
    },

    _roundEnhancementAmount(value, roundMode = null) {
        if (!Number.isFinite(value)) return null;
        if (roundMode === 'floor') return Math.floor(value);
        if (roundMode === 'ceil') return Math.ceil(value);
        if (roundMode === 'round') return Math.round(value);
        return value;
    },

    _resourceBreakdownCumulativeEntry(src, kind) {
        if (!src || typeof src !== 'object') return null;
        if (!(this._resourceBreakdownCumulativeCache instanceof WeakMap)) {
            this._resourceBreakdownCumulativeCache = new WeakMap();
        }

        let byKind = this._resourceBreakdownCumulativeCache.get(src);
        if (!byKind) {
            byKind = new Map();
            this._resourceBreakdownCumulativeCache.set(src, byKind);
        }

        if (!byKind.has(kind)) {
            byKind.set(kind, {
                uptoLevel: 0,
                prefixByItem: new Map(),
                building: false
            });
        }

        return byKind.get(kind);
    },

    _ensureResourceBreakdownCumulativeTotals(src, kind, uptoLevel) {
        const resolvedUptoLevel = this._enhancementPositiveInt(uptoLevel);
        if (!resolvedUptoLevel) return null;

        const entry = this._resourceBreakdownCumulativeEntry(src, kind);
        if (!entry) return null;
        if (entry.uptoLevel >= resolvedUptoLevel) return entry;
        if (entry.building) return entry;

        entry.building = true;
        try {
            for (let level = entry.uptoLevel + 1; level <= resolvedUptoLevel; level += 1) {
                const levelCosts = this._resolveEnhancementLevelCosts(src, level, kind);
                const touchedItems = new Set();

                for (const cost of levelCosts) {
                    if (!cost?.item) continue;
                    const amount = Number(cost.amount ?? 0);
                    if (!Number.isFinite(amount)) continue;

                    let prefix = entry.prefixByItem.get(cost.item);
                    if (!prefix) {
                        prefix = [0];
                        entry.prefixByItem.set(cost.item, prefix);
                    }

                    const previous = prefix[level - 1] ?? prefix[prefix.length - 1] ?? 0;
                    prefix[level] = previous + amount;
                    touchedItems.add(cost.item);
                }

                for (const [itemId, prefix] of entry.prefixByItem) {
                    if (touchedItems.has(itemId)) continue;
                    const previous = prefix[level - 1] ?? prefix[prefix.length - 1] ?? 0;
                    prefix[level] = previous;
                }
            }

            entry.uptoLevel = resolvedUptoLevel;
        } finally {
            entry.building = false;
        }

        return entry;
    },

    _resourceBreakdownPrefixValue(prefix, level) {
        if (!Array.isArray(prefix)) return 0;
        const resolvedLevel = this._enhancementPositiveInt(level) ?? 0;
        if (resolvedLevel <= 0) return Number(prefix[0] ?? 0) || 0;
        if (resolvedLevel < prefix.length) {
            const value = prefix[resolvedLevel];
            return Number.isFinite(value) ? value : 0;
        }
        const lastValue = prefix[prefix.length - 1];
        return Number.isFinite(lastValue) ? lastValue : 0;
    },

    _resourceBreakdownTotalAmount(src, kind, itemId, fromLevel, toLevel) {
        if (!src || !itemId) return 0;
        const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
        const resolvedToLevel = this._enhancementPositiveInt(toLevel);
        if (!resolvedToLevel || resolvedToLevel < resolvedFromLevel) return 0;

        const entry = this._ensureResourceBreakdownCumulativeTotals(src, kind, resolvedToLevel);
        const prefix = entry?.prefixByItem?.get(itemId);
        if (!prefix) return 0;

        const totalAtToLevel = this._resourceBreakdownPrefixValue(prefix, resolvedToLevel);
        const totalBeforeFromLevel = resolvedFromLevel > 1
            ? this._resourceBreakdownPrefixValue(prefix, resolvedFromLevel - 1)
            : 0;
        return totalAtToLevel - totalBeforeFromLevel;
    },

    _resolveEnhancementAmount(src, amountSpec, level, segment) {
        if (amountSpec == null) return null;
        if (typeof amountSpec === 'number') return amountSpec;
        if (typeof amountSpec === 'string' && amountSpec.trim() !== '') {
            const parsed = Number(amountSpec);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (typeof amountSpec !== 'object') return null;

        const type = amountSpec.type ?? 'fixed';
        const fromLevel = Number(segment?.from_level ?? 1);
        const levelOffset = Number(amountSpec.level_offset ?? fromLevel);
        const cycleLength = Math.max(1, Number(amountSpec.cycle_length ?? 1));
        const rawDelta = level - levelOffset;
        const delta = cycleLength > 1
            ? Math.floor(rawDelta / cycleLength)
            : rawDelta;

        if (type === 'fixed') return Number(amountSpec.value ?? 0);
        if (type === 'table') {
            const idx = level - fromLevel;
            if (!Array.isArray(amountSpec.values)) return null;
            const value = amountSpec.values[idx];
            if (value == null) return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (type === 'linear') {
            return Number(amountSpec.base ?? 0) + Number(amountSpec.step ?? 0) * delta;
        }
        if (type === 'exponential') {
            const value = Number(amountSpec.base ?? 0) * Math.pow(Number(amountSpec.growth ?? 1), delta);
            return this._roundEnhancementAmount(value, amountSpec.round);
        }
        if (type === 'polynomial') {
            const value = Number(amountSpec.factor ?? 0) * Math.pow(delta, Number(amountSpec.power ?? 1));
            return this._roundEnhancementAmount(value, amountSpec.round);
        }
        if (type === 'resource_breakdown_total') {
            const targetKind = typeof amountSpec.kind === 'string' && amountSpec.kind.trim()
                ? amountSpec.kind.trim()
                : 'enhancement';
            const itemId = typeof amountSpec.item === 'string' && amountSpec.item.trim()
                ? amountSpec.item.trim()
                : null;
            const tier = Math.max(0, Number(amountSpec.tier ?? 0));
            const tierMultiplier = amountSpec.base_scales_with_tier ? (tier + 1) : 1;
            const total = this._resourceBreakdownTotalAmount(
                src,
                targetKind,
                itemId,
                amountSpec.from_level,
                level
            );
            const value = Number(amountSpec.base ?? 0) * tierMultiplier + Number(amountSpec.multiplier ?? 1) * total;
            return this._roundEnhancementAmount(value, amountSpec.round);
        }
        return null;
    },

    _resolveEnhancementLevelCosts(src, level, kind = 'enhancement') {
        const segments = this._resourceBreakdownSegments(src, kind);
        const segment = segments.find(entry => {
            const fromLevel = Number(entry?.from_level ?? 1);
            const toLevel = this._enhancementPositiveInt(entry?.to_level);
            return level >= fromLevel && (toLevel == null || level <= toLevel);
        });
        if (!segment) return [];

        if (Array.isArray(segment.per_level)) {
            const perLevelCosts = segment.per_level[level - segment.from_level] ?? [];
            return perLevelCosts
                .map(cost => ({
                    item: cost.item,
                    amount: typeof cost.amount === 'object'
                        ? this._resolveEnhancementAmount(src, cost.amount, level, segment)
                        : Number(cost.amount ?? 0)
                }))
                .filter(cost => cost.item && cost.amount != null && Number.isFinite(cost.amount));
        }

        return (segment.costs ?? [])
            .map(cost => ({
                item: this._resolveEnhancementCyclingItem(segment, level, cost.item),
                amount: this._resolveEnhancementAmount(src, cost.amount, level, segment)
            }))
            .filter(cost => cost.item && cost.amount != null && Number.isFinite(cost.amount));
    },

    _resourceBreakdownCostRow(item, amount) {
        return {
            item,
            amount,
            label: this.resourceBreakdownResourceLabel(item),
            image: this.resourceBreakdownResourceImage(item)
        };
    },

    _enhancementLevelRangeLabel(fromLevel, toLevel) {
        const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
        if (toLevel == null) return `Lvl ${resolvedFromLevel}+`;
        return resolvedFromLevel === toLevel
            ? `Lvl ${resolvedFromLevel}`
            : `Lvl ${resolvedFromLevel}-${toLevel}`;
    },

    _enhancementSegmentFromLevel(segment) {
        return this._enhancementPositiveInt(segment?.from_level) ?? 1;
    },

    _enhancementSegmentToLevel(segment, fallbackToLevel = null) {
        return this._enhancementPositiveInt(segment?.to_level) ?? this._enhancementPositiveInt(fallbackToLevel);
    },

    _formatEnhancementFormulaExpression(amountSpec, segment) {
        if (amountSpec == null) return null;
        if (typeof amountSpec === 'number') return this.formatResourceBreakdownAmount(amountSpec);
        if (typeof amountSpec === 'string' && amountSpec.trim() !== '') return amountSpec.trim();
        if (typeof amountSpec !== 'object') return null;

        const type = amountSpec.type ?? 'fixed';
        const fromLevel = Number(segment?.from_level ?? 1);
        const offset = Number(amountSpec.level_offset ?? fromLevel);

        if (type === 'fixed') return this.formatResourceBreakdownAmount(amountSpec.value ?? 0);
        if (type === 'table') {
            const values = Array.isArray(amountSpec.values) ? amountSpec.values : [];
            const compact = values.length > 8
                ? [...values.slice(0, 4), '...', ...values.slice(-2)]
                : values;
            return `[${compact.join(', ')}]`;
        }
        const cycleLength = Math.max(1, Number(amountSpec.cycle_length ?? 1));
        let cycleTerm;
        if (offset === 0) {
            cycleTerm = cycleLength > 1 ? `floor(lvl / ${cycleLength})` : `lvl`;
        } else {
            cycleTerm = cycleLength > 1 ? `floor((lvl - ${offset}) / ${cycleLength})` : `(lvl - ${offset})`;
        }

        if (type === 'linear') {
            const base = amountSpec.base ?? 0;
            const step = amountSpec.step ?? 0;
            return (base !== 0 ? `${this.formatResourceBreakdownAmount(base)} + ` : '') +
                ((base === 0 || step !== 1) ? `${this.formatResourceBreakdownAmount(step)} * ` : '') +
                `${cycleTerm}`;
        }
        if (type === 'exponential') {
            const expr = `${this.formatResourceBreakdownAmount(amountSpec.base ?? 0)} * ${amountSpec.growth ?? 1}^${cycleTerm}`;
            if (amountSpec.round === 'floor') return `floor(${expr})`;
            if (amountSpec.round === 'ceil') return `ceil(${expr})`;
            if (amountSpec.round === 'round') return `round(${expr})`;
            return expr;
        }
        if (type === 'polynomial') {
            const expr = `${this.formatResourceBreakdownAmount(amountSpec.factor ?? 0)} * ${cycleTerm}^${amountSpec.power ?? 1}`;
            if (amountSpec.round === 'floor') return `floor(${expr})`;
            if (amountSpec.round === 'ceil') return `ceil(${expr})`;
            if (amountSpec.round === 'round') return `round(${expr})`;
            return expr;
        }
        if (type === 'resource_breakdown_total') {
            const itemId = typeof amountSpec.item === 'string' && amountSpec.item.trim()
                ? amountSpec.item.trim()
                : null;
            const itemLabel = itemId ? this.resourceBreakdownResourceLabel(itemId) : 'resource';
            const base = Number(amountSpec.base ?? 0);
            const multiplier = Number(amountSpec.multiplier ?? 1);
            const baseExpr = amountSpec.base_scales_with_tier
                ? `${this.formatResourceBreakdownAmount(base)} * (Tier + 1)`
                : this.formatResourceBreakdownAmount(base);
            const totalExpr = `(Total invested ${itemLabel}s)`;
            const parts = [];
            if (base) parts.push(baseExpr);
            if (multiplier === 1) {
                parts.push(totalExpr);
            } else if (multiplier) {
                parts.push(`${this.formatResourceBreakdownAmount(multiplier)} * ${totalExpr}`);
            }
            if (!parts.length) return '0';
            return parts.join(' + ');
        }
        return null;
    },

    _summarizeExpandedResourceBreakdownSegment(src, kind, segment, toLevelOverride = null) {
        const fromLevel = this._enhancementSegmentFromLevel(segment);
        const toLevel = this._enhancementSegmentToLevel(segment, toLevelOverride);
        if (!toLevel || toLevel < fromLevel) return [];
        const rows = [];
        for (let level = fromLevel; level <= toLevel; level += 1) {
            const costs = this._resolveEnhancementLevelCosts(src, level, kind).map(cost =>
                this._resourceBreakdownCostRow(cost.item, Number(cost.amount ?? 0))
            );
            rows.push({
                level,
                costs,
                key: costs.map(cost => `${cost.item}:${cost.amount}`).join('|')
            });
        }

        const grouped = [];
        for (const row of rows) {
            const prev = grouped[grouped.length - 1];
            if (prev && prev.key === row.key && prev.toLevel === row.level - 1) {
                prev.toLevel = row.level;
            } else {
                grouped.push({ fromLevel: row.level, toLevel: row.level, key: row.key, costs: row.costs });
            }
        }

        return grouped.map(group => ({
            kind: 'static',
            label: this._enhancementLevelRangeLabel(group.fromLevel, group.toLevel),
            costs: group.costs
        }));
    },

    _summarizeFormulaResourceBreakdownSegment(kind, segment) {
        const fromLevel = this._enhancementSegmentFromLevel(segment);
        const cyclingItems = this._enhancementCyclingItems(segment);
        const baseCosts = segment.costs ?? [];
        const costs = cyclingItems.length
            ? cyclingItems.flatMap(item => baseCosts.map(cost => {
                const expression = this._formatEnhancementFormulaExpression(cost.amount, segment);
                return {
                    item,
                    label: this.resourceBreakdownResourceLabel(item),
                    image: this.resourceBreakdownResourceImage(item),
                    expression,
                    expressionHtml: this._formatFormulaExpressionHtml(expression)
                };
            }))
            : baseCosts.map(cost => {
                const expression = this._formatEnhancementFormulaExpression(cost.amount, segment);
                return {
                    item: cost.item,
                    label: this.resourceBreakdownResourceLabel(cost.item),
                    image: this.resourceBreakdownResourceImage(cost.item),
                    expression,
                    expressionHtml: this._formatFormulaExpressionHtml(expression)
                };
            });
        return [{
            kind: 'formula',
            label: this._enhancementLevelRangeLabel(fromLevel, this._enhancementSegmentToLevel(segment)),
            costs
        }];
    },

    getResourceBreakdownFormulaView(src, kind = 'enhancement') {
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        if (!config.formula.enabled) return { summary: null, sections: [] };

        const segments = this._resourceBreakdownSegments(src, kind);
        const hasAnyDynamicFormula = segments.some(segment =>
            (segment.costs ?? []).some(cost => this._resourceBreakdownUsesSymbolicFormula(cost.amount))
        );
        if (!hasAnyDynamicFormula) return { summary: null, sections: [] };

        const sections = [];
        for (const segment of segments) {
            const segmentFromLevel = this._enhancementSegmentFromLevel(segment);
            const segmentToLevel = this._enhancementSegmentToLevel(segment, config.levels.limit ?? config.totals.upto_level);
            const hasPerLevel = Array.isArray(segment.per_level);
            const hasTable = (segment.costs ?? []).some(cost => typeof cost.amount === 'object' && (cost.amount.type ?? 'fixed') === 'table');
            const hasDynamicFormula = (segment.costs ?? []).some(cost => this._resourceBreakdownUsesSymbolicFormula(cost.amount));
            const canExpandLevels = segmentToLevel != null && segmentToLevel >= segmentFromLevel;
            const expandedSpan = canExpandLevels ? (segmentToLevel - segmentFromLevel + 1) : null;

            if (hasDynamicFormula) {
                sections.push(...this._summarizeFormulaResourceBreakdownSegment(kind, segment));
                continue;
            }

            if ((hasPerLevel || (hasTable && expandedSpan != null && expandedSpan <= 24)) && canExpandLevels) {
                sections.push(...this._summarizeExpandedResourceBreakdownSegment(src, kind, segment, this._enhancementPositiveInt(segment?.to_level) == null ? segmentToLevel : null));
            } else {
                sections.push(...this._summarizeFormulaResourceBreakdownSegment(kind, segment));
            }
        }

        return {
            summary: sections.length ? 'Formula-driven segments are shown symbolically.' : null,
            sections
        };
    },

    _buildResourceBreakdownTotalsForRange(src, kind, fromLevel, toLevel) {
        const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
        const resolvedToLevel = this._enhancementPositiveInt(toLevel);
        if (!resolvedToLevel || resolvedToLevel < resolvedFromLevel) return [];

        const entry = this._ensureResourceBreakdownCumulativeTotals(src, kind, resolvedToLevel);
        if (!entry) return [];

        const totals = [];
        for (const [itemId, prefix] of entry.prefixByItem) {
            const totalAtToLevel = this._resourceBreakdownPrefixValue(prefix, resolvedToLevel);
            const totalBeforeFromLevel = resolvedFromLevel > 1
                ? this._resourceBreakdownPrefixValue(prefix, resolvedFromLevel - 1)
                : 0;
            const amount = totalAtToLevel - totalBeforeFromLevel;
            if (!amount) continue;
            totals.push({
                item: itemId,
                amount,
                label: this.resourceBreakdownResourceLabel(itemId),
                image: this.resourceBreakdownResourceImage(itemId)
            });
        }
        return totals;
    },

    getResourceBreakdownTotalsView(src, kind = 'enhancement') {
        const meta = this.getResourceBreakdownMeta(kind);
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const uptoLevel = config.totals.upto_level;
        if (!meta.supportsTotals || !config.totals.enabled || !uptoLevel) return { summary: null, groups: [] };

        const groupBy = config.totals.group_by;
        const groups = [];

        if (groupBy && groupBy < uptoLevel) {
            for (let toLevel = groupBy; toLevel <= uptoLevel; toLevel += groupBy) {
                groups.push({
                    label: this._enhancementLevelRangeLabel(1, toLevel),
                    costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, toLevel)
                });
            }
            if (groups[groups.length - 1]?.label !== this._enhancementLevelRangeLabel(1, uptoLevel)) {
                groups.push({
                    label: this._enhancementLevelRangeLabel(1, uptoLevel),
                    costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel)
                });
            }
        } else {
            groups.push({
                label: this._enhancementLevelRangeLabel(1, uptoLevel),
                costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel)
            });
        }

        const summary = config.infinite
            ? null
            : (config.finiteMaxLevel == null
                ? `Totals are limited to the first ${uptoLevel.toLocaleString()} levels${groupBy ? `, grouped by ${groupBy.toLocaleString()}` : ''}.`
                : (groupBy ? `Totals grouped by ${groupBy.toLocaleString()} levels.` : null));

        return { summary, groups };
    },

    getResourceBreakdown(src, kind = 'enhancement', fromLevel = 1, toLevel = null) {
        if (!this.hasPriceBreakdown(src, kind)) return { rows: [], totals: [] };
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const resolvedToLevel = this._enhancementPositiveInt(toLevel) ?? config.levels.limit ?? config.totals.upto_level;
        if (!resolvedToLevel || resolvedToLevel < fromLevel) return { rows: [], totals: [] };

        const rows = [];
        const totals = new Map();

        for (let level = fromLevel; level <= resolvedToLevel; level += 1) {
            const costs = this._resolveEnhancementLevelCosts(src, level, kind).map(cost => {
                const amount = Number(cost.amount ?? 0);
                const enriched = this._resourceBreakdownCostRow(cost.item, amount);
                totals.set(cost.item, {
                    item: cost.item,
                    amount: (totals.get(cost.item)?.amount ?? 0) + amount,
                    label: enriched.label,
                    image: enriched.image
                });
                return enriched;
            });
            rows.push({ level, costs });
        }

        return {
            rows: rows.filter(row => row.costs.length),
            totals: [...totals.values()]
        };
    },

    getResourceBreakdownLevelsView(src, kind = 'enhancement') {
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const levelLimit = config.levels.limit;
        if (!config.levels.enabled || !levelLimit) return { summary: null, rows: [] };

        const breakdown = this.getResourceBreakdown(src, kind, 1, levelLimit);
        const every = config.levels.every;
        const rows = every
            ? breakdown.rows.filter(row => row.level === 1 || row.level % every === 0)
            : breakdown.rows;
        let summary = null;
        if (config.infinite) {
            summary = null;
        } else if (config.finiteMaxLevel != null && levelLimit < config.finiteMaxLevel) {
            summary = `Showing levels 1-${levelLimit.toLocaleString()} of ${config.finiteMaxLevel.toLocaleString()}.`;
        } else if (config.finiteMaxLevel == null) {
            summary = `Showing the first ${levelLimit.toLocaleString()} levels.`;
        }
        if (every) {
            const cadenceText = `showing level 1 and levels divisible by ${every.toLocaleString()}`;
            summary = summary
                ? `${summary} Levels view is filtered, ${cadenceText}.`
                : `Levels view is filtered, ${cadenceText}.`;
        }

        const requestedTabs = config.levels.tabs;
        const requestedItemsPerTab = config.levels.items_per_tab;
        let tabs = [];
        if (levelLimit > 1) {
            let tabCount = null;
            let levelsPerTab = null;
            if (requestedItemsPerTab && config.finiteMaxLevel != null) {
                levelsPerTab = Math.min(requestedItemsPerTab, levelLimit);
                tabCount = Math.ceil(levelLimit / levelsPerTab);
            } else if (requestedTabs) {
                tabCount = Math.min(requestedTabs, levelLimit);
                levelsPerTab = Math.ceil(levelLimit / tabCount);
            }
            if (tabCount && levelsPerTab) {
                for (let idx = 0; idx < tabCount; idx += 1) {
                    const fromLevel = idx * levelsPerTab + 1;
                    const toLevel = Math.min(levelLimit, fromLevel + levelsPerTab - 1);
                    tabs.push({
                        id: `levels:${idx + 1}`,
                        label: this._enhancementLevelRangeLabel(fromLevel, toLevel),
                        fromLevel,
                        toLevel,
                        rows: rows.filter(row => row.level >= fromLevel && row.level <= toLevel)
                    });
                }
            }
        }

        return { summary, rows, tabs };
    },

    shouldHideResourceBreakdownSectionLabel(entries, label) {
        return entries?.length === 1 && label === this._enhancementLevelRangeLabel(1, 1);
    },

    isSingleLevelOneBreakdown(rows) {
        return rows?.length === 1 && Number(rows[0]?.level) === 1;
    },
};
