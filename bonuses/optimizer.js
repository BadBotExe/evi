export function optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals = {}) {
    const base = {
        flat:       currentTotals.flat       ?? 0,
        percent:    currentTotals.percent    ?? 0,
        multiplier: currentTotals.multiplier ?? 1,
    };

    const maxContainerSize = Math.max(...containers.map(c => c.slots));

    // Keep exclusives that either contribute to the bonus, or are small enough
    // that leftover slots could still be filled profitably with stackables
    const validExclusives = exclusiveItems.filter(item => {
        const contrib = getContrib(item, bonusId);
        if (contrib.flat || contrib.percent || contrib.multiplier) return true;
        return item.size < maxContainerSize;
    });

    const validStackables = stackableItems.filter(s => {
        const contrib = getContrib(s, bonusId);
        return contrib.flat || contrib.percent || contrib.multiplier;
    });

    const bestResult = { assignment: null, total: -Infinity };

    // Expand each exclusive by how many times it could appear across containers
    // e.g. a runeword with max:1 appears once, a rune with max:3 appears three times
    // This lets getCombinations treat duplicates as distinct placements
    const expandedExclusives = validExclusives.flatMap(item =>
        Array(item.max ?? containers.length).fill(item)
    );

    const totalSlots = containers.reduce((sum, c) => sum + c.slots, 0);

    // Cap combo size: if there are stackables, we only need to try placing
    // floor(totalSlots / minSize) exclusives at most before stackables fill the rest.
    // If no stackables, cap at number of containers (one exclusive per container max).
    const hasNonExclusive = expandedExclusives.some(i => !i.exclusive);
    const maxItems = hasNonExclusive
        ? Math.floor(totalSlots / Math.min(...expandedExclusives.map(i => i.size ?? 1)))
        : containers.length;

    // Try every combination of exclusives up to maxItems,
    // then greedily fill remaining slots with stackables
    const combos = getCombinations(expandedExclusives, Math.min(expandedExclusives.length, maxItems));

    const t0 = performance.now();
    let pass = 0;

    for (const combo of combos) {
        pass++;
        const result = tryAssignment(containers, combo, validStackables, bonusId, base);
        if (result.total > bestResult.total) {
            bestResult.total = result.total;
            bestResult.assignment = result.assignment;
        }
    }

    console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms — ${pass} passes for ${bonusId}`);

    return bestResult;
}

function tryAssignment(containers, exclusiveCombo, stackableItems, bonusId, base) {
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base };

    // Place exclusives largest-first to maximize chances of them fitting
    const sorted = [...exclusiveCombo].sort((a, b) => b.size - a.size);
    for (const item of sorted) {
        const container = slots.find(c =>
            c.remaining >= item.size &&
            (!item.exclusive || c.items.filter(i => i.exclusive).length < c.maxExclusive)
        );
        if (!container) return { total: -Infinity, assignment: null };
        container.items.push({ ...item, _exclusive: true });
        container.remaining -= item.size;

        const contrib = getContrib(item, bonusId);
        totals.flat    += contrib.flat;
        totals.percent += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    // After placing exclusives, greedily fill remaining slots with stackables.
    // Each iteration re-scores by marginal value so that as totals grow,
    // the relative value of flat vs percent vs multiplier stays accurate.
    const totalFree = slots.reduce((sum, c) => sum + c.remaining, 0);
    const excludedIds = new Set(exclusiveCombo.flatMap(i => i.constraint?.excludes ?? []));
    const placedExclusiveIds = new Set(exclusiveCombo.map(i => i.id));
    const filteredStackables = stackableItems.filter(s => {
        if (excludedIds.has(s.id)) return false;
        if ((s.constraint?.excludes ?? []).some(id => placedExclusiveIds.has(id))) return false;
        return true;
    });

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

    return { total: computeFinal(totals), assignment: slots };
}

function marginalValue(contrib, totals) {
    const { flat, percent, multiplier } = totals;
    if (flat === 0) {
        if (contrib.flat)           return contrib.flat * (1 + percent / 100) * multiplier;
        if (contrib.percent)        return contrib.percent * multiplier;
        if (contrib.multiplier > 0) return contrib.multiplier;
    }
    return (
        contrib.flat    * (1 + percent / 100) * multiplier +
        contrib.percent * flat * 0.01 * multiplier +
        (contrib.multiplier > 0
            ? (multiplier * contrib.multiplier - multiplier) * flat * (1 + percent / 100)
            : 0)
    );
}

function computeFinal({ flat, percent, multiplier }) {
    if (flat === 0 && percent > 0) return percent * multiplier;
    return flat * (1 + percent / 100) * multiplier;
}

function getContrib(item, bonusId) {
    const contrib = { flat: 0, percent: 0, multiplier: 0 };
    const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
    for (const b of item.bonuses ?? []) {
        if (!ids.includes(b.bonus)) continue;
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