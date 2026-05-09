import { formatVal, formatValFixed, normalizeValue, unitFor } from '../utils.js?v=7e5a144c2d';

/**
 * Display helpers mixin.
 * Provides label lookups, color resolvers, unit formatters, and value
 * formatters that are consumed by both the main app and child components
 * via :app="appRef".
 */
export const displayMethods = {
    bonusLabel(id)     { return this.data?.bonus_types.find(b => b.id === id)?.label ?? id; },
    scalesLabel(id)    {
        const p = this.parameters.find(b => b.id === id);
        return p?.badge_label ?? p?.label ?? id;
    },
    classLabel(id)     { return this.data?.classes.find(c => c.id === id)?.label ?? id; },
    classColor(id)     { return this.data?.classes.find(c => c.id === id)?.color ?? '#6090c0'; },
    conditionLabel(id) { return this.data?.conditions?.find(c => c.id === id)?.label ?? id; },
    typeColor(type)    { return this.data?.types[type]?.tag_style?.color ?? '#888'; },
    slotMax(slotId)    { return this.data?.slot_types.find(s => s.id === slotId)?.max ?? 1; },
    slotLabel(slotId)  { return this.data?.slot_types.find(s => s.id === slotId)?.label ?? slotId; },
    slotColor(slotId)  { return this.data?.slot_types.find(s => s.id === slotId)?.color ?? '#888'; },
    categoryLabel(id)  { return this.data?.categories?.find(c => c.id === id)?.label ?? id; },
    categoryColor(id)  { return this.data?.categories?.find(c => c.id === id)?.color ?? '#888'; },
    unitFor(bonusId, unitType) { return unitFor(this.data?.bonus_types ?? [], bonusId, unitType); },
    formatVal(value, unit, unitType) { return formatVal(value, unit, unitType); },
    formatValFixed(value, unit, unitType, decimals) { return formatValFixed(value, unit, unitType, decimals); },
    normalizeValue(value, digits) { return normalizeValue(value, digits); },
    itemTypeLabel(type) { return this.data?.types?.[type]?.label ?? type; },

    bonusDisplayDecimals(bonusId, unitType = null, entries = null) {
        const sourceEntries = Array.isArray(entries)
            ? entries
            : Object.values(this.groupedSources ?? {}).flatMap(group => group.flatMap(entry => entry.bonuses ?? []));

        return sourceEntries.reduce((max, entry) => {
            if (!entry || entry.bonus !== bonusId) return max;
            if (unitType != null && (entry.unit_type || 'flat') !== unitType) return max;
            const decimals = Number(entry.display_decimals);
            if (!Number.isFinite(decimals) || decimals < 0) return max;
            return Math.max(max, Math.floor(decimals));
        }, 3);
    },

    formatBonusValue(value, bonusId, unitType = 'flat', decimals = null) {
        const ut = unitType || 'flat';
        const resolvedDecimals = decimals == null
            ? this.bonusDisplayDecimals(bonusId, ut)
            : Math.max(0, Math.floor(Number(decimals) || 0));
        return formatValFixed(value, this.unitFor(bonusId, ut), ut, resolvedDecimals);
    },

    sourceName(src) {
        return src?.name ?? '';
    },

    sourceSearchText(src) {
        return this.sourceName(src).toLowerCase();
    },

    paramLabel(id) {
        return this.parameters.find(p => p.id === id)?.label ?? id;
    },

    isParamMet(paramId, min) {
        const p = this.parameters.find(p => p.id === paramId);
        return p && p.value >= min;
    },

    formatTotal(result) {
        if (!result) return '—';
        let ut = result.unit_type || 'flat';

        if (result.value === 0 && this.selectedBonus) {
            const unitTypes = new Set();
            for (const entries of Object.values(this.groupedSources)) {
                for (const { bonuses } of entries) {
                    for (const b of bonuses) {
                        unitTypes.add(b.unit_type || 'flat');
                    }
                }
            }
            if (unitTypes.size === 1) ut = [...unitTypes][0];
        }

        const displayUnitType = result.isMixed ? 'flat' : ut;
        return this.formatBonusValue(result.value, this.selectedBonus, displayUnitType);
    },

    _displayBonusId(bonusId) {
        if (!this.selectedBonus) return bonusId;
        const ids = this._resolveBonusIds(this.selectedBonus);
        return ids.includes(bonusId) ? this.selectedBonus : bonusId;
    },

    entryValueHtml(entry, options = {}) {
        const { includeFormulaMeta = false } = options;
        const scaledParts = [];
        const sums = {};
        for (const b of entry.bonuses) {
            for (const variant of this._displayBonusVariants(entry.src, b)) {
                const bonusId = this._displayBonusId(variant.bonus);
                if (includeFormulaMeta && variant.scales_with) {
                    scaledParts.push(this._formatScaledBonusHtml(variant, { bonusId }));
                    continue;
                }
                const badgeKey = variant._tierBadgeLabel ? `:${variant._tierBadgeLabel}` : '';
                const key = bonusId + ':' + (variant.unit_type || 'flat') + badgeKey;
                if (!sums[key]) sums[key] = { sum: 0, decimals: null, bonusId, unitType: variant.unit_type || 'flat', badge: variant._tierBadgeLabel ?? null };
                sums[key].sum += this._resolveValue(variant);
                const decimals = Number(variant.display_decimals);
                if (Number.isFinite(decimals) && decimals >= 0) {
                    sums[key].decimals = Math.max(sums[key].decimals ?? 0, Math.floor(decimals));
                }
            }
        }
        const summedParts = Object.values(sums).map(meta => {
            const value = this.formatBonusValue(meta.sum, meta.bonusId, meta.unitType, meta.decimals);
            if (!meta.badge) return value;
            return `<span class="tag tag-tier">${meta.badge}</span> ${value}`;
        });
        return [...scaledParts, ...summedParts]
            .map(part => `<div class="src-val-line">${part}</div>`)
            .join('');
    },
};
