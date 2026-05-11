import { formatVal, formatValExact, normalizeValue, sharedDisplayDecimals } from '../utils.js?v=7e5a144c2d';
import { optimize } from '../optimizer.js?v=f4307e77c4';

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

    resolveActualSourceBonusValue(src, bonusEntry) {
        const petProgression = this._resolvePetProgression(src, bonusEntry);
        if (petProgression) {
            const actualLevel = Number(src?._selectedPetLevel ?? src?._actualPetLevel ?? petProgression?.levels?.max ?? 1);
            if (bonusEntry?.pet_base != null) {
                return this._resolvePetProgressionValue(petProgression, bonusEntry, null, actualLevel);
            }
            const actualTier = Number(src?._selectedPetTier ?? src?._actualPetTier ?? petProgression?.tiers?.max ?? 1);
            return this._resolvePetProgressionValue(petProgression, bonusEntry, actualTier, actualLevel);
        }

        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula) return this._resolveValue(bonusEntry);

        const actualTier = Number(bonusEntry?._selectedTier ?? bonusEntry?._actualTier);
        if (!Number.isFinite(actualTier)) return this.resolveSourceBonusValue(src, bonusEntry);

        const formulaValue = this._applyFormula({ ...formula, max_tier: actualTier }, bonusEntry.unlock_at_tier ?? 1);
        return this._calculateValue(
            formulaValue,
            bonusEntry.scales_with,
            bonusEntry.scale_formula
        );
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
            const row = { label, _tier: i, _formulaValue: formulaValue };
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

    _isActualTierRow(src, bonusEntry, tierRow) {
        if (!tierRow) return false;
        if (tierRow._petLevel != null) {
            const actualLevel = Number(src?._actualPetLevel);
            if (!Number.isFinite(actualLevel) || tierRow._petLevel !== actualLevel) return false;
            if (tierRow._petTier != null) {
                const actualTier = Number(src?._actualPetTier);
                return Number.isFinite(actualTier) && tierRow._petTier === actualTier;
            }
            return true;
        }

        const actualTier = Number(bonusEntry?._actualTier);
        return Number.isFinite(actualTier) && tierRow._tier === actualTier;
    },

    _isBonusRelevantToCurrentSelection(bonusEntry) {
        if (!this.selectedBonus || !bonusEntry?.bonus) return false;
        return this._resolveBonusIds(this.selectedBonus).includes(bonusEntry.bonus);
    },

    _isSelectedTierRow(src, bonusEntry, tierRow) {
        if (!this._isBonusRelevantToCurrentSelection(bonusEntry)) return false;
        if (!tierRow) return false;
        if (tierRow._petLevel != null) {
            const selectedLevel = Number(src?._selectedPetLevel);
            if (!Number.isFinite(selectedLevel) || tierRow._petLevel !== selectedLevel) return false;
            if (tierRow._petTier != null) {
                const selectedTier = Number(src?._selectedPetTier);
                return Number.isFinite(selectedTier) && tierRow._petTier === selectedTier;
            }
            return true;
        }
        const selectedTier = Number(bonusEntry?._selectedTier);
        return Number.isFinite(selectedTier) && tierRow._tier === selectedTier;
    },

    _matchesTierRowSelection(selection, tierRow) {
        if (!selection || !tierRow) return false;
        if (tierRow._petLevel != null) {
            if (selection.petLevel !== (tierRow._petLevel ?? null)) return false;
            if (tierRow._petTier != null) {
                return selection.petTier === (tierRow._petTier ?? null);
            }
            return true;
        }
        return selection.tier === (tierRow._tier ?? null);
    },

    _defaultTierSelection(src, bonusEntry) {
        const baseBonus = src?.bonuses?.[bonusEntry?._maxPanelBonusIndex] ?? bonusEntry ?? null;
        const progression = this._resolvePetProgression(src, baseBonus);
        if (progression) {
            return {
                tier: null,
                petLevel: baseBonus?.pet_base != null
                    ? Number(src?._actualPetLevel ?? progression?.levels?.max ?? 1)
                    : Number(src?._actualPetLevel ?? progression?.levels?.max ?? 1),
                petTier: baseBonus?.pet_base != null
                    ? null
                    : Number(src?._actualPetTier ?? progression?.tiers?.max ?? 1)
            };
        }
        const rows = this._getTierRows(src, baseBonus, baseBonus?.bonus);
        const fallbackRow = Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null;
        return {
            tier: baseBonus?._actualTier ?? fallbackRow?._tier ?? null,
            petLevel: null,
            petTier: null
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
        let indices;
        if (total <= maxVisible) {
            indices = rows.map((_, i) => i);
        } else {
            indices = [...Array(headCount).keys(), null, total - 1];
            const actualIndex = rows.findIndex(tierRow => this._isActualTierRow(src, bonusEntry, tierRow));
            const hiddenStart = headCount;
            const hiddenEnd = total - 2;
            if (actualIndex >= hiddenStart && actualIndex <= hiddenEnd) {
                const reducedHeadCount = Math.max(0, headCount - 2);
                indices = [...Array(reducedHeadCount).keys(), null, actualIndex, null, total - 1];
            }
        }

        const displayRows = indices.map(idx => {
            if (idx === null) return { isEllipsis: true };
            const tierRow = rows[idx];
            return {
                isEllipsis: false,
                label: tierRow.label,
                isActual: this._isActualTierRow(src, bonusEntry, tierRow),
                isSelected: this._isSelectedTierRow(src, bonusEntry, tierRow),
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

    _entriesForSourceList(sourceList, bonusId = this.selectedBonus) {
        if (!this.data || !bonusId) return [];
        const ids = this._resolveBonusIds(bonusId);
        const entries = [];
        for (const src of sourceList ?? []) {
            const matching = this._bonusEntriesForBonusView(src, ids);
            if (!matching.length) continue;
            entries.push({ src, bonuses: matching });
        }
        return entries;
    },

    _cacheKeyForBonus(availableOnly, sourceList = null, sourceMode = 'live', sources = null) {
        const relevantSources = sources ?? (sourceList
            ? this._entriesForSourceList(sourceList)
            : Object.values(this.groupedSources).flat());
        let hasClasses = false;
        const conditions = new Set();
        const paramIds   = new Set();

        for (const { src, bonuses } of relevantSources) {
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

        return this.selectedBonus + ':' + availableOnly + ':' + sourceMode + classKey + condKey + paramKey;
    },

    _maxPanelEditState(tab = this.maxTab) {
        return this.maxPanelEdits?.[tab] ?? { removed: {}, added: {}, tiers: {} };
    },

    _maxPanelItemKey(item) {
        return `${item.src.id}:${item.tierBadge ?? item.bonus?._tierBadgeLabel ?? ''}`;
    },

    _maxPanelTierKey(src, bonusEntry) {
        return [
            src?.id ?? '',
            bonusEntry?._maxPanelBonusIndex ?? '',
            bonusEntry?.bonus ?? '',
            bonusEntry?.unit_type ?? 'flat',
            bonusEntry?._is_ascension ? 'asc' : 'base'
        ].join(':');
    },

    _updateMaxPanelState(tab, state) {
        this.maxPanelEdits = {
            ...this.maxPanelEdits,
            [tab]: state
        };
    },

    hasMaxPanelEdits(tab = this.maxTab) {
        const state = this._maxPanelEditState(tab);
        return Object.keys(state.removed ?? {}).length > 0
            || Object.keys(state.added ?? {}).length > 0
            || Object.keys(state.tiers ?? {}).length > 0;
    },

    resetMaxPanel(tab = this.maxTab) {
        this._updateMaxPanelState(tab, { removed: {}, added: {}, tiers: {} });
    },

    removeMaxPanelItem(tab, item) {
        const state = this._maxPanelEditState(tab);
        this._updateMaxPanelState(tab, {
            ...state,
            removed: {
                ...(state.removed ?? {}),
                [this._maxPanelItemKey(item)]: true
            }
        });
    },

    _maxPanelSourceList(tab) {
        return tab === 'actual' ? (this.data?.sources ?? []) : (this.data?._base_sources ?? []);
    },

    _maxPanelSourceById(tab, sourceId) {
        return this._maxPanelSourceList(tab).find(src => src.id === sourceId) ?? null;
    },

    _maxPanelTierSourceIds(tab = this.maxTab) {
        return new Set(
            Object.keys(this._maxPanelEditState(tab).tiers ?? {}).map(key => key.split(':')[0]).filter(Boolean)
        );
    },

    maxPanelEditSource(src, tab = this.maxTab) {
        const baseSrc = this._maxPanelSourceById(tab, src.id) ?? src;
        const nextSrc = {
            ...baseSrc,
            bonuses: (baseSrc.bonuses ?? []).map((bonus, index) => ({ ...bonus, _maxPanelBonusIndex: index }))
        };
        const overrides = this._maxPanelEditState(tab).tiers ?? {};
        for (const bonus of nextSrc.bonuses) {
            const override = overrides[this._maxPanelTierKey(baseSrc, bonus)];
            if (!override) continue;
            if (override.tier != null) bonus._selectedTier = override.tier;
            if (override.petLevel != null) nextSrc._selectedPetLevel = override.petLevel;
            if (override.petTier != null) nextSrc._selectedPetTier = override.petTier;
        }
        return nextSrc;
    },

    maxItemsByTab(tab) {
        if (tab === 'actual') return this.maxItemsActual;
        if (tab === 'all') return this.maxItemsAll;
        return this.maxItemsAvail;
    },

    _maxPanelPlacementContext(tab = this.maxTab, slotId = null) {
        const items = this.maxItemsByTab(tab);
        const signature = [
            tab,
            slotId ?? '',
            this.selectedBonus ?? '',
            ...items
                .filter(item => !slotId || item.src?.slot === slotId)
                .map(item => `${item.src?.id ?? ''}:${Number(item.display_mult ?? item.mult ?? 1)}`)
                .sort()
        ].join('|');

        if (this._maxPanelPlacementCache?.signature === signature) {
            return this._maxPanelPlacementCache.value;
        }

        const value = {
            sourceCounts: this._maxPanelSlottedSourceCounts(tab, slotId),
            canAdd: new Map()
        };
        this._maxPanelPlacementCache = { signature, value };
        return value;
    },

    _maxPanelUsageContext(tab = this.maxTab) {
        const items = this.maxItemsByTab(tab);
        const signature = [
            tab,
            this.selectedBonus ?? '',
            ...items
                .map(item => `${item.src?.id ?? ''}:${item.src?.slot ?? ''}:${Number(item.display_mult ?? item.mult ?? 1)}`)
                .sort()
        ].join('|');

        if (this._maxPanelUsageCache?.signature === signature) {
            return this._maxPanelUsageCache.value;
        }

        const sourceIds = new Set();
        const slotUsage = new Map();
        for (const item of items) {
            const src = item.src;
            if (!src?.id) continue;
            sourceIds.add(src.id);
            if (!src.slot) continue;
            if (!slotUsage.has(src.slot)) slotUsage.set(src.slot, new Map());
            const bySource = slotUsage.get(src.slot);
            bySource.set(src.id, {
                size: Number(src.size ?? 1),
                count: Math.max(bySource.get(src.id)?.count ?? 0, Number(item.display_mult ?? item.mult ?? 1))
            });
        }

        const value = { sourceIds, slotUsage };
        this._maxPanelUsageCache = { signature, value };
        return value;
    },

    _maxPanelSlottedSourceCounts(tab = this.maxTab, slotId = null) {
        const counts = new Map();
        for (const item of this.maxItemsByTab(tab)) {
            if (!item.src?.slot) continue;
            if (slotId && item.src.slot !== slotId) continue;
            counts.set(item.src.id, Math.max(counts.get(item.src.id) ?? 0, Number(item.display_mult ?? item.mult ?? 1)));
        }
        return counts;
    },

    _maxPanelPlacementSourceById(tab, sourceId, slotId = null) {
        const currentSrc = this._maxPanelSourceById(tab, sourceId);
        if (!(tab === 'actual' && slotId === 'rune_socket')) return currentSrc;
        return (this.data?._base_sources ?? []).find(src => src.id === sourceId) ?? currentSrc;
    },

    _buildPlacementInstances(sourceCounts, slotId, tab = this.maxTab) {
        const instances = [];
        for (const [sourceId, count] of sourceCounts.entries()) {
            const src = this._maxPanelPlacementSourceById(tab, sourceId, slotId);
            if (!src || src.slot !== slotId) return null;
            const maxCount = Number(src.max ?? Infinity);
            if (count > maxCount) return null;
            const size = Math.max(1, Number(src.size ?? 1));
            const exclusive = Boolean(src.exclusive) || size > 1 || maxCount === 1;
            for (let i = 0; i < count; i += 1) {
                instances.push({
                    id: src.id,
                    size,
                    exclusive,
                    excludes: src.constraint?.excludes ?? []
                });
            }
        }
        return instances.sort((a, b) => {
            if (b.size !== a.size) return b.size - a.size;
            if (a.exclusive !== b.exclusive) return Number(b.exclusive) - Number(a.exclusive);
            return a.id.localeCompare(b.id);
        });
    },

    _canPlaceInContainers(slotId, sourceCounts, tab = this.maxTab) {
        const containers = this._buildAllContainers()
            .filter(container => container.slot_type === slotId)
            .map(container => ({ ...container, remaining: container.slots, items: [] }));
        if (!containers.length) return false;

        const instances = this._buildPlacementInstances(sourceCounts, slotId, tab);
        if (!instances) return false;

        const tryPlace = index => {
            if (index >= instances.length) return true;
            const instance = instances[index];
            const tried = new Set();
            const placedItems = containers.flatMap(container => container.items);

            for (let i = 0; i < containers.length; i += 1) {
                const container = containers[i];
                const signature = `${container.remaining}:${container.items.filter(item => item.exclusive).length}`;
                if (tried.has(signature)) continue;
                tried.add(signature);

                if (container.remaining < instance.size) continue;
                if (instance.exclusive && container.items.filter(item => item.exclusive).length >= container.maxExclusive) continue;

                let blocked = false;
                for (const placed of placedItems) {
                    if (instance.excludes.includes(placed.id) || placed.excludes.includes(instance.id)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;

                container.remaining -= instance.size;
                container.items.push(instance);
                if (tryPlace(index + 1)) return true;
                container.items.pop();
                container.remaining += instance.size;
            }

            return false;
        };

        return tryPlace(0);
    },

    canAddSourceToMax(src, tab = this.maxTab) {
        if (!this.selectedBonus) return false;
        const usage = this._maxPanelUsageContext(tab);
        if (!src?.slot) {
            return !usage.sourceIds.has(src.id);
        }
        if (!(tab === 'actual' && src.slot === 'rune_socket')) {
            const slotUsage = usage.slotUsage.get(src.slot) ?? new Map();
            const currentCount = slotUsage.get(src.id)?.count ?? 0;
            if (currentCount >= Number(src.max ?? Infinity)) return false;
            const used = [...slotUsage.values()].reduce((sum, entry) => sum + (entry.size * entry.count), 0);
            return used + Number(src.size ?? 1) <= this.slotMax(src.slot);
        }
        const context = this._maxPanelPlacementContext(tab, src.slot);
        if (context.canAdd.has(src.id)) return context.canAdd.get(src.id);
        const sourceCounts = new Map(context.sourceCounts);
        sourceCounts.set(src.id, (sourceCounts.get(src.id) ?? 0) + 1);
        const result = this._canPlaceInContainers(src.slot, sourceCounts, tab);
        context.canAdd.set(src.id, result);
        return result;
    },

    addSourceToMax(src, event = null, tab = this.maxTab) {
        if (event) event.stopPropagation();
        if (!this.canAddSourceToMax(src, tab)) return;
        const state = this._maxPanelEditState(tab);
        const hadRemovedRows = Object.keys(state.removed ?? {}).some(key => key.startsWith(src.id + ':'));
        const removed = Object.fromEntries(
            Object.entries(state.removed ?? {}).filter(([key]) => !key.startsWith(src.id + ':'))
        );
        this._updateMaxPanelState(tab, {
            ...state,
            removed,
            added: {
                ...(state.added ?? {}),
                [src.id]: hadRemovedRows
                    ? Number(state.added?.[src.id] ?? 0)
                    : Number(state.added?.[src.id] ?? 0) + 1
            }
        });
    },

    _maxPanelSelectionBadgeLabel(tierRow) {
        if (!tierRow) return null;
        return tierRow._tierBadgeLabel ?? (tierRow._petTier != null ? `T${tierRow._petTier}` : tierRow.label ?? null);
    },

    _maxPanelSelectedTierBadges(src, tab = this.maxTab) {
        const overrides = this._maxPanelEditState(tab).tiers ?? {};
        const labels = [];
        const seen = new Set();
        for (const bonusEntry of src?.bonuses ?? []) {
            if (!this._isBonusRelevantToCurrentSelection(bonusEntry)) continue;
            const label = overrides[this._maxPanelTierKey(src, bonusEntry)]?.badgeLabel;
            if (!label || seen.has(label)) continue;
            seen.add(label);
            labels.push(label);
        }
        return labels;
    },

    _maxPanelRefreshOpenEntries(context, src, bonusEntry) {
        const refreshEntryBonuses = entry => (entry?.bonuses ?? [])
            .map(openBonus => src.bonuses?.[openBonus?._maxPanelBonusIndex])
            .filter(Boolean);
        if (this.itemPopoverEntry?.maxItemContext?.tab === context.tab && this.itemPopoverEntry?.maxItemContext?.sourceId === context.sourceId) {
            this.itemPopoverEntry = { ...this.itemPopoverEntry, src };
        }
        if (this.tierPopoverEntry?.maxItemContext?.tab === context.tab && this.tierPopoverEntry?.maxItemContext?.sourceId === context.sourceId) {
            this.tierPopoverEntry = {
                ...this.tierPopoverEntry,
                src,
                bonuses: refreshEntryBonuses(this.tierPopoverEntry)
            };
        }
        if (this.tierSheetEntry?.maxItemContext?.tab === context.tab && this.tierSheetEntry?.maxItemContext?.sourceId === context.sourceId) {
            this.tierSheetEntry = {
                ...this.tierSheetEntry,
                src,
                bonuses: refreshEntryBonuses(this.tierSheetEntry)
            };
        }
    },

    applyMaxTierSelection(entry, bonusEntry, tierRow) {
        const context = entry?.maxItemContext;
        if (!context || !bonusEntry || !tierRow) return;
        const tab = context.tab ?? this.maxTab;
        const src = this._maxPanelSourceById(tab, context.sourceId) ?? entry.src;
        const state = this._maxPanelEditState(tab);
        const key = this._maxPanelTierKey(src, bonusEntry);
        const isRelevant = this._isBonusRelevantToCurrentSelection(bonusEntry);
        const nextSelection = {
            tier: tierRow._tier ?? null,
            petLevel: tierRow._petLevel ?? null,
            petTier: tierRow._petTier ?? null,
            badgeLabel: this._maxPanelSelectionBadgeLabel(tierRow)
        };
        const shouldClear = !isRelevant || this._matchesTierRowSelection(this._defaultTierSelection(src, bonusEntry), tierRow);
        const nextTiers = { ...(state.tiers ?? {}) };
        if (shouldClear) {
            delete nextTiers[key];
        } else {
            nextTiers[key] = nextSelection;
        }
        this._updateMaxPanelState(tab, {
            ...state,
            tiers: nextTiers
        });
        this._maxPanelRefreshOpenEntries(context, this.maxPanelEditSource(src, tab), bonusEntry);
    },

    _maxPanelBuildSourceItems(src, sourceMode, count = 1, tab = this.maxTab) {
        const ids = this._resolveBonusIds(this.selectedBonus);
        const compoundRule = this._compoundRuleForBonus(ids);
        const buckets = new Map();
        const matchingBonuses = this._bonusEntriesForBonusView(src, ids).filter(bonusEntry =>
            ids.includes(bonusEntry.bonus) && this._bonusPassesFilters(bonusEntry, src)
        );

        for (const bonusEntry of matchingBonuses) {
            for (const variant of this._displayBonusVariants(src, bonusEntry)) {
                const unitType = variant.unit_type || 'flat';
                const tierBadge = variant._tierBadgeLabel ?? null;
                const bucketKey = `${unitType}:${tierBadge ?? ''}`;
                const value = sourceMode === 'actual'
                    ? this.resolveActualSourceBonusValue(src, variant)
                    : this.resolveSourceBonusValue(src, variant);
                if (!buckets.has(bucketKey)) {
                    buckets.set(bucketKey, {
                        unitType,
                        tierBadge,
                        selectedTierBadges: this._maxPanelSelectedTierBadges(src, tab),
                        value: 0,
                        percentStages: {}
                    });
                }
                const bucket = buckets.get(bucketKey);
                bucket.value += value;
                const stageId = this._compoundPercentStageId(variant, ids, compoundRule);
                if (stageId) bucket.percentStages[stageId] = (bucket.percentStages[stageId] ?? 0) + value;
            }
        }

        return [...buckets.values()].map(bucket => ({
            src,
            bonus: { bonus: this.selectedBonus, unit_type: bucket.unitType, _tierBadgeLabel: bucket.tierBadge },
            selectedTierBadges: bucket.selectedTierBadges,
            value: bucket.unitType === 'multiplier' ? Math.pow(bucket.value, count) : bucket.value,
            percentStages: bucket.unitType === 'percent' ? { ...bucket.percentStages } : null,
            unit_type: bucket.unitType,
            mult: bucket.unitType === 'multiplier' ? 1 : count,
            display_mult: count,
            _key: `${src.id}:${bucket.unitType}:${bucket.tierBadge ?? ''}`
        }));
    },

    _applyMaxPanelEdits(items, tab, sourceMode) {
        const state = this._maxPanelEditState(tab);
        if (!Object.keys(state.removed ?? {}).length
            && !Object.keys(state.added ?? {}).length
            && !Object.keys(state.tiers ?? {}).length) {
            return items;
        }
        const counts = new Map();
        const sourceItems = new Map();
        const touchedSourceIds = new Set([
            ...Object.keys(state.added ?? {}),
            ...this._maxPanelTierSourceIds(tab)
        ]);

        for (const item of items) {
            counts.set(item.src.id, Math.max(counts.get(item.src.id) ?? 0, Number(item.display_mult ?? item.mult ?? 1)));
            if (!sourceItems.has(item.src.id)) sourceItems.set(item.src.id, []);
            sourceItems.get(item.src.id).push(item);
        }

        const nextItems = [];
        for (const [sourceId, itemGroup] of sourceItems.entries()) {
            if (!touchedSourceIds.has(sourceId)) {
                nextItems.push(...itemGroup);
                continue;
            }
            const count = (counts.get(sourceId) ?? 0) + Number(state.added?.[sourceId] ?? 0);
            if (count <= 0) continue;
            const src = this.maxPanelEditSource(itemGroup[0]?.src ?? { id: sourceId }, tab);
            nextItems.push(...this._maxPanelBuildSourceItems(src, sourceMode, count, tab));
        }

        for (const sourceId of Object.keys(state.added ?? {})) {
            if (sourceItems.has(sourceId)) continue;
            const count = Number(state.added?.[sourceId] ?? 0);
            if (count <= 0) continue;
            const src = this.maxPanelEditSource(this._maxPanelSourceById(tab, sourceId) ?? { id: sourceId }, tab);
            nextItems.push(...this._maxPanelBuildSourceItems(src, sourceMode, count, tab));
        }

        return nextItems.filter(item => !state.removed?.[this._maxPanelItemKey(item)]);
    },

    _calcItems(availableOnly, sourceList = null, sourceMode = 'live') {
        const ids = this._resolveBonusIds(this.selectedBonus);
        const entries = sourceList ? this._entriesForSourceList(sourceList) : Object.values(this.groupedSources).flat();
        const cacheKey = this._cacheKeyForBonus(availableOnly, sourceList, sourceMode, entries);
        if (this._calcCache[cacheKey]) return this._calcCache[cacheKey];

        const optimizerBucket = { containers: this._buildAllContainers(), exclusive: [], stackable: [] };
        const items = [];
        const itemsByKey = new Map();
        const sourceById = new Map();

        const compoundRule = this._compoundRuleForBonus(ids);
        for (const { src, bonuses } of entries) {
            sourceById.set(src.id, src);
            if (availableOnly) {
                if (sourceMode !== 'actual' && src.available === false) continue;
                if (sourceMode === 'actual' && src.actual_available !== true) continue;
            }
            if (sourceMode !== 'actual' && src.optimization?.exclude) continue;

            const matchingBonuses = bonuses.filter(b => {
                if (!ids.includes(b.bonus)) return false;
                return this._bonusPassesFilters(b, src);
            });

            if (src.slot) {
                if (matchingBonuses.length) {
                    this._routeSlottedItem(
                        src,
                        sourceMode === 'actual'
                            ? matchingBonuses.map(b => ({ ...b, value: this.resolveActualSourceBonusValue(src, b) }))
                            : matchingBonuses,
                        optimizerBucket
                    );
                }
                continue;
            }

            for (const b of matchingBonuses) {
                const value = sourceMode === 'actual'
                    ? this.resolveActualSourceBonusValue(src, b)
                    : this._resolveValue(b);
                const stageId = this._compoundPercentStageId(b, ids, compoundRule);
                const key = src.id + ':' + (b.unit_type || 'flat');
                const existing = itemsByKey.get(key);
                if (existing) {
                    existing.value += value;
                    if (stageId) existing.percentStages[stageId] = (existing.percentStages[stageId] ?? 0) + value;
                } else {
                    const item = {
                        src,
                        bonus: b,
                        value,
                        percentStages: stageId ? { [stageId]: value } : {},
                        unit_type: b.unit_type || 'flat',
                        mult: 1,
                        _key: key
                    };
                    items.push(item);
                    itemsByKey.set(key, item);
                }
            }
        }

        this._runOptimizers(optimizerBucket, items, sourceById);

        this._calcCache[cacheKey] = items;
        return items;
    },

    _compoundRuleForBonus(bonusId = this.selectedBonus) {
        if (!bonusId) return null;
        const ids = Array.isArray(bonusId) ? bonusId : this._resolveBonusIds(bonusId);
        const rules = this.data?.compound_rules ?? {};
        for (const id of ids) {
            if (rules[id]) return rules[id];
        }
        return null;
    },

    _compoundPercentStageId(bonusEntry, bonusId = this.selectedBonus, rule = this._compoundRuleForBonus(bonusId)) {
        if (!rule || !Array.isArray(rule.percent_stages) || !bonusEntry) return null;
        if ((bonusEntry.unit_type ?? 'flat') !== 'percent') return null;
        for (const stage of rule.percent_stages) {
            if (!stage?.id || !stage.match) continue;
            if (this._compoundStageMatchesBonus(stage.match, bonusEntry)) return stage.id;
        }
        return rule.percent_stages.find(stage => stage?.id && !stage.match)?.id ?? null;
    },

    _compoundStageMatchesBonus(match, bonusEntry) {
        if (!match || !bonusEntry) return false;
        for (const [field, expected] of Object.entries(match)) {
            const actual = bonusEntry[field];
            if (Array.isArray(expected)) {
                if (!expected.includes(actual)) return false;
                continue;
            }
            if (actual !== expected) return false;
        }
        return true;
    },

    _mergePercentStages(target, source, factor = 1) {
        if (!source) return target;
        const next = target ?? {};
        for (const [stageId, value] of Object.entries(source)) {
            if (!value) continue;
            next[stageId] = (next[stageId] ?? 0) + (value * factor);
        }
        return next;
    },

    _computeCompoundFlatValue(flat, percent, percentStages, multiplier, rule) {
        if (!rule || !Array.isArray(rule.percent_stages) || !rule.percent_stages.length) {
            return flat * (1 + percent / 100) * (multiplier || 1);
        }
        let value = flat;
        let matchedPercent = 0;
        for (const stage of rule.percent_stages) {
            const stagePercent = percentStages?.[stage.id] ?? 0;
            matchedPercent += stagePercent;
            value *= (1 + stagePercent / 100);
        }
        const remainingPercent = percent - matchedPercent;
        if (remainingPercent) value *= (1 + remainingPercent / 100);
        return value * (multiplier || 1);
    },

    _compoundTotal(items) {
        const rule = this._compoundRuleForBonus();
        if (!items.length) return { value: 0, unit_type: 'flat', isMixed: false, "flat": 0, "percent": 0, "percentStages": {}, "multiplier": 1 };
        let flat = 0, percent = 0, multiplier = 1, multiplierCount = 0;
        const percentStages = {};
        const unitTypes = new Set();
        for (const item of items) {
            const ut = item.unit_type || 'flat';
            unitTypes.add(ut);
            const total = item.value * item.mult;
            if (ut === 'flat')            flat += total;
            else if (ut === 'percent') {
                percent += total;
                this._mergePercentStages(percentStages, item.percentStages, item.mult);
            }
            else if (ut === 'multiplier') { multiplier *= Math.pow(item.value, item.mult); multiplierCount += item.mult; }
        }
        const hasFlat    = unitTypes.has('flat');
        const hasPercent = unitTypes.has('percent');
        const hasMult    = unitTypes.has('multiplier');
        const values = { "flat": flat, "percent": percent, "percentStages": percentStages, "multiplier": multiplier };
        const finalFlatValue = this._computeCompoundFlatValue(flat, percent, percentStages, multiplier, rule);

        if (hasFlat)    { return  { ...values, value: finalFlatValue, unit_type: 'flat', isMixed: (hasPercent || hasMult), multiplierCount } }
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

    _runOptimizers(optimizerBucket, items, sourceById = null) {
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
                percentStages: currentTotals.percentStages ?? {},
                multiplier: currentTotals.multiplier ?? 1,
                compoundRule: this._compoundRuleForBonus(bonusIds),
            }
        );
        if (result.assignment) {
            const resultItems = this._itemsFromOptimizerResult(result, this.selectedBonus, sourceById);
            resultItems.forEach(item => {
                item.value *= sign;
                if (item.percentStages) {
                    for (const stageId of Object.keys(item.percentStages)) {
                        item.percentStages[stageId] *= sign;
                    }
                }
            });
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

    _itemsFromOptimizerResult(result, bonusId, sourceById = null) {
        const counts = this._countOptimizerItems(result);
        const seen = new Set();
        const items = [];
        for (const container of result.assignment) {
            for (const item of container.items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                items.push(...this._buildOptimizerItem(item, bonusId, counts[item.id], sourceById));
            }
        }
        return items;
    },

    _buildOptimizerItem(item, bonusId, count, sourceById = null) {
        const realSrc = sourceById?.get(item._optimizer_base_id ?? item.id)
            ?? this.data.sources.find(s => s.id === (item._optimizer_base_id ?? item.id));
        const contrib = this._getContribForBonus(item, this._resolveBonusIds(bonusId));
        return ['flat', 'percent', 'multiplier']
            .map(ut => [ut, contrib[ut]])
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
                    percentStages: ut === 'percent' ? { ...contrib.percentStages } : null,
                    unit_type:    ut,
                    mult:         ut === 'multiplier' ? 1 : count,
                    display_mult: count,
                    _key:         (item._optimizer_base_id ?? item.id) + ':' + ut + ':' + (tierBadge ?? ''),
                };
            });
    },

    _getContribForBonus(item, bonusId) {
        const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
        const rule = this._compoundRuleForBonus(ids);
        const contrib = { flat: 0, percent: 0, percentStages: {}, multiplier: 0 };
        for (const b of item.bonuses ?? []) {
            if (!ids.includes(b.bonus)) continue;
            const ut = b.unit_type ?? 'flat';
            contrib[ut] = (contrib[ut] ?? 0) + (b.value ?? 0);
            if (ut === 'percent') {
                const stageId = this._compoundPercentStageId(b, ids, rule);
                if (stageId) contrib.percentStages[stageId] = (contrib.percentStages[stageId] ?? 0) + (b.value ?? 0);
            }
        }
        return contrib;
    },
};
