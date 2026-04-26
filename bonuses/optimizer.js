/**
 * Generic slot optimizer with marginal value scoring.
 *
 * @param {Array}  containers      - [{ id, slots, maxExclusive }]
 * @param {Array}  exclusiveItems  - [{ id, name, size, bonuses }]
 * @param {Array}  stackableItems  - [{ id, name, size: 1, bonuses }]
 * @param {string} bonusId         - bonus to maximize
 * @param {Object} currentTotals   - { flat, percent, multiplier } from other sources
 * @returns {{ assignment, total }}
 */
export function optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals = {}) {
    const base = {
        flat:       currentTotals.flat       ?? 0,
        percent:    currentTotals.percent    ?? 0,
        multiplier: currentTotals.multiplier ?? 1,
    };

    // pre-filter exclusives — keep if contributes to bonus OR small enough
    // that remaining slots could be filled with stackables profitably
    const maxContainerSize = Math.max(...containers.map(c => c.slots));
    const validExclusives = exclusiveItems.filter(item => {
        const contrib = getContrib(item, bonusId);
        if (contrib.flat || contrib.percent || contrib.multiplier) return true;
        return item.size < maxContainerSize;
    });

    // pre-filter stackables — only those contributing to bonus
    const validStackables = stackableItems.filter(s => {
        const contrib = getContrib(s, bonusId);
        return contrib.flat || contrib.percent || contrib.multiplier;
    });

    console.log(`[optimizer] exclusives: ${exclusiveItems.length} → ${validExclusives.length}, stackables: ${stackableItems.length} → ${validStackables.length}`);

    const bestResult = { assignment: null, total: -Infinity };
    const combos = getCombinations(validExclusives, containers.length);

    console.log(`[optimizer] combinations to try: ${combos.length}`);

    const t0 = performance.now();
    let pass = 0;

    for (const combo of combos) {
        pass++;
        const result = tryAssignment(containers, combo, validStackables, bonusId, base);
        if (result.total > bestResult.total) {
            bestResult.total = result.total;
            bestResult.assignment = result.assignment;
            console.log(`[optimizer] pass ${pass}/${combos.length} — new best: ${result.total} with ${combo.map(i => i.name).join(', ') || 'no exclusives'}`);
        }
    }

    console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms — ${pass} passes`);

    return bestResult;
}

function tryAssignment(containers, exclusiveCombo, stackableItems, bonusId, base) {
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));

    // running totals — start from base, add exclusive contributions
    const totals = { ...base };

    // fit exclusives largest first
    const sorted = [...exclusiveCombo].sort((a, b) => b.size - a.size);
    for (const item of sorted) {
        const container = slots.find(c =>
            c.remaining >= item.size &&
            c.items.filter(i => i._exclusive).length < c.maxExclusive
        );
        if (!container) return { total: -Infinity, assignment: null };
        container.items.push({ ...item, _exclusive: true });
        container.remaining -= item.size;

        // update running totals with this exclusive's contribution
        const contrib = getContrib(item, bonusId);
        totals.flat    += contrib.flat;
        totals.percent += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    // score each stackable by marginal value given current totals
    const totalFree = slots.reduce((sum, c) => sum + c.remaining, 0);
    const excludedIds = new Set(exclusiveCombo.flatMap(i => i.constraint?.excludes ?? []));
    const placedExclusiveIds = new Set(exclusiveCombo.map(i => i.id));
    const filteredStackables = stackableItems.filter(s => {
        if (excludedIds.has(s.id)) return false;
        if ((s.constraint?.excludes ?? []).some(id => placedExclusiveIds.has(id))) return false;
        return true;
    });
    console.log('[optimizer] excludedIds:', [...excludedIds], 'filteredStackables:', filteredStackables.map(s => s.name));

    const placedCounts = {};
    for (let i = 0; i < totalFree; i++) {
        const best = filteredStackables
            .map(s => ({ ...s, _marginal: marginalValue(getContrib(s, bonusId), totals) }))
            .filter(s => s._marginal > 0)
            .filter(s => !s.max || (placedCounts[s.id] ?? 0) < s.max)
            .sort((a, b) => b._marginal - a._marginal)[0];

        if (!best) break;

        placedCounts[best.id] = (placedCounts[best.id] ?? 0) + 1;

        const container = slots.find(c => c.remaining >= 1);
        if (!container) break;

        container.items.push(best);
        container.remaining -= 1;

        const contrib = getContrib(best, bonusId);
        totals.flat    += contrib.flat;
        totals.percent += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    const total = computeFinal(totals);

    return { total, assignment: slots };
}

/**
 * Marginal value of adding one item's contribution to current totals.
 * final = flat * (1 + percent/100) * multiplier
 *
 * d(final)/d(flat)       = (1 + percent/100) * multiplier
 * d(final)/d(percent)    = flat * 0.01 * multiplier
 * d(final)/d(multiplier) = flat * (1 + percent/100)
 */
function marginalValue(contrib, totals) {
    const { flat, percent, multiplier } = totals;
    return (
        contrib.flat    * (1 + percent / 100) * multiplier +
        contrib.percent * flat * 0.01 * multiplier +
        (contrib.multiplier > 0
            ? (multiplier * contrib.multiplier - multiplier) * flat * (1 + percent / 100)
            : 0)
    );
}

function computeFinal({ flat, percent, multiplier }) {
    return flat * (1 + percent / 100) * multiplier;
}

/**
 * Extract flat/percent/multiplier contributions for a given bonusId.
 */
function getContrib(item, bonusId) {
    const contrib = { flat: 0, percent: 0, multiplier: 0 };
    for (const b of item.bonuses ?? []) {
        if (b.bonus !== bonusId) continue;
        const ut = b.unit_type ?? 'flat';
        contrib[ut] = (contrib[ut] ?? 0) + (b.value ?? 0);
    }
    return contrib;
}

function getCombinations(items, maxSize) {
    const results = [[]];
    for (let size = 1; size <= maxSize; size++) {
        for (const combo of combine(items, size)) {
            results.push(combo);
        }
    }
    return results;
}

function combine(items, size) {
    if (size === 0) return [[]];
    if (items.length < size) return [];
    const [first, ...rest] = items;
    return [
        ...combine(rest, size - 1).map(c => [first, ...c]),
        ...combine(rest, size)
    ];
}