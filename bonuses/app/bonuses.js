import { formatVal, formatValExact, normalizeValue, sharedDisplayDecimals } from '../utils.js?v=7e5a144c2d';
import { optimize } from '../optimizer.js?v=82538a38d9';

/**
 * Bonus calculation mixin.
 * Handles resolving bonus values, applying formulas, generating tier rows,
 * running the optimizer, and computing compound totals.
 */
export const bonusMethods = {
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
        if (src.tiers) return src.tiers;
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula) return null;
        return this._generateTierRows(src, formula, bonusEntry, bonusId);
    },

    _resolveBonusIds(bonusId) {
        const parents = this.data.bonus_types
            .filter(bt => bt.aliases?.includes(bonusId))
            .map(bt => bt.id);
        return [bonusId, ...parents];
    },

    hasTiers(entry) {
        return entry.bonuses.some(b => !!this._getTierRows(entry.src, b, this.selectedBonus));
    },

    bonusHasTiers(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        return group.some(b => !!this._getTierRows(src, b, b.bonus));
    },

    _tierGroupLabel(baseLabel, bonusId, showBonusLabel) {
        if (!showBonusLabel) return baseLabel;
        return `${baseLabel} (${this.bonusLabel(bonusId)})`;
    },

    getTierGroups(entry) {
        const allTierRows = entry.bonuses
            .map(b => ({ b, rows: this._getTierRows(entry.src, b, b.bonus) }))
            .filter(x => x.rows);
        const showBonusLabel = new Set(allTierRows.map(({ b }) => b.bonus)).size > 1;

        const groups = allTierRows.map(({ b, rows }, gi) => {
            const baseLabel = allTierRows.length > 1 ? (b.label || 'Node ' + (gi + 1)) : null;
            const label = baseLabel ? this._tierGroupLabel(baseLabel, b.bonus, showBonusLabel) : null;
            const total = rows.length;

            const maxVisible = this.data.tier_preview_limit ?? 5;
            const headCount = maxVisible - 2;
            const indices =
                total <= maxVisible
                    ? rows.map((_, i) => i)
                    : [...Array(headCount).keys(), null, total - 1];

            const displayRows = indices.map(idx => {
                if (idx === null) return { isEllipsis: true };
                const tier = rows[idx];
                const ut = b.unit_type || 'flat';
                const tierVal = tier[b.bonus];
                return {
                    isEllipsis: false,
                    label: tier.label,
                    _tierRow: tier,
                    _rawVal: tierVal,
                    metaText: null,
                    metaHtml: null,
                    valHtml: null,
                    valText: '-'
                };
            });

            const maxDecimals = this.bonusDisplayDecimals(b.bonus, b.unit_type || 'flat', [b]);
            const decimals = sharedDisplayDecimals(
                displayRows.filter(r => !r.isEllipsis && r._rawVal != null).map(r => r._rawVal),
                maxDecimals
            );
            const ut = b.unit_type || 'flat';
            const unit = this.unitFor(b.bonus, ut);
            displayRows.forEach(r => {
                if (!r.isEllipsis && r._rawVal != null) {
                    r.valText = formatValExact(r._rawVal, unit, ut, decimals);
                    r.valHtml = this._escapeHtml(r.valText);
                }
            });
            const formulaDecimals = displayRows.reduce((max, r) => {
                if (r.isEllipsis || !r._tierRow) return max;
                return Math.max(max, this._tierFormulaMetaDecimals(entry.src, b, r._tierRow));
            }, 0);
            displayRows.forEach(r => {
                if (r.isEllipsis || !r._tierRow) return;
                r.metaText = this._formatTierFormulaMeta(entry.src, b, r._tierRow, formulaDecimals);
                r.metaHtml = this._formatTierFormulaMetaHtml(entry.src, b, r._tierRow, formulaDecimals);
            });
            if (this.viewMode === 'item') {
                displayRows.forEach(r => {
                    if (!r.isEllipsis && r.metaText) {
                        r.valText = r.metaText;
                        r.valHtml = r.metaHtml;
                        r.metaText = null;
                        r.metaHtml = null;
                    }
                });
            }
            const visualRowCount = displayRows.reduce((sum, row) => {
                if (row.isEllipsis) return sum + 1;
                return sum + (row.metaText ? 2 : 1);
            }, 0);
            return { label, rows: displayRows, visualRowCount, gridRowCount: Math.ceil(displayRows.length / 2) };
        });

        const useTwoCol = groups.some(group => group.visualRowCount >= this.tierPopoverColThreshold);
        return groups.map(group => ({ ...group, useTwoCol }));
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
        if (list.find(i => i.id === src.id)) return;
        list.push({
            ...src,
            bonuses: bonuses.map(b => ({ ...b }))
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
        const realSrc = this.data.sources.find(s => s.id === item.id);
        const contrib = this._getContribForBonus(item, this._resolveBonusIds(bonusId));
        return Object.entries(contrib)
            .filter(([, val]) => val)
            .map(([ut, val]) => ({
                src:          realSrc ?? { id: item.id, name: item.name, type: 'rune', available: true },
                bonus:        { bonus: bonusId, value: val, unit_type: ut },
                value:        ut === 'multiplier' ? Math.pow(val, count) : val,
                unit_type:    ut,
                mult:         ut === 'multiplier' ? 1 : count,
                display_mult: count,
                _key:         item.id + ':' + ut,
            }));
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
