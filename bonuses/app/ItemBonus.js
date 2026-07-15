import { formatVal, formatValFixed, sharedDisplayDecimals } from '../lib/utils.js?v=a60e1a39f6';

/**
 * Item bonus display mixin.
 * Handles formatting of bonus values shown in item popovers and the item
 * browser, including scaled bonuses, formula ranges, and tier meta rows.
 */
export const itemBonusMethods = {
    itemBonusGroups(src, ascensionOnly = false) {
        const visible = (src.bonuses ?? []).filter(b => !!b._is_ascension === ascensionOnly);
        const grouped = [];
        const byKey = new Map();

        for (const b of visible) {
            const key = `${b.bonus}:${b._is_ascension ? 1 : 0}:${b.format === 'plain' ? grouped.length : 'value'}`;
            if (!byKey.has(key)) {
                const first = { ...b, _groupBonuses: [b] };
                byKey.set(key, first);
                grouped.push(first);
            } else {
                byKey.get(key)._groupBonuses.push(b);
            }
        }

        return grouped;
    },

    itemBonusRange(src, bonus) {
        if (bonus?._petTierUnitTypeVariant) {
            const value = this._resolveValue(bonus);
            return value == null ? null : { min: value, max: value };
        }
        const matrix = this._getTierMatrix(src, bonus, bonus.bonus);
        const rows = matrix?.flatMap(collection => collection.rows) ?? this._getTierRows(src, bonus, bonus.bonus);
        if (!rows?.length) {
            const value = this._resolveValue(bonus);
            return value == null ? null : { min: value, max: value };
        }
        const values = rows
            .map(row => row?.[bonus.bonus])
            .filter(value => value != null);
        if (!values.length) return null;
        return {
            min: Math.min(...values),
            max: Math.max(...values)
        };
    },

    _itemBonusDisplayRows(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        const rows = [];

        for (const entry of group) {
            if (entry.format === 'plain') continue;
            for (const variant of this._displayBonusVariants(src, entry)) {
                const range = this.itemBonusRange(src, variant);
                if (!range) continue;
                rows.push({
                    unitType: variant.unit_type || 'flat',
                    min: range.min,
                    max: range.max,
                    tierBadge: variant._tierBadgeLabel ?? null,
                    bonusId: variant.bonus
                });
            }
        }

        return rows;
    },

    formatBonusValueRange(bonusId, unitType, min, max) {
        const ut = unitType || 'flat';
        const maxDecimals = this.bonusDisplayDecimals(bonusId, ut);
        const decimals = sharedDisplayDecimals([min, max], maxDecimals);
        const unit = this.unitFor(bonusId, ut);
        const from = formatValFixed(min, unit, ut, decimals);
        const to = formatValFixed(max, unit, ut, decimals);
        return from === to ? from : `${from} -> ${to}`;
    },

    itemBonusHasDetails(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        return group.some(entry =>
            !!this._getTierRows(src, entry, entry.bonus) ||
            !!this._getTierMatrix(src, entry, entry.bonus)
        );
    },

    itemBonusUsesFormula(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        return this.viewMode === 'item' && group.some(entry => entry.format !== 'plain' && !!entry.scales_with);
    },

    itemBonusDisplay(src, bonus) {
        const group = bonus._groupBonuses ?? [bonus];
        const icon = group.find(entry => entry.icon)?.icon ?? null;
        if (group.length === 1 && group[0].format === 'plain') {
            return { text: group[0].value, rows: null, flat: null, percent: null, multiplier: null, icon };
        }

        if (this.viewMode === 'item') {
            const valueRows = group
                .filter(entry => entry.format !== 'plain')
                .flatMap(entry => this._displayBonusVariants(src, entry).map(variant => {
                    if (variant.scales_with) return this._formatScaledBonusRangeRow(src, variant);
                    if (variant._petTierUnitTypeVariant) {
                        const text = this.formatBonusValue(this._resolveValue(variant), variant.bonus, variant.unit_type || 'flat', variant.display_decimals);
                        if (!variant._tierBadgeLabel) return { text };
                        return {
                            text: `${variant._tierBadgeLabel} ${text}`,
                            html: `<span class="tag tag-tier">${this._escapeHtml(variant._tierBadgeLabel)}</span> ${this._escapeHtml(text)}`
                        };
                    }
                    return { text: this._formatItemFormulaValueRange(src, variant) };
                }))
                .filter(row => row && row.text);

            return {
                text: valueRows.length ? null : '-',
                rows: valueRows.length ? valueRows : null,
                metaRows: null,
                flat: null,
                percent: null,
                multiplier: null,
                icon
            };
        }

        const aggregatedRows = new Map();
        for (const row of this._itemBonusDisplayRows(src, bonus)) {
            const key = `${row.unitType}:${row.tierBadge ?? ''}`;
            if (!aggregatedRows.has(key)) {
                aggregatedRows.set(key, {
                    unitType: row.unitType,
                    tierBadge: row.tierBadge,
                    min: row.unitType === 'multiplier' ? 1 : 0,
                    max: row.unitType === 'multiplier' ? 1 : 0,
                    bonusId: row.bonusId
                });
            }
            const bucket = aggregatedRows.get(key);
            if (row.unitType === 'multiplier') {
                bucket.min *= row.min;
                bucket.max *= row.max;
            } else {
                bucket.min += row.min;
                bucket.max += row.max;
            }
        }

        const rows = [...aggregatedRows.values()].map(row => {
            const text = this.formatBonusValueRange(row.bonusId, row.unitType, row.min, row.max);
            if (!row.tierBadge) return text;
            return {
                text: `${row.tierBadge} ${text}`,
                html: `<span class="tag tag-tier">${this._escapeHtml(row.tierBadge)}</span> ${this._escapeHtml(text)}`
            };
        });

        const metaRows = group
            .filter(entry => entry.format !== 'plain')
            .flatMap(entry => this._formatItemFormulaRows(src, entry).slice(1))
            .filter(Boolean);

        return {
            text: typeof rows[0] === 'string' ? (rows[0] ?? '-') : (rows[0]?.text ?? '-'),
            rows: rows.length ? rows : null,
            metaRows: metaRows.length ? metaRows : null,
            flat: null,
            percent: null,
            multiplier: null,
            icon
        };
    },

    openItemBonusTiers(src, bonus, event) {
        if (!this.itemBonusHasDetails(src, bonus)) return;
        this.openTierPopover({ src, bonuses: bonus._groupBonuses ?? [bonus] }, event, false);
    },

    /* -- Scaled bonus formatting -- */

    _scaleMeta(val, scalesWith, scaleFormula = null) {
        const param = this.parameters?.find(p => p.id === scalesWith);
        if (!param) return null;

        const baseVal = Number(val ?? 0);
        if (scaleFormula?.type === 'param_over_base_minus_value') {
            const operand = Number(scaleFormula.base ?? 0) - baseVal;
            const total = operand === 0 ? 0 : param.value / operand;
            return { param, operand, operator: '/', total };
        }

        return { param, operand: baseVal, operator: '*', total: param.value * baseVal };
    },

    _scaleNumberDecimals(value) {
        const s = this.normalizeValue(Number(value ?? 0)).toString().split('.')[1] ?? '';
        return s.length;
    },

    _formatScaleNumber(value, decimals = null) {
        const normalized = this.normalizeValue(Number(value ?? 0));
        if (decimals == null) return normalized.toLocaleString();
        return normalized.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    _formatPetScaleNumber(value, sharedDecimals = null) {
        const ownDecimals = this._scaleNumberDecimals(value);
        const decimals = sharedDecimals == null ? ownDecimals : sharedDecimals;
        return this._formatScaleNumber(value, decimals);
    },

    _formatScaledContext(meta, options = {}) {
        const { scaleFormulaType = null, decimals = null } = options;
        const paramLabel = meta.param.label ?? this.scalesLabel(meta.param.id);
        const operand = this._formatScaleNumber(meta.operand, decimals);

        if (scaleFormulaType === 'param_over_base_minus_value') {
            return `1 per ${operand} ${paramLabel}`;
        }

        return `${paramLabel} x ${operand}`;
    },

    _formatScaledContextHtml(meta, options = {}) {
        const { scaleFormulaType = null, decimals = null } = options;
        const paramLabel = this._escapeHtml(meta.param.label ?? this.scalesLabel(meta.param.id));
        const operand = this._escapeHtml(this._formatScaleNumber(meta.operand, decimals));

        if (scaleFormulaType === 'param_over_base_minus_value') {
            return `<span class="item-formula-context">1 per </span><span class="item-formula-value">${operand}</span><span class="item-formula-context"> ${paramLabel}</span>`;
        }

        return `<span class="item-formula-context">${paramLabel} x </span><span class="item-formula-value">${operand}</span>`;
    },

    _formatScaledBonus(bonusEntry, options = {}) {
        const {
            includeTotal = true,
            paramMode = 'value',
            bonusId = bonusEntry.bonus,
        } = options;
        const meta = this._scaleMeta(bonusEntry.value, bonusEntry.scales_with, bonusEntry.scale_formula);
        if (!meta) {
            const ut = bonusEntry.unit_type || 'flat';
            return this.formatBonusValue(this._resolveValue(bonusEntry), bonusId, ut, bonusEntry.display_decimals);
        }

        const expr = this._formatScaledContext(meta, {
            paramMode,
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
        });
        if (!includeTotal) return expr;

        const ut = bonusEntry.unit_type || 'flat';
        const total = this.formatBonusValue(meta.total, bonusId, ut, bonusEntry.display_decimals);
        return `${total} (${expr})`;
    },

    _formatScaledBonusHtml(bonusEntry, options = {}) {
        const { bonusId = bonusEntry.bonus } = options;
        const meta = this._scaleMeta(bonusEntry.value, bonusEntry.scales_with, bonusEntry.scale_formula);
        if (!meta) {
            const ut = bonusEntry.unit_type || 'flat';
            return this.formatBonusValue(this._resolveValue(bonusEntry), bonusId, ut, bonusEntry.display_decimals);
        }

        const ut = bonusEntry.unit_type || 'flat';
        const total = this.formatBonusValue(meta.total, bonusId, ut, bonusEntry.display_decimals);
        const context = this._formatScaledContext(meta, {
            paramMode: 'value',
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
        });
        return `<span class="src-val-main">${total}</span><span class="src-val-meta">${context}</span>`;
    },

    _scaledBonusFormulaValues(src, bonusEntry) {
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula || !['linear', 'base_percent', 'table'].includes(formula.type)) {
            const value = Number(bonusEntry.value ?? 0);
            return [value, value];
        }

        const startTier = bonusEntry.unlock_at_tier ?? 1;
        const first = this._applyFormula({ ...formula, max_tier: startTier }, startTier);
        const last = this._applyFormula(formula, startTier);
        return [first, last];
    },

    _formatScaledBonusRange(src, bonusEntry) {
        const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
        const firstExpr = this._formatScaledBonus({ ...bonusEntry, value: firstVal }, { includeTotal: false, paramMode: 'label' });
        const lastExpr = this._formatScaledBonus({ ...bonusEntry, value: lastVal }, { includeTotal: false, paramMode: 'label' });
        return firstExpr === lastExpr ? firstExpr : `${firstExpr} → ${lastExpr}`;
    },

    _formatScaledBonusRangeRow(src, bonusEntry) {
        const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
        const firstMeta = this._scaleMeta(firstVal, bonusEntry.scales_with, bonusEntry.scale_formula);
        if (!firstMeta) {
            const text = this._formatScaledBonusRange(src, bonusEntry);
            return text ? { text } : null;
        }

        const firstText = this._formatScaledBonus({ ...bonusEntry, value: firstVal }, { includeTotal: false, paramMode: 'label' });
        const firstHtml = this._formatScaledContextHtml(firstMeta, {
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
        });

        if (firstVal === lastVal) {
            return { text: firstText, html: firstHtml };
        }

        const lastMeta = this._scaleMeta(lastVal, bonusEntry.scales_with, bonusEntry.scale_formula);
        if (!lastMeta) return { text: firstText, html: firstHtml };

        const lastText = this._formatScaledBonus({ ...bonusEntry, value: lastVal }, { includeTotal: false, paramMode: 'label' });
        const lastHtml = this._formatScaledContextHtml(lastMeta, {
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
        });

        return {
            text: `${firstText} → ${lastText}`,
            html: `${firstHtml}<span class="item-formula-context"> &#x2192; </span>${lastHtml}`
        };
    },

    _formatItemFormulaValueRange(src, bonusEntry) {
        const formula = this._resolveFormula(src, bonusEntry);
        const ut = bonusEntry.unit_type || 'flat';

        if (formula && ['linear', 'base_percent'].includes(formula.type)) {
            const [firstVal, lastVal] = this._scaledBonusFormulaValues(src, bonusEntry);
            return this.formatBonusValueRange(bonusEntry.bonus, ut, firstVal, lastVal);
        }

        if (bonusEntry.value == null) return null;

        const value = this._resolveValue({ ...bonusEntry, scales_with: null, scale_formula: null });
        return this.formatBonusValue(value, bonusEntry.bonus, ut, bonusEntry.display_decimals);
    },

    _formatItemFormula(src, bonusEntry) {
        if (bonusEntry.format === 'plain') return bonusEntry.value ?? '-';
        if (bonusEntry.scales_with) return this._formatScaledBonusRange(src, bonusEntry);

        const ut = bonusEntry.unit_type || 'flat';
        const formula = this._resolveFormula(src, bonusEntry);

        if (!formula) {
            return this.formatBonusValue(this._resolveValue(bonusEntry), bonusEntry.bonus, ut, bonusEntry.display_decimals);
        }

        if (formula.type === 'linear') {
            const unit = this.unitFor(bonusEntry.bonus, ut);
            const coeff = formatVal(formula.coeff ?? 0, unit, ut);
            const step = formula.step ?? 1;
            const label = (formula.label_prefix || 'Tier').toLowerCase();
            const startTier = bonusEntry.unlock_at_tier ?? 1;
            const tierRange = startTier === formula.max_tier
                ? `${label} ${startTier}`
                : `${label}s ${startTier}-${formula.max_tier}`;

            if (step > 1) return `${coeff} every ${step} ${label}s (${tierRange})`;
            return `${coeff} per ${label} (${tierRange})`;
        }

        if (formula.type === 'base_percent') {
            const percent = this.normalizeValue(Number(formula.percent ?? formula.coeff ?? 0), 2);
            const step = formula.step ?? 1;
            const label = (formula.label_prefix || 'Tier').toLowerCase();
            const startTier = bonusEntry.unlock_at_tier ?? 1;
            const tierRange = startTier === formula.max_tier
                ? `${label} ${startTier}`
                : `${label}s ${startTier}-${formula.max_tier}`;
            const rounding = formula.rounding ?? 'none';
            const roundingLabel = rounding === 'none' ? null : `, ${rounding}ed`;

            if (step > 1) return `${percent}% of base every ${step} ${label}s (${tierRange}${roundingLabel ?? ''})`;
            return `${percent}% of base per ${label} (${tierRange}${roundingLabel ?? ''})`;
        }

        return this.formatBonusValue(this._resolveValue(bonusEntry), bonusEntry.bonus, ut, bonusEntry.display_decimals);
    },

    _formatItemFormulaRows(src, bonusEntry) {
        const rows = [];
        const valueRange = this._formatItemFormulaValueRange(src, bonusEntry);
        if (valueRange) rows.push(valueRange);

        if (bonusEntry.scales_with) {
            const scaledRange = this._formatScaledBonusRange(src, bonusEntry);
            if (scaledRange && scaledRange !== valueRange) rows.push(scaledRange);
            return rows.length ? rows : [this._formatItemFormula(src, bonusEntry)];
        }

        if (rows.length) return rows;

        const fallback = this._formatItemFormula(src, bonusEntry);
        return fallback ? [fallback] : [];
    },

    /* -- Tier formula meta -- */

    _tierFormulaMetaDecimals(src, bonusEntry, tierRow) {
        if (tierRow?._petBase != null && tierRow?._petMultiplier != null) {
            return Math.max(
                this._scaleNumberDecimals(tierRow._petBase),
                this._scaleNumberDecimals(tierRow._petMultiplier)
            );
        }
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula || tierRow?._formulaValue == null) return 0;
        if (!bonusEntry.scales_with) return 0;

        const meta = this._scaleMeta(
            tierRow._formulaValue,
            bonusEntry.scales_with,
            bonusEntry.scale_formula
        );
        if (!meta) return 0;

        return this._scaleNumberDecimals(meta.operand);
    },

    _formatTierFormulaMeta(src, bonusEntry, tierRow, decimals = null) {
        if (tierRow?._petBase != null && tierRow?._petMultiplier != null) {
            const petDecimals = typeof decimals === 'object' && decimals !== null
                ? decimals
                : { base: decimals, multiplier: decimals };
            return `Base ${this._formatPetScaleNumber(tierRow._petBase, petDecimals.base)} x ${this._formatPetScaleNumber(tierRow._petMultiplier, petDecimals.multiplier)}`;
        }
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula || tierRow?._formulaValue == null) return null;
        if (!bonusEntry.scales_with) return null;

        const meta = this._scaleMeta(
            tierRow._formulaValue,
            bonusEntry.scales_with,
            bonusEntry.scale_formula
        );
        if (!meta) return null;

        return this._formatScaledContext(meta, {
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            decimals
        });
    },

    _formatTierFormulaMetaHtml(src, bonusEntry, tierRow, decimals = null) {
        if (tierRow?._petBase != null && tierRow?._petMultiplier != null) {
            const petDecimals = typeof decimals === 'object' && decimals !== null
                ? decimals
                : { base: decimals, multiplier: decimals };
            const base = this._escapeHtml(this._formatPetScaleNumber(tierRow._petBase, petDecimals.base));
            const multiplier = this._escapeHtml(this._formatPetScaleNumber(tierRow._petMultiplier, petDecimals.multiplier));
            return `<span class="item-formula-context">Base </span><span class="item-formula-value">${base}</span><span class="item-formula-context"> x </span><span class="item-formula-value">${multiplier}</span>`;
        }
        const formula = this._resolveFormula(src, bonusEntry);
        if (!formula || tierRow?._formulaValue == null) return null;
        if (!bonusEntry.scales_with) return null;

        const meta = this._scaleMeta(
            tierRow._formulaValue,
            bonusEntry.scales_with,
            bonusEntry.scale_formula
        );
        if (!meta) return null;

        return this._formatScaledContextHtml(meta, {
            scaleFormulaType: bonusEntry.scale_formula?.type ?? null,
            decimals
        });
    },

    /* -- Item popover bonus display -- */

    popoverBonuses(src) {
        const visible = (src.bonuses ?? []).filter(b => this.resolveBonusPopover(src, b) !== false);
        const grouped = [];
        const byKey = new Map();

        for (const b of visible) {
            const isPlain = b.format === 'plain';
            const key = isPlain
                ? `${b.bonus}:plain:${grouped.length}`
                : `${b.bonus}:${b._is_ascension ? 1 : 0}`;

            if (!byKey.has(key)) {
                const first = { ...b, _groupBonuses: [b] };
                byKey.set(key, first);
                grouped.push(first);
            } else {
                byKey.get(key)._groupBonuses.push(b);
            }
        }

        for (const b of grouped) {
            b._display = this.itemPopoverBonusResult(src, b);
        }

        return grouped;
    },

    itemPopoverBonusResult(src, bonus) {
        return this.itemBonusDisplay(src, bonus);
    },

    resolveItemPopover(src) {
        const file = src._file_item_popover ?? null;
        const entity = src.item_popover ?? null;
        if (entity !== null) return entity;
        if (file !== null) return file;
        return true;
    },

    resolveBonusPopover(src, bonus) {
        const entity = this.resolveItemPopover(src);
        const bonusLevel = bonus.item_popover ?? null;
        if (bonusLevel !== null) return bonusLevel;
        return entity;
    },
};
