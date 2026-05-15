import { formatVal, formatValExact, normalizeValue, sharedDisplayDecimals } from '../utils.js?v=7e5a144c2d';
import { optimize } from '../optimizer.v2.js?v=00826f439d';
import { compoundTotalFromItems } from '../compoundMath.js?v=badea150ed';
import { buildPlacementInstances, canPlaceSelectionInContainers } from '../slotPlacement.js?v=8da036ae76';
import { buildRuneLayout, canPlaceRuneSelection, getRuneAddLimitFromLayout } from '../runeLayout.js?v=3e9e5f12a9';

/**
 * Bonus calculation mixin.
 * Handles resolving bonus values, applying formulas, generating tier rows,
 * running the optimizer, and computing compound totals.
 */
export const bonusMethods = {
    resolveSourceBonusValue(src, bonusEntry) {
        const petProgression = this._resolvePetProgression(src, bonusEntry);
        if (petProgression) {
            const selectedLevel = Number(src?._selectedPetLevel);
            if (bonusEntry?.pet_base != null) {
                return this._resolvePetProgressionValue(
                    petProgression,
                    bonusEntry,
                    null,
                    Number.isFinite(selectedLevel) ? selectedLevel : null
                );
            }
            const selectedTier = Number(src?._selectedPetTier);
            return this._resolvePetProgressionValue(
                petProgression,
                bonusEntry,
                Number.isFinite(selectedTier) ? selectedTier : null,
                Number.isFinite(selectedLevel) ? selectedLevel : null
            );
        }

        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula) return (bonusEntry.value ?? 0);

        const selectedTier = Number(bonusEntry?._selectedTier);
        if (!Number.isFinite(selectedTier)) {
            return this._applyFormula(formula, bonusEntry.unlock_at_tier ?? 1);
        }

        return this._calculateValue(
            this._applyFormula({ ...formula, max_tier: selectedTier }, bonusEntry.unlock_at_tier ?? 1),
            bonusEntry.scales_with,
            bonusEntry.scale_formula
        );
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

    _activeDisplayBonusVariants(src, bonusEntry) {
        const progression = this._resolvePetProgression(src, bonusEntry);
        if (!progression || bonusEntry?.pet_base != null || !Array.isArray(bonusEntry?.tier_bases)) {
            return this._displayBonusVariants(src, bonusEntry);
        }

        const resolvedTier = Number(src?._selectedPetTier ?? src?._actualPetTier);
        if (!Number.isFinite(resolvedTier)) {
            return this._displayBonusVariants(src, bonusEntry);
        }

        const tiers = progression?.tiers ?? {};
        const minTier = Number(tiers.min ?? 1);
        const maxTier = Number(tiers.max ?? bonusEntry.tier_bases.length);
        const clampedTier = Math.max(minTier, Math.min(maxTier, resolvedTier));
        const unitType = this._resolvePetTierUnitType(bonusEntry, clampedTier);

        return [{
            ...bonusEntry,
            unit_type: unitType,
            value: this._resolvePetProgressionValue(progression, bonusEntry, clampedTier, src?._selectedPetLevel ?? src?._actualPetLevel ?? null),
            _tierBadgeLabel: `T${clampedTier}`,
            _petTierUnitTypeVariant: true,
            _petTierVariantTiers: [clampedTier]
        }];
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

    _bonusStateRef(src, bonusEntry) {
        const isPetTierBonus = Array.isArray(bonusEntry?.tier_bases) && !!this._resolvePetProgression(src, bonusEntry);
        return {
            sourceId: src?.id ?? '',
            instanceKey: src?._maxPanelInstanceIndex != null ? `i${Number(src._maxPanelInstanceIndex) + 1}` : '',
            bonusId: bonusEntry?.bonus ?? '',
            kind: isPetTierBonus ? 'pet-tier' : (bonusEntry?._expanded_bonus_key ?? bonusEntry?.unit_type ?? 'flat'),
            ascensionKey: bonusEntry?._is_ascension ? 'asc' : 'base'
        };
    },

    _tierTabSelectionKey(src, bonusEntry) {
        const ref = this._bonusStateRef(src, bonusEntry);
        return [
            ref.sourceId,
            ref.instanceKey,
            ref.bonusId,
            ref.kind,
            ref.ascensionKey
        ].join(':');
    },

    _initialActiveTierTabLabel(src, bonusEntry, tabs) {
        if (!tabs?.length) return null;
        const selectedTab = tabs.find(tab => tab.rows?.some(row => row?.isSelected));
        if (selectedTab?.label) return selectedTab.label;
        const actualTab = tabs.find(tab => tab.rows?.some(row => row?.isActual));
        if (actualTab?.label) return actualTab.label;
        return tabs[0].label;
    },

    _activeTierTabLabel(entry, bonusEntry, tabs) {
        if (!tabs?.length) return null;
        const src = entry?.src ?? entry;
        const key = this._tierTabSelectionKey(src, bonusEntry);
        const entrySelection = entry?._activeTierTabs?.[key];
        if (tabs.some(tab => tab.label === entrySelection)) return entrySelection;
        const persisted = this.tierTabSelections?.[key];
        if (tabs.some(tab => tab.label === persisted)) return persisted;
        return this._initialActiveTierTabLabel(src, bonusEntry, tabs);
    },

    setActiveTierTab(entry, bonusEntry, tabLabel) {
        const src = entry?.src ?? entry;
        const key = this._tierTabSelectionKey(src, bonusEntry);
        if (entry?.src) {
            entry._activeTierTabs = {
                ...(entry._activeTierTabs ?? {}),
                [key]: tabLabel
            };
        }
        this.tierTabSelections = {
            ...(this.tierTabSelections ?? {}),
            [key]: tabLabel
        };
    },

    _tierPreviewExpansionKey(src, bonusEntry, tabLabel = null) {
        return [
            src?.id ?? '',
            this._tierTabSelectionKey(src, bonusEntry),
            tabLabel ?? ''
        ].join(':tab=');
    },

    _tierPreviewExpansionCount(src, bonusEntry, tabLabel = null) {
        return Math.max(0, Number(this.tierPreviewExpansions?.[this._tierPreviewExpansionKey(src, bonusEntry, tabLabel)] ?? 0));
    },

    expandTierPreview(src, bonusEntry, tabLabel = null) {
        const key = this._tierPreviewExpansionKey(src, bonusEntry, tabLabel);
        this.tierPreviewExpansions = {
            ...(this.tierPreviewExpansions ?? {}),
            [key]: this._tierPreviewExpansionCount(src, bonusEntry, tabLabel) + 1
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
                    const displayRows = this._buildDisplayRows(entry.src, b, collection.rows, { tabLabel: collection.label });
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
                const activeTabLabel = this._activeTierTabLabel(entry, b, tabs);
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

    _buildDisplayRows(src, bonusEntry, rows, options = {}) {
        const total = rows.length;
        const maxVisible = this.data.tier_preview_limit ?? 5;
        const tabLabel = options.tabLabel ?? null;
        const baseHeadCount = Math.max(0, maxVisible - 2);
        const expansionCount = this._tierPreviewExpansionCount(src, bonusEntry, tabLabel);
        const headCount = baseHeadCount + (expansionCount * maxVisible);
        let indices;
        if (total <= headCount + 2) {
            indices = rows.map((_, i) => i);
        } else {
            indices = [...Array(headCount).keys(), null, total - 1];
            if (expansionCount === 0) {
                const actualIndex = rows.findIndex(tierRow => this._isActualTierRow(src, bonusEntry, tierRow));
                const selectedIndex = rows.findIndex(tierRow => this._isSelectedTierRow(src, bonusEntry, tierRow));
                const hiddenStart = headCount;
                const hiddenEnd = total - 2;
                const emphasizedIndex = [selectedIndex, actualIndex].find(index => index >= hiddenStart && index <= hiddenEnd);
                if (emphasizedIndex >= hiddenStart && emphasizedIndex <= hiddenEnd) {
                    const reducedHeadCount = Math.max(0, headCount - 2);
                    indices = [...Array(reducedHeadCount).keys(), null, emphasizedIndex, null, total - 1];
                }
            }
        }

        const displayRows = indices.map(idx => {
            if (idx === null) return { isEllipsis: true, tabLabel };
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
        const state = this.maxPanelEdits?.[tab] ?? {};
        return {
            counts: { ...(state.counts ?? {}) },
            tiers: { ...(state.tiers ?? {}) },
            disabled: { ...(state.disabled ?? {}) },
            instances: Object.fromEntries(
                Object.entries(state.instances ?? {}).map(([sourceId, ids]) => [sourceId, [...(ids ?? [])]])
            )
        };
    },

    _maxPanelItemKey(item) {
        const instanceKey = item?._instanceIndex != null ? `:i${Number(item._instanceIndex) + 1}` : '';
        return `${item.src.id}:${item.tierBadge ?? item.bonus?._tierBadgeLabel ?? ''}${instanceKey}`;
    },

    _maxPanelTierKey(src, bonusEntry, instanceIndex = null) {
        const isPetTierBonus = Array.isArray(bonusEntry?.tier_bases) && !!this._resolvePetProgression(src, bonusEntry);
        return [
            src?.id ?? '',
            instanceIndex != null ? `i${Number(instanceIndex) + 1}` : '',
            bonusEntry?._maxPanelBonusIndex ?? '',
            isPetTierBonus
                ? `pet-tier:${bonusEntry?.bonus ?? ''}`
                : (bonusEntry?._expanded_bonus_key ?? bonusEntry?.bonus ?? ''),
            isPetTierBonus ? 'pet-tier' : (bonusEntry?.unit_type ?? 'flat'),
            bonusEntry?._is_ascension ? 'asc' : 'base'
        ].join(':');
    },

    _updateMaxPanelState(tab, state) {
        this.maxPanelEdits = {
            ...this.maxPanelEdits,
            [tab]: {
                counts: { ...(state.counts ?? {}) },
                tiers: { ...(state.tiers ?? {}) },
                disabled: { ...(state.disabled ?? {}) },
                instances: Object.fromEntries(
                    Object.entries(state.instances ?? {}).map(([sourceId, ids]) => [sourceId, [...(ids ?? [])]])
                )
            }
        };
    },

    hasMaxPanelEdits(tab = this.maxTab) {
        const state = this._maxPanelEditState(tab);
        return Object.keys(state.counts ?? {}).length > 0
            || Object.keys(state.tiers ?? {}).length > 0
            || Object.keys(state.disabled ?? {}).length > 0
            || Object.keys(state.instances ?? {}).length > 0;
    },

    resetMaxPanel(tab = this.maxTab) {
        this._updateMaxPanelState(tab, { counts: {}, tiers: {}, disabled: {}, instances: {} });
    },

    removeMaxPanelItem(tab, item) {
        this._adjustMaxPanelSourceCount(tab, item?.src?.id, -1);
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

    isMaxPanelItemDisabled(item, tab = this.maxTab) {
        if (!item) return false;
        return Boolean(this._maxPanelEditState(tab).disabled?.[this._maxPanelItemKey(item)]);
    },

    toggleMaxPanelItemDisabled(item, tab = this.maxTab) {
        if (!item) return;
        const state = this._maxPanelEditState(tab);
        const key = this._maxPanelItemKey(item);
        const disabled = { ...(state.disabled ?? {}) };
        if (disabled[key]) delete disabled[key];
        else disabled[key] = true;
        this._updateMaxPanelState(tab, { ...state, disabled });
    },

    _maxPanelMaterializeBonus(bonus) {
        if (!bonus) return bonus;
        return bonus.derived_from
            ? { ...bonus, _materialized_derived_from: bonus.derived_from }
            : { ...bonus };
    },

    _maxPanelApplyTierSelectionsToSource(src, tab = this.maxTab, instanceIndex = null, options = {}) {
        const { materializeDerived = false } = options;
        const overrides = this._maxPanelEditState(tab).tiers ?? {};
        let nextSelectedPetLevel = src?._selectedPetLevel;
        let nextSelectedPetTier = src?._selectedPetTier;
        const baseBonuses = materializeDerived
            ? this._expandDerivedBonuses(src?.bonuses ?? [])
            : (src?.bonuses ?? []);
        const bonuses = baseBonuses.map((bonus, index) => {
            const nextBonus = materializeDerived
                ? this._maxPanelMaterializeBonus(bonus)
                : { ...bonus, _maxPanelBonusIndex: index };
            const override = overrides[this._maxPanelTierKey(src, nextBonus, instanceIndex)];
            const selection = materializeDerived
                ? override
                : (override ?? this._defaultTierSelection(src, nextBonus));
            if (!selection) return nextBonus;
            if (selection.tier != null) nextBonus._selectedTier = selection.tier;
            if (selection.petLevel != null) nextSelectedPetLevel = selection.petLevel;
            if (selection.petTier != null) nextSelectedPetTier = selection.petTier;
            return nextBonus;
        });
        return {
            ...src,
            _selectedPetLevel: nextSelectedPetLevel,
            _selectedPetTier: nextSelectedPetTier,
            bonuses
        };
    },

    maxPanelEditSource(src, tab = this.maxTab, instanceIndex = null) {
        const baseSrc = this._maxPanelSourceById(tab, src.id) ?? src;
        return this._maxPanelApplyTierSelectionsToSource({
            ...baseSrc,
            _maxPanelInstanceIndex: instanceIndex,
        }, tab, instanceIndex);
    },

    _maxPanelBonusEntriesForBonusView(src, bonusIds) {
        const entries = src?._maxPanelMaterializedBonuses
            ? (src.bonuses ?? []).filter(b => bonusIds.includes(b?.bonus) && this._bonusMatchesClass(b, src))
            : this._bonusEntriesForBonusView(src, bonusIds);
        return entries.filter(Boolean);
    },

    maxPanelTierEditSource(src, tab = this.maxTab, instanceIndex = null) {
        const baseSrc = this.maxPanelEditSource(src, tab, instanceIndex);
        return {
            ...this._maxPanelApplyTierSelectionsToSource(baseSrc, tab, instanceIndex, { materializeDerived: true }),
            _maxPanelMaterializedBonuses: true,
        };
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
            canAdd: new Map(),
            runeLayout: slotId === 'rune_socket'
                ? buildRuneLayout(
                    this.data.rune_circles ?? [],
                    this._maxPanelSlottedSourceCounts(tab, slotId),
                    sourceId => this._maxPanelPlacementSourceById(tab, sourceId, slotId)
                )
                : null
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

    _maxPanelVisibleSourceCounts(tab = this.maxTab) {
        const counts = new Map();
        const perInstance = new Map();
        for (const item of this.maxItemsByTab(tab)) {
            const sourceId = item.src?.id;
            if (!sourceId) continue;
            if (item?._instanceIndex != null) {
                if (!perInstance.has(sourceId)) perInstance.set(sourceId, new Set());
                perInstance.get(sourceId).add(Number(item._instanceIndex));
                continue;
            }
            counts.set(sourceId, Math.max(counts.get(sourceId) ?? 0, Number(item.display_mult ?? item.mult ?? 1)));
        }
        for (const [sourceId, instanceIds] of perInstance.entries()) {
            counts.set(sourceId, instanceIds.size);
        }
        return counts;
    },

    _maxPanelCurrentSourceCount(sourceId, tab = this.maxTab) {
        const instanceIds = this._maxPanelEditState(tab).instances?.[sourceId];
        if (Array.isArray(instanceIds)) return instanceIds.length;
        return Number(this._maxPanelVisibleSourceCounts(tab).get(sourceId) ?? 0);
    },

    _setMaxPanelSourceDelta(tab, sourceId, delta) {
        if (!sourceId) return;
        const state = this._maxPanelEditState(tab);
        const counts = { ...(state.counts ?? {}) };
        if (!delta) delete counts[sourceId];
        else counts[sourceId] = delta;
        this._updateMaxPanelState(tab, { ...state, counts });
    },

    _adjustMaxPanelSourceCount(tab, sourceId, delta) {
        if (!sourceId || !delta) return;
        const state = this._maxPanelEditState(tab);
        const nextDelta = Number(state.counts?.[sourceId] ?? 0) + Number(delta);
        this._setMaxPanelSourceDelta(tab, sourceId, nextDelta);
    },

    _maxPanelVisibleInstanceIds(sourceId, tab = this.maxTab) {
        const stateIds = this._maxPanelEditState(tab).instances?.[sourceId];
        if (Array.isArray(stateIds) && stateIds.length) {
            return [...stateIds];
        }
        const ids = [];
        const seen = new Set();
        for (const item of this.maxItemsByTab(tab)) {
            if (item?.src?.id !== sourceId) continue;
            if (item?._instanceIndex == null || seen.has(item._instanceIndex)) continue;
            seen.add(item._instanceIndex);
            ids.push(Number(item._instanceIndex));
        }
        return ids;
    },

    _maxPanelSourceBaseCount(sourceId, tab = this.maxTab) {
        const currentCount = this._maxPanelCurrentSourceCount(sourceId, tab);
        const delta = Number(this._maxPanelEditState(tab).counts?.[sourceId] ?? 0);
        return Math.max(0, currentCount - delta);
    },

    _maxPanelNormalizedInstanceIds(sourceId, desiredCount, tab = this.maxTab) {
        const state = this._maxPanelEditState(tab);
        const currentIds = [...(state.instances?.[sourceId] ?? this._maxPanelVisibleInstanceIds(sourceId, tab))];
        const nextIds = currentIds.slice(0, desiredCount);
        let nextId = currentIds.length ? (Math.max(...currentIds) + 1) : 0;
        while (nextIds.length < desiredCount) {
            nextIds.push(nextId);
            nextId += 1;
        }
        return nextIds;
    },

    _setMaxPanelSourceInstances(tab, sourceId, nextIds) {
        if (!sourceId) return;
        const state = this._maxPanelEditState(tab);
        const baseCount = this._maxPanelSourceBaseCount(sourceId, tab);
        const nextCount = Math.max(0, nextIds.length);
        const nextDelta = nextCount - baseCount;
        const counts = { ...(state.counts ?? {}) };
        if (!nextDelta) delete counts[sourceId];
        else counts[sourceId] = nextDelta;

        const instances = { ...(state.instances ?? {}) };
        if (nextCount > 0) instances[sourceId] = [...nextIds];
        else delete instances[sourceId];

        const tiers = {};
        for (const [key, value] of Object.entries(state.tiers ?? {})) {
            if (!key.startsWith(`${sourceId}:i`)) {
                tiers[key] = value;
                continue;
            }
            const keep = nextIds.some(instanceId => key.startsWith(`${sourceId}:i${instanceId + 1}:`));
            if (keep) {
                tiers[key] = value;
            }
        }

        const disabled = {};
        for (const [key, value] of Object.entries(state.disabled ?? {})) {
            if (!key.startsWith(`${sourceId}:`)) {
                disabled[key] = value;
                continue;
            }
            const keep = nextIds.some(instanceId => key.endsWith(`:i${instanceId + 1}`) || key === `${sourceId}:i${instanceId + 1}`);
            if (keep) {
                disabled[key] = value;
            }
        }

        this._updateMaxPanelState(tab, { counts, tiers, disabled, instances });
    },

    _addMaxPanelSourceInstances(tab, sourceId, amount = 1) {
        if (!sourceId || amount <= 0) return;
        const currentIds = this._maxPanelVisibleInstanceIds(sourceId, tab);
        const nextIds = [...currentIds];
        let nextId = nextIds.length ? (Math.max(...nextIds) + 1) : 0;
        for (let i = 0; i < amount; i += 1) {
            nextIds.push(nextId);
            nextId += 1;
        }
        this._setMaxPanelSourceInstances(tab, sourceId, nextIds);
    },

    _maxPanelCanFitSourceCount(src, desiredCount, tab = this.maxTab) {
        if (!src?.id) return false;
        if (desiredCount < 0) return false;
        if (!src.slot) {
            return desiredCount <= 1;
        }
        if (src.slot === 'rune_socket') {
            const context = this._maxPanelPlacementContext(tab, src.slot);
            const sourceCounts = new Map(context.sourceCounts);
            if (desiredCount <= 0) sourceCounts.delete(src.id);
            else sourceCounts.set(src.id, desiredCount);
            return canPlaceRuneSelection(
                this.data.rune_circles ?? [],
                sourceCounts,
                sourceId => this._maxPanelPlacementSourceById(tab, sourceId, src.slot)
            );
        }
        if (desiredCount > Number(src.max ?? Infinity)) return false;
        const slotUsage = this._maxPanelUsageContext(tab).slotUsage.get(src.slot) ?? new Map();
        let used = 0;
        for (const [sourceId, entry] of slotUsage.entries()) {
            const count = sourceId === src.id ? desiredCount : entry.count;
            used += (entry.size * count);
        }
        if (!slotUsage.has(src.id)) {
            used += Number(src.size ?? 1) * desiredCount;
        }
        return used <= this.slotMax(src.slot);
    },

    maxPanelAddLimit(item, tab = this.maxTab) {
        const src = item?.src;
        if (!src?.id) return 0;
        const currentCount = this._maxPanelCurrentSourceCount(src.id, tab);
        if (!src.slot) return currentCount > 0 ? 0 : 1;
        if (src.slot === 'rune_socket') {
            const context = this._maxPanelPlacementContext(tab, src.slot);
            if (!context.canAdd.has(src.id)) {
                context.canAdd.set(src.id, getRuneAddLimitFromLayout(
                    context.runeLayout,
                    context.sourceCounts,
                    sourceId => this._maxPanelPlacementSourceById(tab, sourceId, src.slot),
                    src.id
                ));
            }
            return context.canAdd.get(src.id) ?? 0;
        }
        let limit = 0;
        let desiredCount = currentCount;
        while (this._maxPanelCanFitSourceCount(src, desiredCount + 1, tab)) {
            limit += 1;
            desiredCount += 1;
        }
        return limit;
    },

    maxPanelRemoveLimit(item, tab = this.maxTab) {
        return this._maxPanelCurrentSourceCount(item?.src?.id, tab);
    },

    openMaxPanelQuantityPopover(item, mode, event, tab = this.maxTab) {
        const src = item?.src;
        if (!src?.id) return;
        const currentCount = this._maxPanelCurrentSourceCount(src.id, tab);
        const maxAllowed = mode === 'remove'
            ? this.maxPanelRemoveLimit(item, tab)
            : this.maxPanelAddLimit(item, tab);
        if (maxAllowed <= 1) return;
        this.openQuantityPopover({
            src: this.maxPanelEditSource(src, tab),
            sourceId: src.id,
            tab,
            mode,
            currentCount,
            maxAllowed
        }, event);
    },

    handleMaxPanelAdd(item, event, tab = this.maxTab) {
        const maxAllowed = this.maxPanelAddLimit(item, tab);
        if (maxAllowed <= 0) return;
        if (maxAllowed === 1) {
            if (this.maxPanelSourceUsesPerInstanceRows(item?.src)) this._addMaxPanelSourceInstances(tab, item?.src?.id, 1);
            else this._adjustMaxPanelSourceCount(tab, item?.src?.id, 1);
            return;
        }
        this.openMaxPanelQuantityPopover(item, 'add', event, tab);
    },

    handleSourceAdd(src, event, tab = this.maxTab) {
        const item = { src: this.maxPanelEditSource(src, tab) };
        const maxAllowed = this.maxPanelAddLimit(item, tab);
        if (maxAllowed <= 0) return;
        if (maxAllowed === 1) {
            if (this.maxPanelSourceUsesPerInstanceRows(src)) this._addMaxPanelSourceInstances(tab, src?.id, 1);
            else this._adjustMaxPanelSourceCount(tab, src?.id, 1);
            return;
        }
        this.openMaxPanelQuantityPopover(item, 'add', event, tab);
    },

    handleMaxPanelRemove(item, event, tab = this.maxTab) {
        const maxAllowed = this.maxPanelRemoveLimit(item, tab);
        if (maxAllowed <= 0) return;
        if (maxAllowed === 1) {
            this._adjustMaxPanelSourceCount(tab, item?.src?.id, -1);
            return;
        }
        this.openMaxPanelQuantityPopover(item, 'remove', event, tab);
    },

    removeMaxPanelDisplayItem(item, event, tab = this.maxTab) {
        if (!item?.src?.id) return;
        if (this.maxPanelSourceUsesPerInstanceRows(item.src)) {
            const nextIds = this._maxPanelVisibleInstanceIds(item.src.id, tab)
                .filter(instanceId => instanceId !== item?._instanceIndex);
            this._setMaxPanelSourceInstances(tab, item.src.id, nextIds);
            return;
        }
        this.handleMaxPanelRemove(item, event, tab);
    },

    applyQuantityPopover(amount) {
        const entry = this.quantityPopoverEntry;
        if (!entry?.sourceId) return;
        const resolvedAmount = Math.max(1, Math.floor(Number(amount ?? 1)));
        const applied = Math.min(resolvedAmount, Number(entry.maxAllowed ?? 1));
        const tab = entry.tab ?? this.maxTab;
        if (entry.mode === 'add' && this.maxPanelSourceUsesPerInstanceRows(entry.src)) {
            this._addMaxPanelSourceInstances(tab, entry.sourceId, applied);
        } else {
            const delta = entry.mode === 'remove' ? -applied : applied;
            this._adjustMaxPanelSourceCount(tab, entry.sourceId, delta);
        }
        this.closeQuantityPopover();
    },

    _maxPanelPlacementSourceById(tab, sourceId, slotId = null) {
        const currentSrc = this._maxPanelSourceById(tab, sourceId);
        if (!(tab === 'actual' && slotId === 'rune_socket')) return currentSrc;
        return (this.data?._base_sources ?? []).find(src => src.id === sourceId) ?? currentSrc;
    },

    _buildPlacementInstances(sourceCounts, slotId, tab = this.maxTab) {
        return buildPlacementInstances(
            sourceCounts,
            sourceId => this._maxPanelPlacementSourceById(tab, sourceId, slotId),
            slotId
        );
    },

    _canPlaceInContainers(slotId, sourceCounts, tab = this.maxTab) {
        const containers = this._buildAllContainers()
            .filter(container => container.slot_type === slotId);
        if (!containers.length) return false;

        const instances = this._buildPlacementInstances(sourceCounts, slotId, tab);
        return canPlaceSelectionInContainers(containers, instances);
    },

    _sourceHasActiveMaxBonus(src) {
        if (!src || !this.selectedBonus) return false;
        const ids = this._resolveBonusIds(this.selectedBonus);
        return this._bonusEntriesForBonusView(src, ids).some(bonusEntry =>
            ids.includes(bonusEntry.bonus) && this._bonusPassesFilters(bonusEntry, src)
        );
    },

    canAddSourceToMax(src, tab = this.maxTab) {
        if (!this.selectedBonus) return false;
        if (!this._sourceHasActiveMaxBonus(src)) return false;
        if (src?.slot === 'rune_socket') {
            return this.maxPanelAddLimit({ src }, tab) > 0;
        }
        return this._maxPanelCanFitSourceCount(src, this._maxPanelCurrentSourceCount(src.id, tab) + 1, tab);
    },

    addSourceToMax(src, event = null, tab = this.maxTab) {
        if (event) event.stopPropagation();
        if (!this.canAddSourceToMax(src, tab)) return;
        this.handleSourceAdd(src, event, tab);
    },

    _maxPanelSelectionBadgeLabel(tierRow) {
        if (!tierRow) return null;
        return tierRow._tierBadgeLabel ?? (tierRow._petTier != null ? `T${tierRow._petTier}` : tierRow.label ?? null);
    },

    _maxPanelSelectedTierBadges(src, tab = this.maxTab, instanceIndex = null) {
        const ids = this._resolveBonusIds(this.selectedBonus);
        const labels = [];
        const seen = new Set();
        for (const bonusEntry of this._maxPanelBonusEntriesForBonusView(src, ids)) {
            const selectionLabels = this._maxPanelSelectionLabelsForBonus(src, bonusEntry, tab, instanceIndex);
            for (const label of selectionLabels) {
                if (!label || seen.has(label)) continue;
                seen.add(label);
                labels.push(label);
            }
        }
        return labels;
    },

    _maxPanelSelectionLabelsForBonus(src, bonusEntry, tab = this.maxTab, instanceIndex = null) {
        const selection = this._maxPanelEditState(tab).tiers?.[this._maxPanelTierKey(src, bonusEntry, instanceIndex)] ?? null;
        if (!selection) return [];

        const rows = this._getTierRows(src, bonusEntry, bonusEntry.bonus);
        if (Array.isArray(rows)) {
            const match = rows.find(row => this._matchesTierRowSelection(selection, row)) ?? null;
            if (match) return this._maxPanelLabelsFromTierRow(match);
        }

        const matrix = this._getTierMatrix(src, bonusEntry, bonusEntry.bonus);
        if (Array.isArray(matrix)) {
            for (const collection of matrix) {
                const match = collection?.rows?.find(row => this._matchesTierRowSelection(selection, row)) ?? null;
                if (match) return this._maxPanelLabelsFromTierRow(match);
            }
        }

        const fallback = [];
        if (selection.badgeLabel) fallback.push(selection.badgeLabel);
        if (selection.rowLabel && selection.rowLabel !== selection.badgeLabel) fallback.push(selection.rowLabel);
        return fallback;
    },

    _maxPanelLabelsFromTierRow(tierRow) {
        if (!tierRow) return [];
        const labels = [];
        const badgeLabel = this._maxPanelSelectionBadgeLabel(tierRow);
        if (badgeLabel) labels.push(badgeLabel);
        if (tierRow.label && tierRow.label !== badgeLabel) labels.push(tierRow.label);
        return labels;
    },

    maxPanelSourceUsesPerInstanceRows(src) {
        if (!src?.bonuses?.length || !this.selectedBonus) return false;
        const ids = this._resolveBonusIds(this.selectedBonus);
        return this._maxPanelBonusEntriesForBonusView(src, ids).some(bonusEntry =>
            !!this._getTierRows(src, bonusEntry, bonusEntry.bonus)
            || !!this._getTierMatrix(src, bonusEntry, bonusEntry.bonus)
        );
    },

    _maxPanelBonusMatches(candidate, bonus) {
        if (candidate?._expanded_bonus_key || bonus?._expanded_bonus_key) {
            return candidate?._expanded_bonus_key === bonus?._expanded_bonus_key;
        }
        const candidateDerivedFrom = candidate?._materialized_derived_from ?? candidate?.derived_from ?? null;
        const bonusDerivedFrom = bonus?._materialized_derived_from ?? bonus?.derived_from ?? null;
        return candidate?._maxPanelBonusIndex === bonus?._maxPanelBonusIndex
            && candidate?.bonus === bonus?.bonus
            && (candidate?.unit_type ?? 'flat') === (bonus?.unit_type ?? 'flat')
            && candidateDerivedFrom === bonusDerivedFrom
            && (candidate?._tierBadgeLabel ?? null) === (bonus?._tierBadgeLabel ?? null);
    },

    _maxPanelResolvableBonuses(src) {
        if (!src) return [];
        const baseBonuses = src?._maxPanelMaterializedBonuses
            ? (src.bonuses ?? [])
            : this._expandDerivedBonuses(src.bonuses ?? []);
        return baseBonuses.flatMap(bonusEntry => this._activeDisplayBonusVariants(src, bonusEntry));
    },

    _maxPanelBonusRefsForEntry(bonus) {
        const group = bonus?._groupBonuses ?? (bonus ? [bonus] : []);
        return group.map(entry => ({
            expandedKey: entry?._expanded_bonus_key ?? null,
            bonusIndex: entry?._maxPanelBonusIndex ?? null,
            bonusId: entry?.bonus ?? null,
            derivedFrom: entry?._materialized_derived_from ?? entry?.derived_from ?? null,
            isAscension: Boolean(entry?._is_ascension),
            kind: this._bonusStateRef(null, entry).kind
        }));
    },

    _maxPanelResolveBonusesByRefs(src, refs = []) {
        const candidates = this._maxPanelResolvableBonuses(src);
        return refs.map(ref => {
            if (ref?.expandedKey) {
                return candidates.find(candidate => candidate?._expanded_bonus_key === ref.expandedKey) ?? null;
            }
            return candidates.find(candidate =>
                candidate?._maxPanelBonusIndex === ref?.bonusIndex
                && candidate?.bonus === ref?.bonusId
                && (candidate?._materialized_derived_from ?? candidate?.derived_from ?? null) === (ref?.derivedFrom ?? null)
                && Boolean(candidate?._is_ascension) === Boolean(ref?.isAscension)
                && this._bonusStateRef(null, candidate).kind === ref?.kind
            ) ?? null;
        }).filter(Boolean);
    },

    _maxPanelResolveBonusGroup(src, bonus) {
        if (!src || !bonus) return null;
        const expandedBonuses = this._maxPanelResolvableBonuses(src);
        const group = bonus?._groupBonuses ?? [bonus];
        const remappedGroup = group
            .map(openBonus => expandedBonuses.find(candidate => this._maxPanelBonusMatches(candidate, openBonus)) ?? null)
            .filter(Boolean);
        if (!remappedGroup.length) return null;
        return {
            ...remappedGroup[0],
            _groupBonuses: remappedGroup
        };
    },

    maxPanelTierPopoverTarget(item, tab = this.maxTab) {
        if (!item?.src || !this.selectedBonus) return null;
        const src = this.maxPanelTierEditSource(item.src, tab, item?._instanceIndex ?? null);
        if (item?.bonus?._groupBonuses?.length || item?.bonus?._maxPanelBonusIndex != null) {
            return { src, bonus: this._maxPanelResolveBonusGroup(src, item.bonus) ?? item.bonus };
        }
        const ids = this._resolveBonusIds(this.selectedBonus);
        const targetUnitType = item.unit_type || item.bonus?.unit_type || 'flat';
        const targetTierBadge = item.tierBadge ?? item.bonus?._tierBadgeLabel ?? null;
        let fallback = null;

        for (const bonusEntry of this._maxPanelBonusEntriesForBonusView(src, ids)) {
            if (!ids.includes(bonusEntry.bonus) || !this._bonusPassesFilters(bonusEntry, src)) continue;
            for (const variant of this._activeDisplayBonusVariants(src, bonusEntry)) {
                if (!this.bonusHasTiers(src, variant)) continue;
                if (!fallback) fallback = { src, bonus: variant };
                const unitType = variant.unit_type || 'flat';
                const tierBadge = variant._tierBadgeLabel ?? null;
                if (unitType === targetUnitType && tierBadge === targetTierBadge) {
                    return { src, bonus: variant };
                }
            }
        }

        return fallback;
    },

    _maxPanelRefreshOpenEntries(context, src, bonusEntry) {
        const refreshEntryBonuses = entry => {
            const refs = entry?._maxBonusRefs ?? null;
            if (Array.isArray(refs) && refs.length) {
                return this._maxPanelResolveBonusesByRefs(src, refs);
            }
            return (entry?.bonuses ?? [])
                .map(openBonus => this._maxPanelResolveBonusGroup(src, openBonus))
                .filter(Boolean);
        };
        const infoSrc = this.maxPanelEditSource(
            this._maxPanelSourceById(context.tab, context.sourceId) ?? src,
            context.tab,
            context.instanceIndex ?? null
        );
        if (this.itemPopoverEntry?.maxItemContext?.tab === context.tab
            && this.itemPopoverEntry?.maxItemContext?.sourceId === context.sourceId
            && this.itemPopoverEntry?.maxItemContext?.instanceIndex === context.instanceIndex) {
            this.itemPopoverEntry = { ...this.itemPopoverEntry, src: infoSrc };
        }
        if (this.tierPopoverEntry?.maxItemContext?.tab === context.tab
            && this.tierPopoverEntry?.maxItemContext?.sourceId === context.sourceId
            && this.tierPopoverEntry?.maxItemContext?.instanceIndex === context.instanceIndex) {
            const refreshedBonuses = refreshEntryBonuses(this.tierPopoverEntry);
            this.tierPopoverEntry = {
                ...this.tierPopoverEntry,
                src,
                bonuses: refreshedBonuses.length ? refreshedBonuses : (this.tierPopoverEntry?.bonuses ?? []),
                _activeTierTabs: { ...(this.tierPopoverEntry?._activeTierTabs ?? {}) }
            };
        }
        if (this.tierSheetEntry?.maxItemContext?.tab === context.tab
            && this.tierSheetEntry?.maxItemContext?.sourceId === context.sourceId
            && this.tierSheetEntry?.maxItemContext?.instanceIndex === context.instanceIndex) {
            const refreshedBonuses = refreshEntryBonuses(this.tierSheetEntry);
            this.tierSheetEntry = {
                ...this.tierSheetEntry,
                src,
                bonuses: refreshedBonuses.length ? refreshedBonuses : (this.tierSheetEntry?.bonuses ?? []),
                _activeTierTabs: { ...(this.tierSheetEntry?._activeTierTabs ?? {}) }
            };
        }
    },

    applyMaxTierSelection(entry, bonusEntry, tierRow) {
        const context = entry?.maxItemContext;
        if (!context || !bonusEntry || !tierRow) return;
        const tab = context.tab ?? this.maxTab;
        const instanceIndex = context.instanceIndex ?? null;
        const src = this._maxPanelSourceById(tab, context.sourceId) ?? entry.src;
        const state = this._maxPanelEditState(tab);
        const key = this._maxPanelTierKey(src, bonusEntry, instanceIndex);
        const isRelevant = this._isBonusRelevantToCurrentSelection(bonusEntry);
        const nextSelection = {
            tier: tierRow._tier ?? null,
            petLevel: tierRow._petLevel ?? null,
            petTier: tierRow._petTier ?? null,
            badgeLabel: this._maxPanelSelectionBadgeLabel(tierRow),
            rowLabel: tierRow?.label ?? null
        };
        const shouldClear = !isRelevant;
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
        if (tierRow._petTier != null) {
            this.setActiveTierTab(entry, bonusEntry, `T${tierRow._petTier}`);
        }
        this._maxPanelRefreshOpenEntries(context, this.maxPanelTierEditSource(src, tab, instanceIndex), bonusEntry);
    },

    _maxPanelBuildSourceInstanceItems(src, sourceMode, tab = this.maxTab, instanceIndex = null) {
        const ids = this._resolveBonusIds(this.selectedBonus);
        const compoundRule = this._compoundRuleForBonus(ids);
        const buckets = new Map();
        const matchingBonuses = this._maxPanelBonusEntriesForBonusView(src, ids).filter(bonusEntry =>
            ids.includes(bonusEntry.bonus) && this._bonusPassesFilters(bonusEntry, src)
        );

        for (const bonusEntry of matchingBonuses) {
            for (const variant of this._activeDisplayBonusVariants(src, bonusEntry)) {
                const unitType = variant.unit_type || 'flat';
                const tierBadge = variant._tierBadgeLabel ?? null;
                const bucketKey = `${unitType}:${tierBadge ?? ''}`;
                const value = this._resolveBonusValueForSourceMode(src, variant, sourceMode);
                if (!buckets.has(bucketKey)) {
                    buckets.set(bucketKey, {
                        unitType,
                        tierBadge,
                        bonusEntries: [],
                        selectedTierBadges: this._maxPanelSelectedTierBadges(src, tab, instanceIndex),
                        value: 0,
                        percentStages: {}
                    });
                }
                const bucket = buckets.get(bucketKey);
                bucket.bonusEntries.push(variant);
                bucket.value += value;
                const stageId = this._compoundPercentStageId(variant, ids, compoundRule);
                if (stageId) bucket.percentStages[stageId] = (bucket.percentStages[stageId] ?? 0) + value;
            }
        }

        return [...buckets.values()].map(bucket => {
            const primaryBonus = bucket.bonusEntries[0] ?? { bonus: this.selectedBonus, unit_type: bucket.unitType };
            return {
                src,
                ...primaryBonus,
                bonus: {
                    ...primaryBonus,
                    _groupBonuses: bucket.bonusEntries
                },
                selectedTierBadges: bucket.selectedTierBadges,
                _instanceIndex: instanceIndex,
                instance_value: bucket.value,
                value: bucket.value,
                percentStages: bucket.unitType === 'percent' ? { ...bucket.percentStages } : null,
                unit_type: bucket.unitType,
                mult: 1,
                display_mult: 1,
                _key: `${src.id}:${bucket.unitType}:${bucket.tierBadge ?? ''}${instanceIndex != null ? `:i${Number(instanceIndex) + 1}` : ''}`
            };
        });
    },

    _maxPanelBuildSourceItems(src, sourceMode, count = 1, tab = this.maxTab) {
        if (this.maxPanelSourceUsesPerInstanceRows(src)) {
            const rows = [];
            for (const instanceId of this._maxPanelNormalizedInstanceIds(src.id, count, tab)) {
                const instanceSrc = this.maxPanelTierEditSource(src, tab, instanceId);
                rows.push(...this._maxPanelBuildSourceInstanceItems(instanceSrc, sourceMode, tab, instanceId));
            }
            return rows;
        }

        const rows = this._maxPanelBuildSourceInstanceItems(this.maxPanelTierEditSource(src, tab, null), sourceMode, tab, null);
        return rows.map(item => ({
            ...item,
            value: item.unit_type === 'multiplier' ? Math.pow(item.value, count) : item.value,
            mult: item.unit_type === 'multiplier' ? 1 : count,
            display_mult: count
        }));
    },

    _applyMaxPanelEdits(items, tab, sourceMode) {
        const state = this._maxPanelEditState(tab);
        if (!Object.keys(state.counts ?? {}).length
            && !Object.keys(state.tiers ?? {}).length
            && !Object.keys(state.instances ?? {}).length) {
            return items;
        }
        const counts = new Map();
        const sourceItems = new Map();
        const touchedSourceIds = new Set([
            ...Object.keys(state.counts ?? {}),
            ...this._maxPanelTierSourceIds(tab),
            ...Object.keys(state.instances ?? {})
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
            const count = Math.max(0, (counts.get(sourceId) ?? 0) + Number(state.counts?.[sourceId] ?? 0));
            if (count <= 0) continue;
            const src = this.maxPanelEditSource(itemGroup[0]?.src ?? { id: sourceId }, tab);
            nextItems.push(...this._maxPanelBuildSourceItems(src, sourceMode, count, tab));
        }

        for (const sourceId of Object.keys(state.counts ?? {})) {
            if (sourceItems.has(sourceId)) continue;
            const count = Math.max(0, Number(state.counts?.[sourceId] ?? 0));
            if (count <= 0) continue;
            const src = this.maxPanelEditSource(this._maxPanelSourceById(tab, sourceId) ?? { id: sourceId }, tab);
            nextItems.push(...this._maxPanelBuildSourceItems(src, sourceMode, count, tab));
        }

        return nextItems;
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
                        matchingBonuses.map(b => ({
                            ...b,
                            value: this._resolveBonusValueForSourceMode(src, b, sourceMode)
                        })),
                        optimizerBucket
                    );
                }
                continue;
            }

            for (const b of matchingBonuses) {
                const value = this._resolveBonusValueForSourceMode(src, b, sourceMode);
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

    _resolveBonusValueForSourceMode(src, bonusEntry, sourceMode = 'live') {
        return sourceMode === 'actual'
            ? this.resolveActualSourceBonusValue(src, bonusEntry)
            : this.resolveSourceBonusValue(src, bonusEntry);
    },

    _compoundTotal(items) {
        return compoundTotalFromItems(items, this._compoundRuleForBonus());
    },

    /* -- Slot routing / optimizer -- */

    _routeSlottedItem(src, bonuses, optimizerBucket) {
        const list = (src.size ?? 1) > 1 || (src.max ?? Infinity) === 1 ? optimizerBucket.exclusive : optimizerBucket.stackable;
        const variants = bonuses.reduce((sets, bonusEntry) => {
            const bonusVariants = this._activeDisplayBonusVariants(src, bonusEntry);
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
                    instance_value: val,
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
