import { isPlainObject, deepCloneJson, deepMergeObjects, formatCompactNumber } from '../lib/utils.js?v=a60e1a39f6';

const ITEMS_CATALOG_BASE_PATH = '../items/items.json';

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
                icon_ref: 'items:gold',
                icon: '../items/images/gold.png?v=68c77ec774',
                assetBasePath: ITEMS_CATALOG_BASE_PATH,
                ariaLabel: 'Open enhancement price breakdown popover',
                emptyText: 'No enhancement prices',
                supportsTotals: true
            },
            disenchantment: {
                kind: 'disenchantment',
                icon_ref: 'bonuses:salvage',
                icon: './images/salvage.png?v=a56ee3e91f',
                assetBasePath: './',
                ariaLabel: 'Open disenchantment return breakdown popover',
                emptyText: 'No disenchantment returns',
                supportsTotals: false
            }
        };
        return meta[kind] ?? meta.enhancement;
    },

    _resolveResourceBreakdownImage(assetBasePath, assetRef, assetPath) {
        if (!this._sourceResolver) return assetPath ?? null;
        return this._sourceResolver.resolveImageAsset(assetBasePath, assetRef, assetPath);
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

    _resourceBreakdownModifierValue(value, fallback = 0) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    },

    _resourceBreakdownModifierStep(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : 'any';
    },

    _resourceBreakdownModifierPrecision(step) {
        if (typeof step !== 'number' || !Number.isFinite(step)) return null;
        const normalized = step.toString();
        const decimals = normalized.split('.')[1] ?? '';
        return decimals.length;
    },

    _normalizeResourceBreakdownModifier(definition, index = 0) {
        if (!isPlainObject(definition) || typeof definition.id !== 'string' || !definition.id.trim()) {
            return null;
        }

        const id = definition.id.trim();
        const defaultValue = this._resourceBreakdownModifierValue(definition.default, 0);
        const min = this._resourceBreakdownModifierValue(definition.min, 0);
        const maxValue = Number(definition.max);
        const max = Number.isFinite(maxValue) ? maxValue : null;

        return {
            id,
            key: typeof definition.key === 'string' && definition.key.trim()
                ? definition.key.trim()
                : (this.data?.bonus_types?.find?.(entry => entry.id === id)?.key ?? id),
            label: typeof definition.label === 'string' && definition.label.trim()
                ? definition.label.trim()
                : id,
            formula_variable: typeof definition.formula_variable === 'string' && definition.formula_variable.trim()
                ? definition.formula_variable.trim()
                : id,
            operation: typeof definition.operation === 'string' && definition.operation.trim()
                ? definition.operation.trim()
                : 'multiply',
            default: max == null ? Math.max(min, defaultValue) : Math.min(max, Math.max(min, defaultValue)),
            min,
            max,
            step: this._resourceBreakdownModifierStep(definition.step),
            order: Number.isFinite(Number(definition.order)) ? Number(definition.order) : index
        };
    },

    getResourceBreakdownCostModifiers(src, kind = 'enhancement') {
        const definitions = this._resourceBreakdownData(src, kind)?.cost_modifiers;
        if (!Array.isArray(definitions) || !definitions.length) return [];

        return definitions
            .map((definition, index) => this._normalizeResourceBreakdownModifier(definition, index))
            .filter(Boolean)
            .sort((left, right) => left.order - right.order);
    },

    resourceBreakdownModifierDefinitionsById() {
        const definitions = new Map();
        const sources = Array.isArray(this.data?.sources) ? this.data.sources : [];
        for (const src of sources) {
            for (const kind of ['enhancement', 'disenchantment']) {
                for (const modifier of this.getResourceBreakdownCostModifiers(src, kind)) {
                    if (!definitions.has(modifier.id)) {
                        definitions.set(modifier.id, modifier);
                    }
                }
            }
        }
        return definitions;
    },

    resourceBreakdownModifierDefinitionsByKey() {
        const definitions = new Map();
        for (const modifier of this.resourceBreakdownModifierDefinitionsById().values()) {
            if (!definitions.has(modifier.key)) {
                definitions.set(modifier.key, modifier);
            }
        }
        return definitions;
    },

    getPersistedResourceBreakdownModifierValues() {
        const definitions = this.resourceBreakdownModifierDefinitionsById();
        const values = this.resourceBreakdownModifierValues ?? {};
        const persisted = {};
        for (const [id, modifier] of definitions) {
            if (!Object.prototype.hasOwnProperty.call(values, id)) continue;
            const numeric = this._resourceBreakdownModifierValue(values[id], modifier.default);
            const clamped = modifier.max == null
                ? Math.max(modifier.min, numeric)
                : Math.min(modifier.max, Math.max(modifier.min, numeric));
            if (clamped !== modifier.default) persisted[id] = clamped;
        }
        return persisted;
    },

    getResourceBreakdownModifierState(src, kind = 'enhancement') {
        return this._resourceBreakdownModifierValues(src, kind, this.resourceBreakdownModifierValues);
    },

    setResourceBreakdownModifierValue(src, kind = 'enhancement', modifierId, value) {
        const modifier = this.getResourceBreakdownCostModifiers(src, kind)
            .find(entry => entry.id === modifierId);
        if (!modifier) return;

        const numeric = this._resourceBreakdownModifierValue(value, modifier.default);
        const clamped = modifier.max == null
            ? Math.max(modifier.min, numeric)
            : Math.min(modifier.max, Math.max(modifier.min, numeric));
        const nextValues = { ...(this.resourceBreakdownModifierValues ?? {}) };
        if (clamped === modifier.default) {
            delete nextValues[modifier.id];
        } else {
            nextValues[modifier.id] = clamped;
        }
        this.resourceBreakdownModifierValues = nextValues;
    },

    _resourceBreakdownModifierValues(src, kind = 'enhancement', values = null) {
        const modifiers = this.getResourceBreakdownCostModifiers(src, kind);
        if (!modifiers.length) return {};

        return modifiers.reduce((acc, modifier) => {
            const rawValue = values != null && Object.prototype.hasOwnProperty.call(values, modifier.id)
                ? values[modifier.id]
                : modifier.default;
            const numeric = this._resourceBreakdownModifierValue(rawValue, modifier.default);
            const clamped = modifier.max == null
                ? Math.max(modifier.min, numeric)
                : Math.min(modifier.max, Math.max(modifier.min, numeric));
            acc[modifier.id] = clamped;
            return acc;
        }, {});
    },

    _resourceBreakdownModifierFingerprint(src, kind = 'enhancement', values = null) {
        const modifiers = this.getResourceBreakdownCostModifiers(src, kind);
        if (!modifiers.length) return '';

        const normalizedValues = this._resourceBreakdownModifierValues(src, kind, values);
        return modifiers
            .map(modifier => `${modifier.id}:${normalizedValues[modifier.id] ?? modifier.default}`)
            .join('|');
    },

    _applyResourceBreakdownModifier(amount, modifier, value) {
        if (!Number.isFinite(amount)) return null;
        const numericValue = this._resourceBreakdownModifierValue(value, modifier?.default ?? 0);
        const operation = modifier?.operation ?? 'multiply';

        if (operation === 'multiply_percent_remaining') {
            return amount * (100 - numericValue) / 100;
        }
        if (operation === 'divide_percent_increase') {
            return amount * 100 / (100 + numericValue);
        }
        if (operation === 'multiply') {
            return amount * numericValue;
        }

        return amount;
    },

    _applyResourceBreakdownCostModifiers(src, kind = 'enhancement', amount, values = null) {
        let nextAmount = Number(amount);
        if (!Number.isFinite(nextAmount)) return null;

        const modifiers = this.getResourceBreakdownCostModifiers(src, kind);
        if (!modifiers.length) return nextAmount;

        const normalizedValues = this._resourceBreakdownModifierValues(src, kind, values);
        for (const modifier of modifiers) {
            nextAmount = this._applyResourceBreakdownModifier(nextAmount, modifier, normalizedValues[modifier.id]);
            if (!Number.isFinite(nextAmount)) return null;
        }

        return nextAmount;
    },

    _resourceBreakdownModifierFormulaExpression(modifier, value) {
        const operation = modifier?.operation ?? 'multiply';
        const formulaVariable = typeof modifier?.formula_variable === 'string' && modifier.formula_variable.trim()
            ? modifier.formula_variable.trim()
            : modifier?.id ?? 'Modifier';
        const variableToken = formulaVariable.replace(/\s+/g, '_');

        if (operation === 'multiply_percent_remaining') {
            return `Price * (100 - ${variableToken}) / 100`;
        }
        if (operation === 'divide_percent_increase') {
            return `Price * 100 / (100 + ${variableToken})`;
        }
        if (operation === 'multiply') {
            return `Price * ${variableToken}`;
        }

        return 'Price';
    },

    getResourceBreakdownCostModifierFormulaRows(src, kind = 'enhancement', modifierValues = null) {
        const modifiers = this.getResourceBreakdownCostModifiers(src, kind);
        if (!modifiers.length) return [];

        const normalizedValues = this._resourceBreakdownModifierValues(src, kind, modifierValues);
        return modifiers.map(modifier => {
            const expression = this._resourceBreakdownModifierFormulaExpression(
                modifier,
                normalizedValues[modifier.id]
            );
            return {
                id: modifier.id,
                label: modifier.label,
                expression,
                expressionHtml: this._formatFormulaExpressionHtml(expression)
            };
        });
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
                    icon: this._resolveResourceBreakdownImage(meta.assetBasePath ?? './', meta.icon_ref, meta.icon),
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
        return this._resolveResourceBreakdownNodeRefs(file, breakdown, src, kind);
    },

    _resolveResourceBreakdownTemplateString(value, vars) {
        if (typeof value !== 'string' || !isPlainObject(vars)) return value;
        return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
            Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
        ));
    },

    _resolveResourceBreakdownNodeRefs(file, node, src, kind = 'enhancement', seenRefs = new Set(), inheritedVars = null) {
        if (Array.isArray(node)) {
            return node.map(entry => this._resolveResourceBreakdownNodeRefs(file, entry, src, kind, seenRefs, inheritedVars));
        }
        if (!isPlainObject(node)) {
            return typeof node === 'string'
                ? this._resolveResourceBreakdownTemplateString(node, inheritedVars)
                : node;
        }

        const localVars = isPlainObject(node.$vars) ? node.$vars : null;
        const activeVars = localVars
            ? { ...(isPlainObject(inheritedVars) ? inheritedVars : {}), ...localVars }
            : inheritedVars;

        if (typeof node.$ref === 'string') {
            const refKey = `${src?.id ?? 'unknown'}:${kind}:${node.$ref}`;
            if (seenRefs.has(refKey)) {
                console.warn(`Detected circular ${kind} ref "${node.$ref}" in source "${src?.id ?? 'unknown'}".`);
                return deepCloneJson(node);
            }

            const target = this._resolveLocalRef(file, node.$ref);
            if (!isPlainObject(target) && !Array.isArray(target)) {
                console.warn(`Failed to resolve ${kind} ref "${node.$ref}" for source "${src?.id ?? 'unknown'}".`);
                return deepCloneJson(node);
            }

            const nextSeenRefs = new Set(seenRefs);
            nextSeenRefs.add(refKey);

            const resolvedTarget = this._resolveResourceBreakdownNodeRefs(file, target, src, kind, nextSeenRefs, activeVars);
            const { $ref, $vars, ...overrides } = node;

            const merged = Object.keys(overrides).length
                ? (isPlainObject(resolvedTarget)
                    ? deepMergeObjects(resolvedTarget, overrides)
                    : deepCloneJson(overrides))
                : deepCloneJson(resolvedTarget);

            return this._resolveResourceBreakdownNodeRefs(file, merged, src, kind, nextSeenRefs, activeVars);
        }

        const resolved = {};
        for (const [key, value] of Object.entries(node)) {
            if (key === '$vars') continue;
            resolved[key] = this._resolveResourceBreakdownNodeRefs(file, value, src, kind, seenRefs, activeVars);
        }
        return resolved;
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
                    bonuses: this._resolveBonusEntryRefs(file, src?.bonuses, src, 'bonuses')
                        .map(entry => this._sourceResolver.resolveBonusEntryAssetRefs(assetBasePath, entry)),
                    ascension_bonuses: this._resolveBonusEntryRefs(file, src?.ascension_bonuses, src, 'ascension_bonuses')
                        .map(entry => this._sourceResolver.resolveBonusEntryAssetRefs(assetBasePath, entry)),
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
        return formatCompactNumber(normalized, { compactFrom: 1_000_000_000 });
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
        const item = this.data?.items?.get(itemId) ?? null;
        if (!item) return null;
        return this._resolveResourceBreakdownImage(
            item?._asset_base_path ?? ITEMS_CATALOG_BASE_PATH,
            item?.icon_ref,
            item?.icon
        );
    },

    _roundEnhancementAmount(value, roundMode = null) {
        if (!Number.isFinite(value)) return null;
        if (roundMode === 'floor') return Math.floor(value);
        if (roundMode === 'ceil') return Math.ceil(value);
        if (roundMode === 'round') return Math.round(value);
        return value;
    },

    _resourceBreakdownCumulativeEntry(src, kind, modifierFingerprint = '') {
        if (!src || typeof src !== 'object') return null;
        if (!(this._resourceBreakdownCumulativeCache instanceof WeakMap)) {
            this._resourceBreakdownCumulativeCache = new WeakMap();
        }

        let byKind = this._resourceBreakdownCumulativeCache.get(src);
        if (!byKind) {
            byKind = new Map();
            this._resourceBreakdownCumulativeCache.set(src, byKind);
        }

        const cacheKey = `${kind}:${modifierFingerprint}`;

        if (!byKind.has(cacheKey)) {
            byKind.set(cacheKey, {
                uptoLevel: 0,
                prefixByItem: new Map(),
                building: false
            });
        }

        return byKind.get(cacheKey);
    },

    _ensureResourceBreakdownCumulativeTotals(src, kind, uptoLevel, modifierValues = null) {
        const resolvedUptoLevel = this._enhancementPositiveInt(uptoLevel);
        if (!resolvedUptoLevel) return null;

        const modifierFingerprint = this._resourceBreakdownModifierFingerprint(src, kind, modifierValues);
        const entry = this._resourceBreakdownCumulativeEntry(src, kind, modifierFingerprint);
        if (!entry) return null;
        if (entry.uptoLevel >= resolvedUptoLevel) return entry;
        if (entry.building) return entry;

        entry.building = true;
        try {
            for (let level = entry.uptoLevel + 1; level <= resolvedUptoLevel; level += 1) {
                const levelCosts = this._resolveEnhancementLevelCosts(src, level, kind, modifierValues);
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

    _resolveEnhancementLevelCosts(src, level, kind = 'enhancement', modifierValues = null) {
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
                    amount: this._applyResourceBreakdownCostModifiers(
                        src,
                        kind,
                        typeof cost.amount === 'object'
                        ? this._resolveEnhancementAmount(src, cost.amount, level, segment)
                        : Number(cost.amount ?? 0),
                        modifierValues
                    )
                }))
                .filter(cost => cost.item && cost.amount != null && Number.isFinite(cost.amount));
        }

        return (segment.costs ?? [])
            .map(cost => ({
                item: this._resolveEnhancementCyclingItem(segment, level, cost.item),
                amount: this._applyResourceBreakdownCostModifiers(
                    src,
                    kind,
                    this._resolveEnhancementAmount(src, cost.amount, level, segment),
                    modifierValues
                )
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

    _formatEnhancementLevelTerm(offset, cycleLength = 1) {
        const normalizedCycleLength = Math.max(1, Number(cycleLength ?? 1));
        const normalizedOffset = Number(offset ?? 0);
        let baseTerm = 'lvl';

        if (normalizedOffset > 0) {
            baseTerm = `(lvl - ${normalizedOffset})`;
        } else if (normalizedOffset < 0) {
            baseTerm = `(lvl + ${Math.abs(normalizedOffset)})`;
        }

        if (normalizedCycleLength === 1) return baseTerm;
        if (baseTerm === 'lvl') return `floor(lvl / ${normalizedCycleLength})`;
        return `floor(${baseTerm} / ${normalizedCycleLength})`;
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
        const cycleTerm = this._formatEnhancementLevelTerm(offset, cycleLength);

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

    _summarizeExpandedResourceBreakdownSegment(src, kind, segment, toLevelOverride = null, modifierValues = null) {
        const fromLevel = this._enhancementSegmentFromLevel(segment);
        const toLevel = this._enhancementSegmentToLevel(segment, toLevelOverride);
        if (!toLevel || toLevel < fromLevel) return [];
        const rows = [];
        for (let level = fromLevel; level <= toLevel; level += 1) {
            const costs = this._resolveEnhancementLevelCosts(src, level, kind, modifierValues).map(cost =>
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

    _summarizeFormulaResourceBreakdownSegment(src, kind, segment) {
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

    getResourceBreakdownFormulaView(src, kind = 'enhancement', modifierValues = null) {
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
                sections.push(...this._summarizeFormulaResourceBreakdownSegment(src, kind, segment));
                continue;
            }

            if ((hasPerLevel || (hasTable && expandedSpan != null && expandedSpan <= 24)) && canExpandLevels) {
                sections.push(...this._summarizeExpandedResourceBreakdownSegment(
                    src,
                    kind,
                    segment,
                    this._enhancementPositiveInt(segment?.to_level) == null ? segmentToLevel : null,
                    modifierValues
                ));
            } else {
                sections.push(...this._summarizeFormulaResourceBreakdownSegment(src, kind, segment));
            }
        }

        return {
            summary: sections.length ? 'Formula-driven segments are shown symbolically.' : null,
            sections
        };
    },

    _buildResourceBreakdownTotalsForRange(src, kind, fromLevel, toLevel, modifierValues = null) {
        const resolvedFromLevel = this._enhancementPositiveInt(fromLevel) ?? 1;
        const resolvedToLevel = this._enhancementPositiveInt(toLevel);
        if (!resolvedToLevel || resolvedToLevel < resolvedFromLevel) return [];

        const entry = this._ensureResourceBreakdownCumulativeTotals(src, kind, resolvedToLevel, modifierValues);
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

    getResourceBreakdownTotalsView(src, kind = 'enhancement', modifierValues = null) {
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
                    costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, toLevel, modifierValues)
                });
            }
            if (groups[groups.length - 1]?.label !== this._enhancementLevelRangeLabel(1, uptoLevel)) {
                groups.push({
                    label: this._enhancementLevelRangeLabel(1, uptoLevel),
                    costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel, modifierValues)
                });
            }
        } else {
            groups.push({
                label: this._enhancementLevelRangeLabel(1, uptoLevel),
                costs: this._buildResourceBreakdownTotalsForRange(src, kind, 1, uptoLevel, modifierValues)
            });
        }

        const summary = config.infinite
            ? null
            : (config.finiteMaxLevel == null
                ? `Totals are limited to the first ${uptoLevel.toLocaleString()} levels${groupBy ? `, grouped by ${groupBy.toLocaleString()}` : ''}.`
                : (groupBy ? `Totals grouped by ${groupBy.toLocaleString()} levels.` : null));

        return { summary, groups };
    },

    getResourceBreakdown(src, kind = 'enhancement', fromLevel = 1, toLevel = null, modifierValues = null) {
        if (!this.hasPriceBreakdown(src, kind)) return { rows: [], totals: [] };
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const resolvedToLevel = this._enhancementPositiveInt(toLevel) ?? config.levels.limit ?? config.totals.upto_level;
        if (!resolvedToLevel || resolvedToLevel < fromLevel) return { rows: [], totals: [] };

        const rows = [];
        const totals = new Map();

        for (let level = fromLevel; level <= resolvedToLevel; level += 1) {
            const costs = this._resolveEnhancementLevelCosts(src, level, kind, modifierValues).map(cost => {
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

    getResourceBreakdownLevelsView(src, kind = 'enhancement', modifierValues = null) {
        const config = this.getResourceBreakdownDisplayConfig(src, kind);
        const levelLimit = config.levels.limit;
        if (!config.levels.enabled || !levelLimit) return { summary: null, rows: [] };

        const breakdown = this.getResourceBreakdown(src, kind, 1, levelLimit, modifierValues);
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
