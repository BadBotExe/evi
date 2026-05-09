import { formatVal, formatValExact, normalizeValue, sharedDisplayDecimals } from '../utils.js?v=7e5a144c2d';
import { optimize } from '../optimizer.js?v=82538a38d9';

/**
 * Bonus calculation mixin.
 * Handles resolving bonus values, applying formulas, generating tier rows,
 * running the optimizer, and computing compound totals.
 */
export const bonusMethods = {
    resolveSourceBonusValue(src, bonusEntry) {
        const petProgression = this._resolvePetProgression(src, bonusEntry);
        if (petProgression) {
            return this._resolvePetProgressionValue(petProgression, bonusEntry);
        }

        const formula = this._resolveFormula(src, bonusEntry);
        return formula ? this._applyFormula(formula, bonusEntry.unlock_at_tier ?? 1) : (bonusEntry.value ?? 0);
    },

    _bonusMatchesClass(b, src) {
        const classes = b.classes || src.classes;
        return !classes || classes.includes(this.selectedClass);
    },

    _resolveValue(b) {
        return this._calculateValue(b.value, b.scales_with, b.scale_formula);
    },

    _calculateValue(val, scales_with, scaleFormula = null) {
        const baseVal = Number(val ?? 0);
        const p = this.parameters?.find(p => p.id === scales_with);
        if (!p) return baseVal;

        if (scaleFormula?.type === 'param_over_base_minus_value') {
            const denominator = Number(scaleFormula.base ?? 0) - baseVal;
            if (!Number.isFinite(denominator) || denominator === 0) return 0;
            return p.value / denominator;
        }

        return p.value * baseVal;
    },

    _resolveFormula(src, bonusEntry) {
        if (src.tiers_formula === false || bonusEntry?.tiers_formula === false) return null;
        if (bonusEntry?.value !== undefined && !bonusEntry?.tiers_formula) return null;
        const global = this.data.tiers_formula;
        const file   = src._file_tiers_formula;
        const entity = typeof src.tiers_formula === 'object' ? src.tiers_formula : null;
        const bonus  = typeof bonusEntry?.tiers_formula === 'object' ? bonusEntry.tiers_formula : null;
        if (!global && !file && !entity && !bonus) return null;
        return Object.assign({}, global ?? {}, file ?? {}, entity ?? {}, bonus ?? {});
    },

    _resolveTierLabel(src, bonusEntry) {
        const template =
            bonusEntry?.tier_label ??
            src.tier_label ??
            src._file_tier_label ??
            this.data.tier_label ??
            '[T{tier}]';
        return tier => template
            .replace('{name}', src?.name ?? '')
            .replace('{tier}', tier);
    },

    _resolveTierRowLabel(src, bonusEntry, formula) {
        const template =
            formula?.tier_label ??
            bonusEntry?.tier_label ??
            src.tier_label ??
            src._file_tier_label ??
            this.data.tier_label ??
            null;
        if (!template) return null;
        return tier => template
            .replace('{name}', src?.name ?? '')
            .replace('{tier}', tier);
    },

    srcTierLabel(src, bonus) {
        if (!bonus?._is_ascension) return null;
        const labelFn = this._resolveTierLabel(src, bonus);
        return labelFn(bonus.tiers_formula?.max_tier ?? src.max_ascension);
    },

    _formulaSteps(formula, tierOffset = 1) {
        const step = formula.step ?? 1;
        const startOffset = formula.init_at_unlock_tier ? 0 : 1;
        return Math.max(0, Math.floor((formula.max_tier - tierOffset + startOffset) / step));
    },

    _roundFormulaValue(value, mode = 'none') {
        const numeric = Number(value ?? 0);
        if (!Number.isFinite(numeric)) return 0;
        if (mode === 'floor') return Math.floor(numeric);
        if (mode === 'ceil') return Math.ceil(numeric);
        if (mode === 'none') return numeric;
        return Math.round(numeric);
    },

    _applyFormula(formula, tierOffset = 1) {
        const steps = this._formulaSteps(formula, tierOffset);
        if (formula.type === 'base_percent') {
            const init = Number(formula.init ?? 0);
            const percent = Number(formula.percent ?? formula.coeff ?? 0);
            const growthPerStep = init * (percent / 100);
            return this._roundFormulaValue(
                init + (steps * growthPerStep),
                formula.rounding ?? 'none'
            );
        }

        return (formula.init ?? 0) + steps * (formula.coeff ?? 0);
    },

    _resolvePetProgression(src, bonusEntry) {
        const progression = src?.pet_progression ?? src?._file_pet_progression;
        if (!progression) return null;
        if (bonusEntry?.pet_base != null) return progression;
        if (!Array.isArray(bonusEntry?.tier_bases) || !bonusEntry.tier_bases.length) return null;
        return progression;
    },

    _petLevelMultiplier(level, progression) {
        const formula = progression?.formula ?? {};
        return (Number(formula.level_coeff ?? 0.0162) * level) + Number(formula.level_base ?? 0.19);
    },

    _resolvePetTierUnitType(bonusEntry, tier) {
        const fallback = bonusEntry?.unit_type ?? 'flat';
        if (!bonusEntry || tier == null) return fallback;

        const tierUnitTypes = Array.isArray(bonusEntry.tier_unit_types)
            ? bonusEntry.tier_unit_types
            : (Array.isArray(bonusEntry.unit_types_by_tier) ? bonusEntry.unit_types_by_tier : null);
        if (tierUnitTypes?.length) {
            return tierUnitTypes[tier - 1] ?? fallback;
        }

        const overrides = bonusEntry.tier_unit_type_overrides;
        if (overrides && typeof overrides === 'object') {
            return overrides[tier] ?? fallback;
        }

        return fallback;
    },

    _formatTierBadgeLabel(tiers) {
        const resolvedTiers = [...new Set((tiers ?? []).map(Number).filter(Number.isFinite))];
        if (!resolvedTiers.length) return null;
        return `T${Math.max(...resolvedTiers)}`;
    },

    _splitPetBonusByUnitType(src, bonusEntry) {
        const progression = this._resolvePetProgression(src, bonusEntry);
        if (!progression || bonusEntry?.pet_base != null || !Array.isArray(bonusEntry?.tier_bases)) {
            return [bonusEntry];
        }

        const tiers = progression?.tiers ?? {};
        const minTier = Number(tiers.min ?? 1);
        const maxTier = Number(tiers.max ?? bonusEntry.tier_bases.length);
        const byUnitType = new Map();

        for (let tier = minTier; tier <= maxTier; tier += 1) {
            const unitType = this._resolvePetTierUnitType(bonusEntry, tier);
            if (!byUnitType.has(unitType)) byUnitType.set(unitType, []);
            byUnitType.get(unitType).push(tier);
        }

        if (byUnitType.size <= 1) return [bonusEntry];

        return [...byUnitType.entries()].map(([unitType, unitTiers]) => {
            const maxTierForUnitType = Math.max(...unitTiers);
            return {
                ...bonusEntry,
                unit_type: unitType,
                value: this._resolvePetProgressionValue(progression, bonusEntry, maxTierForUnitType),
                _tierBadgeLabel: this._formatTierBadgeLabel(unitTiers),
                _petTierUnitTypeVariant: true,
                _petTierVariantTiers: [...unitTiers]
            };
        });
    },

    _displayBonusVariants(src, bonusEntry) {
        return this._splitPetBonusByUnitType(src, bonusEntry);
    },

    _resolvePetProgressionValue(progression, bonusEntry, tier = null, level = null) {
        const tiers = progression?.tiers ?? {};
        const levels = progression?.levels ?? {};
        const maxLevel = Number(levels.max ?? 50);
        const resolvedLevel = Math.max(1, level ?? maxLevel);
        const base = bonusEntry?.pet_base != null
            ? Number(bonusEntry.pet_base ?? 0)
            : Number(bonusEntry.tier_bases[Math.max(1, Math.min(tier ?? Number(tiers.max ?? bonusEntry.tier_bases.length), bonusEntry.tier_bases.length)) - 1] ?? 0);
        return base * this._petLevelMultiplier(resolvedLevel, progression);
    },

    _generatePetLevelRows(progression, bonusEntry, bonusId) {
        const levels = progression?.levels ?? {};
        const minLevel = Number(levels.min ?? 1);
        const maxLevel = Number(levels.max ?? 50);
        const base = Number(bonusEntry?.pet_base ?? 0);
        const rows = [];

        for (let level = minLevel; level <= maxLevel; level += 1) {
            const multiplier = this._petLevelMultiplier(level, progression);
            const row = {
                label: `Lvl ${level}`,
                _petLevel: level,
                _petBase: base,
                _petMultiplier: multiplier
            };
            row[bonusId] = base * multiplier;
            rows.push(row);
        }

        return rows;
    },

    _generateTierRows(src, formula, bonusEntry, bonusId) {
        const rows = [];
        if (!formula?.type) return rows;

        const step = formula.step ?? 1;
        const startTier = bonusEntry.unlock_at_tier ?? 1;
        for (let i = startTier; i <= formula.max_tier; i += step) {
            const formulaValue = this._applyFormula({ ...formula, max_tier: i }, startTier);
            const val = this._calculateValue(
                formulaValue,
                bonusEntry.scales_with,
                bonusEntry.scale_formula
            );
            const labelFn = this._resolveTierRowLabel(src, bonusEntry, formula);
            const label = formula.tier_labels
                ? formula.tier_labels[i - startTier]
                : labelFn
                    ? labelFn(i)
                    : (formula.label_prefix || 'Tier') + ' ' + i;
            const row = { label, _formulaValue: formulaValue };
            row[bonusId] = val;
            rows.push(row);
        }
        return rows;
    },

    _getTierRows(src, bonusEntry, bonusId) {
        const progression = this._resolvePetProgression(src, bonusEntry);
        if (progression && bonusEntry?.pet_base != null) {
            return this._generatePetLevelRows(progression, bonusEntry, bonusId);
        }
        if (src.tiers) return src.tiers;
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula) return null;
        return this._generateTierRows(src, formula, bonusEntry, bonusId);
    },

    _generateTierMatrix(src, progression, bonusEntry, bonusId) {
        const tiers = progression?.tiers ?? {};
        const levels = progression?.levels ?? {};
        const minTier = Number(tiers.min ?? 1);
        const maxTier = Number(tiers.max ?? bonusEntry.tier_bases.length);
        const minLevel = Number(levels.min ?? 1);
        const maxLevel = Number(levels.max ?? 50);
        const collections = [];

        for (let tier = minTier; tier <= maxTier; tier += 1) {
            const rows = [];
            const base = Number(bonusEntry.tier_bases[tier - 1] ?? 0);
            for (let level = minLevel; level <= maxLevel; level += 1) {
                const multiplier = this._petLevelMultiplier(level, progression);
                const row = {
                    label: `Lvl ${level}`,
                    _petTier: tier,
                    _petLevel: level,
                    _unitType: this._resolvePetTierUnitType(bonusEntry, tier),
                    _petBase: base,
                    _petMultiplier: multiplier
                };
                row[bonusId] = base * multiplier;
                rows.push(row);
            }
            collections.push({
                label: `T${tier}`,
                rows
            });
        }

        return collections;
    },

    _getTierMatrix(src, bonusEntry, bonusId) {
        if (bonusEntry?.pet_base != null) return null;
        const progression = this._resolvePetProgression(src, bonusEntry);
        if (!progression) return null;
        return this._generateTierMatrix(src, progression, bonusEntry, bonusId);
    },

    _resolveBonusIds(bonusId) {
        const parents = this.data.bonus_types
            .filter(bt => bt.aliases?.includes(bonusId))
            .map(bt => bt.id);
        return [bonusId, ...parents];
    },

    hasTiers(entry) {
        return entry.bonuses.some(b =>
            !!this._getTierRows(entry.src, b, this.selectedBonus) ||
            !!this._getTierMatrix(entry.src, b, this.selectedBonus)
        );
    },

    bonusHasTiers(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        return group.some(b =>
            !!this._getTierRows(src, b, b.bonus) ||
            !!this._getTierMatrix(src, b, b.bonus)
        );
    },

    _tierGroupLabel(baseLabel, bonusId, showBonusLabel) {
        if (!showBonusLabel) return baseLabel;
        return `${baseLabel} (${this.bonusLabel(bonusId)})`;
    },

    _tierTabSelectionKey(src, bonusEntry) {
        return [
            src?.id ?? '',
            bonusEntry?.bonus ?? '',
            bonusEntry?.unit_type ?? 'flat',
            bonusEntry?._is_ascension ? 'asc' : 'base'
        ].join(':');
    },

    _activeTierTabLabel(src, bonusEntry, tabs) {
        if (!tabs?.length) return null;
        const key = this._tierTabSelectionKey(src, bonusEntry);
        const selected = this.tierTabSelections?.[key];
        return tabs.some(tab => tab.label === selected) ? selected : tabs[0].label;
    },

    setActiveTierTab(src, bonusEntry, tabLabel) {
        const key = this._tierTabSelectionKey(src, bonusEntry);
        this.tierTabSelections = {
            ...(this.tierTabSelections ?? {}),
            [key]: tabLabel
        };
    },

    getTierGroups(entry) {
        const tierSources = entry.bonuses.map((b, gi) => {
            const matrix = this._getTierMatrix(entry.src, b, b.bonus);
            if (matrix?.length) {
                const tabs = matrix.map(collection => {
                    const displayRows = this._buildDisplayRows(entry.src, b, collection.rows);
                    const visualRowCount = displayRows.reduce((sum, row) => {
                        if (row.isEllipsis) return sum + 1;
                        return sum + (row.metaText ? 2 : 1);
                    }, 0);
                    return {
                        label: collection.label,
                        rows: displayRows,
                        visualRowCount,
                        gridRowCount: Math.ceil(displayRows.length / 2)
                    };
                });
                const activeTabLabel = this._activeTierTabLabel(entry.src, b, tabs);
                const activeTab = tabs.find(tab => tab.label === activeTabLabel) ?? tabs[0];
                const useTwoCol = tabs.some(tab => tab.visualRowCount >= this.tierPopoverColThreshold);
                const baseLabel = entry.bonuses.length > 1 ? (b.label || this.bonusLabel(b.bonus) || 'Node ' + (gi + 1)) : null;
                return {
                    label: baseLabel,
                    bonusEntry: b,
                    tabs,
                    activeTab,
                    rows: activeTab?.rows ?? [],
                    visualRowCount: activeTab?.visualRowCount ?? 0,
                    gridRowCount: activeTab?.gridRowCount ?? 0,
                    useTwoCol
                };
            }
            const rows = this._getTierRows(entry.src, b, b.bonus);
            if (!rows) return null;
            const baseLabel = entry.bonuses.length > 1 ? (b.label || this.bonusLabel(b.bonus) || 'Node ' + (gi + 1)) : null;
            const displayRows = this._buildDisplayRows(entry.src, b, rows);
            const visualRowCount = displayRows.reduce((sum, row) => {
                if (row.isEllipsis) return sum + 1;
                return sum + (row.metaText ? 2 : 1);
            }, 0);
            return {
                label: baseLabel,
                bonusEntry: b,
                tabs: null,
                activeTab: null,
                rows: displayRows,
                visualRowCount,
                gridRowCount: Math.ceil(displayRows.length / 2),
                useTwoCol: visualRowCount >= this.tierPopoverColThreshold
            };
        });
        return tierSources.filter(Boolean);
    },

    _buildDisplayRows(src, bonusEntry, rows) {
        const total = rows.length;
        const maxVisible = this.data.tier_preview_limit ?? 5;
        const headCount = maxVisible - 2;
        const indices =
            total <= maxVisible
                ? rows.map((_, i) => i)
                : [...Array(headCount).keys(), null, total - 1];

        const displayRows = indices.map(idx => {
            if (idx === null) return { isEllipsis: true };
            const tierRow = rows[idx];
            return {
                isEllipsis: false,
                label: tierRow.label,
                tierBadge: tierRow._tierBadgeLabel ?? (tierRow._petTier != null ? `T${tierRow._petTier}` : null),
                _tierRow: tierRow,
                _rawVal: tierRow[bonusEntry.bonus],
                metaText: null,
                metaHtml: null,
                valHtml: null,
                valText: '-'
            };
        });

        const rowDecimals = new Map();
        const valuesByUnitType = new Map();
        displayRows.forEach(row => {
            if (row.isEllipsis || row._rawVal == null) return;
            const unitType = row._tierRow?._unitType ?? bonusEntry.unit_type ?? 'flat';
            if (!valuesByUnitType.has(unitType)) valuesByUnitType.set(unitType, []);
            valuesByUnitType.get(unitType).push(row._rawVal);
        });
        valuesByUnitType.forEach((values, unitType) => {
            const maxDecimals = this.bonusDisplayDecimals(bonusEntry.bonus, unitType, [bonusEntry]);
            rowDecimals.set(unitType, sharedDisplayDecimals(values, maxDecimals));
        });
        displayRows.forEach(row => {
            if (row.isEllipsis || row._rawVal == null) return;
            const unitType = row._tierRow?._unitType ?? bonusEntry.unit_type ?? 'flat';
            const unit = this.unitFor(bonusEntry.bonus, unitType);
            const decimals = rowDecimals.get(unitType) ?? this.bonusDisplayDecimals(bonusEntry.bonus, unitType, [bonusEntry]);
            row.valText = formatValExact(row._rawVal, unit, unitType, decimals);
            row.valHtml = this._escapeHtml(row.valText);
        });

        const petFormulaRows = displayRows.filter(row =>
            !row.isEllipsis &&
            row._tierRow?._petBase != null &&
            row._tierRow?._petMultiplier != null
        );
        const formulaDecimals = petFormulaRows.length
            ? {
                base: petFormulaRows.reduce((max, row) => Math.max(max, this._scaleNumberDecimals(row._tierRow._petBase)), 0),
                multiplier: petFormulaRows.reduce((max, row) => Math.max(max, this._scaleNumberDecimals(row._tierRow._petMultiplier)), 0)
            }
            : displayRows.reduce((max, row) => {
                if (row.isEllipsis || !row._tierRow) return max;
                return Math.max(max, this._tierFormulaMetaDecimals(src, bonusEntry, row._tierRow));
            }, 0);
        displayRows.forEach(row => {
            if (row.isEllipsis || !row._tierRow) return;
            row.metaText = this._formatTierFormulaMeta(src, bonusEntry, row._tierRow, formulaDecimals);
            row.metaHtml = this._formatTierFormulaMetaHtml(src, bonusEntry, row._tierRow, formulaDecimals);
        });

        return displayRows;
    },

    _bonusPassesFilters(b, src) {
        if (!this._bonusMatchesClass(b, src)) return false;
        if (b.condition && !this.activeConditions.has(b.condition)) return false;
        if (b.parameter_min) {
            for (const [paramId, min] of Object.entries(b.parameter_min)) {
                const p = this.parameters.find(p => p.id === paramId);
                if (!p || p.value < min) return false;
            }
        }
        return true;
    },

    _cacheKeyForBonus(availableOnly) {
        const sources = Object.values(this.groupedSources).flat();
        let hasClasses = false;
        const conditions = new Set();
        const paramIds   = new Set();

        for (const { src, bonuses } of sources) {
            for (const b of bonuses) {
                if (b.classes || src.classes) hasClasses = true;
                if (this._bonusPassesFilters(b, src)) {
                    if (b.condition) conditions.add(b.condition);
                    if (b.parameter_min) Object.keys(b.parameter_min).forEach(id => paramIds.add(id));
                    if (b.scales_with)   paramIds.add(b.scales_with);
                }
            }
        }

        const classKey = hasClasses ? ':c=' + this.selectedClass : '';
        const condKey  = conditions.size
            ? ':cd=' + [...conditions].filter(c => this.activeConditions.has(c)).sort().join(',')
            : '';
        const paramKey = paramIds.size
            ? ':p=' + [...paramIds].map(id => id + '=' + this.parameters.find(p => p.id === id)?.value).join(',')
            : '';

        return this.selectedBonus + ':' + availableOnly + classKey + condKey + paramKey;
    },

    _calcItems(availableOnly) {
        const cacheKey = this._cacheKeyForBonus(availableOnly);
        if (this._calcCache[cacheKey]) return this._calcCache[cacheKey];

        const optimizerBucket = { containers: this._buildAllContainers(), exclusive: [], stackable: [] };
        const items = [];

        const ids = this._resolveBonusIds(this.selectedBonus);
        for (const type of Object.keys(this.data.types)) {
            if (!this.groupedSources[type]) continue;
            for (const { src, bonuses } of this.groupedSources[type]) {
                if (availableOnly && src.available === false) continue;
                if (src.optimization?.exclude) continue;

                const matchingBonuses = bonuses.filter(b => {
                    if (!ids.includes(b.bonus)) return false;
                    return this._bonusPassesFilters(b, src);
                });

                if (src.slot) {
                    if (matchingBonuses.length) {
                        this._routeSlottedItem(src, matchingBonuses, optimizerBucket);
                    }
                    continue;
                }

                for (const b of matchingBonuses) {
                    const value = this._resolveValue(b);
                    const key = src.id + ':' + (b.unit_type || 'flat');
                    const existing = items.find(i => i._key === key);
                    if (existing) {
                        existing.value += value;
                    } else {
                        items.push({ src, bonus: b, value, unit_type: b.unit_type || 'flat', mult: 1, _key: key });
                    }
                }
            }
        }

        this._runOptimizers(optimizerBucket, items);

        this._calcCache[cacheKey] = items;
        return items;
    },

    _compoundTotal(items) {
        if (!items.length) return { value: 0, unit_type: 'flat', isMixed: false, "flat": 0, "percent": 0, "multiplier": 1 };
        let flat = 0, percent = 0, multiplier = 1, multiplierCount = 0;
        const unitTypes = new Set();
        for (const item of items) {
            const ut = item.unit_type || 'flat';
            unitTypes.add(ut);
            const total = item.value * item.mult;
            if (ut === 'flat')            flat += total;
            else if (ut === 'percent')    percent += total;
            else if (ut === 'multiplier') { multiplier *= Math.pow(item.value, item.mult); multiplierCount += item.mult; }
        }
        const hasFlat    = unitTypes.has('flat');
        const hasPercent = unitTypes.has('percent');
        const hasMult    = unitTypes.has('multiplier');
        const values = { "flat": flat, "percent": percent, "multiplier": multiplier };

        if (hasFlat)    { return  { ...values, value: flat * (1 + percent / 100) * (multiplier || 1), unit_type: 'flat', isMixed: (hasPercent || hasMult), multiplierCount } }
        if (hasPercent) { return  { ...values, value: percent * (multiplier || 1), unit_type: 'percent', isMixed: hasMult, multiplierCount } }
        return { ...values, value: multiplier, unit_type: 'multiplier', isMixed: false, multiplierCount };
    },

    /* -- Slot routing / optimizer -- */

    _routeSlottedItem(src, bonuses, optimizerBucket) {
        const list = (src.size ?? 1) > 1 || (src.max ?? Infinity) === 1 ? optimizerBucket.exclusive : optimizerBucket.stackable;
        const variants = bonuses.reduce((sets, bonusEntry) => {
            const bonusVariants = this._displayBonusVariants(src, bonusEntry);
            const next = [];
            for (const set of sets) {
                for (const variant of bonusVariants) {
                    next.push([...set, { ...variant }]);
                }
            }
            return next;
        }, [[]]);

        if (variants.length === 1) {
            if (list.find(i => i.id === src.id)) return;
            list.push({
                ...src,
                bonuses: variants[0]
            });
            return;
        }

        const variantIds = variants.map((_, index) => `${src.id}::variant:${index}`);
        variants.forEach((variantBonuses, index) => {
            const variantId = variantIds[index];
            if (list.find(i => i.id === variantId)) return;
            list.push({
                ...src,
                id: variantId,
                _optimizer_base_id: src.id,
                constraint: {
                    ...(src.constraint ?? {}),
                    excludes: [
                        ...(src.constraint?.excludes ?? []),
                        ...variantIds.filter(id => id !== variantId)
                    ]
                },
                bonuses: variantBonuses
            });
        });
    },

    _buildAllContainers() {
        const containers = [];
        if (this.data.rune_circles?.length) {
            for (const c of this.data.rune_circles) {
                containers.push({ id: c.id, slots: c.slots, maxExclusive: 1, slot_type: 'rune_socket' });
            }
        }
        for (const slotDef of this.data.slot_types) {
            if (slotDef.id === 'rune_socket') continue;
            if (!slotDef.max) continue;
            for (let i = 0; i < slotDef.max; i++) {
                containers.push({ id: slotDef.id + '_' + i, slots: 1, maxExclusive: 1, slot_type: slotDef.id });
            }
        }
        return containers;
    },

    _runOptimizers(optimizerBucket, items) {
        if (!optimizerBucket.exclusive.length && !optimizerBucket.stackable.length) return;
        const bonusIds = this._resolveBonusIds(this.selectedBonus);
        const currentTotals = this._compoundTotal(items);
        const minimize = this.data.bonus_types.find(b => b.id === this.selectedBonus)?.minimize ?? false;
        const sign = minimize ? -1 : 1;
        const applySign = bucket => bucket.map(item => ({
            ...item,
            bonuses: (item.bonuses ?? []).map(b => ({ ...b, value: (b.value ?? 0) * sign }))
        }));
        const result = optimize(
            optimizerBucket.containers,
            minimize ? applySign(optimizerBucket.exclusive) : optimizerBucket.exclusive,
            minimize ? applySign(optimizerBucket.stackable) : optimizerBucket.stackable,
            bonusIds,
            {
                flat:       currentTotals.flat       ?? 0,
                percent:    currentTotals.percent    ?? 0,
                multiplier: currentTotals.multiplier ?? 1,
            }
        );
        if (result.assignment) {
            const resultItems = this._itemsFromOptimizerResult(result, this.selectedBonus);
            resultItems.forEach(item => { item.value *= sign; });
            items.push(...resultItems);
        }
    },

    _countOptimizerItems(result) {
        const counts = {};
        for (const container of result.assignment) {
            for (const item of container.items) {
                counts[item.id] = (counts[item.id] ?? 0) + 1;
            }
        }
        return counts;
    },

    _itemsFromOptimizerResult(result, bonusId) {
        const counts = this._countOptimizerItems(result);
        const seen = new Set();
        const items = [];
        for (const container of result.assignment) {
            for (const item of container.items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                items.push(...this._buildOptimizerItem(item, bonusId, counts[item.id]));
            }
        }
        return items;
    },

    _buildOptimizerItem(item, bonusId, count) {
        const realSrc = this.data.sources.find(s => s.id === (item._optimizer_base_id ?? item.id));
        const contrib = this._getContribForBonus(item, this._resolveBonusIds(bonusId));
        return Object.entries(contrib)
            .filter(([, val]) => val)
            .map(([ut, val]) => {
                const tierBadge = (item.bonuses ?? []).find(b =>
                    (b.unit_type ?? 'flat') === ut &&
                    this._resolveBonusIds(bonusId).includes(b.bonus) &&
                    b._tierBadgeLabel
                )?._tierBadgeLabel ?? null;
                return {
                    src:          realSrc ?? { id: item._optimizer_base_id ?? item.id, name: item.name, type: 'rune', available: true },
                    bonus:        { bonus: bonusId, value: val, unit_type: ut, _tierBadgeLabel: tierBadge },
                    value:        ut === 'multiplier' ? Math.pow(val, count) : val,
                    unit_type:    ut,
                    mult:         ut === 'multiplier' ? 1 : count,
                    display_mult: count,
                    _key:         (item._optimizer_base_id ?? item.id) + ':' + ut + ':' + (tierBadge ?? ''),
                };
            });
    },

    _getContribForBonus(item, bonusId) {
        const contrib = { flat: 0, percent: 0, multiplier: 0 };
        for (const b of item.bonuses ?? []) {
            const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
            if (!ids.includes(b.bonus)) continue;
            const ut = b.unit_type ?? 'flat';
            contrib[ut] = (contrib[ut] ?? 0) + (b.value ?? 0);
        }
        return contrib;
    },
};
