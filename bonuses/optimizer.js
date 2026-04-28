export function optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals = {}) {
    const base = {
        flat:       currentTotals.flat       ?? 0,
        percent:    currentTotals.percent    ?? 0,
        multiplier: currentTotals.multiplier ?? 1,
    };

    const maxContainerSize = Math.max(...containers.map(c => c.slots));

    const validExclusives = exclusiveItems.filter(item => {
        const contrib = getContrib(item, bonusId);
        if (contrib.flat || contrib.percent || contrib.multiplier) return true;
        return (item.size ?? 1) < maxContainerSize;
    });

    const validStackables = stackableItems.filter(s => {
        const contrib = getContrib(s, bonusId);
        return contrib.flat || contrib.percent || contrib.multiplier;
    });

    // ── FAST PATH ──────────────────────────────────────────────────────────────
    // If no exclusive takes more than 1 slot and none has constraints between
    // each other, placement order doesn't matter — just sort by value desc and
    // greedily pick the best ones that fit. O(n log n) instead of O(2^n).
    if (canUseFastPath(validExclusives, containers)) {
        return fastPathAssign(containers, validExclusives, validStackables, bonusId, base);
    }

    // ── FULL COMBINATORIAL PATH ────────────────────────────────────────────────
    // Split exclusives and containers by slot_type and optimize each independently,
    // then merge. Curios and runes can never share slots so combining them
    // in one combinatorial search is pure waste.
    const slotTypes = [...new Set(validExclusives.map(i => i.slot))];

    const t0 = performance.now();
    let totalPasses = 0;
    const allSlots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base };

    for (const slotType of slotTypes) {
        const slotContainers = containers.filter(c => c.slot_type === slotType);
        const slotExclusives = validExclusives.filter(i => i.slot === slotType);
        const slotStackables = validStackables.filter(s => s.slot === slotType);

        if (canUseFastPath(slotExclusives, slotContainers)) {
            const result = fastPathAssign(slotContainers, slotExclusives, slotStackables, bonusId, totals);
            for (const rc of result.assignment) {
                const ac = allSlots.find(c => c.id === rc.id);
                if (ac) { ac.items = rc.items; ac.remaining = rc.remaining; }
            }
            const contrib = getContribFromSlots(result.assignment, bonusId);
            totals.flat      += contrib.flat;
            totals.percent   += contrib.percent;
            if (contrib.multiplier !== 1) totals.multiplier *= contrib.multiplier;
        } else {
            const expandedExclusives = slotExclusives.flatMap(item => {
                const maxCount = item.max ?? slotContainers.length;
                return Array(maxCount).fill(item);
            });
            const maxItems = slotContainers.length;
            const combos = getCombinations(expandedExclusives, Math.min(expandedExclusives.length, maxItems));

            let bestResult = { assignment: null, total: -Infinity };
            for (const combo of combos) {
                totalPasses++;
                const result = tryAssignment(slotContainers, combo, slotStackables, bonusId, totals);
                if (result.total > bestResult.total) bestResult = result;
            }

            if (bestResult.assignment) {
                for (const rc of bestResult.assignment) {
                    const ac = allSlots.find(c => c.id === rc.id);
                    if (ac) { ac.items = rc.items; ac.remaining = rc.remaining; }
                }
                const contrib = getContribFromSlots(bestResult.assignment, bonusId);
                totals.flat      += contrib.flat;
                totals.percent   += contrib.percent;
                if (contrib.multiplier !== 1) totals.multiplier *= contrib.multiplier;
            }
        }
    }

    console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms — ${totalPasses} full-combo passes for ${bonusId}`);
    return { assignment: allSlots, total: computeFinal(totals) };
}

// ── FAST PATH HELPERS ──────────────────────────────────────────────────────────

/**
 * Fast path is valid when:
 *  - Every exclusive fits in a single slot (size <= 1)
 *  - No item has a constraint.excludes that references another exclusive in the list
 *
 * Under these conditions, slot assignment is independent: the best combo is
 * simply the top-N items by marginal value, one per container.
 */
function canUseFastPath(exclusives, containers) {
    const ids = new Set(exclusives.map(i => i.id));
    for (const item of exclusives) {
        if ((item.size ?? 1) > 1) return false;
        if ((item.constraint?.excludes ?? []).some(id => ids.has(id))) return false;
    }
    return true;
}

function fastPathAssign(containers, exclusives, stackables, bonusId, base) {
    const t0 = performance.now();

    // Group containers by slot_type and count available exclusive slots per type
    const slotsAvailable = {};   // slot_type → number of containers
    for (const c of containers) {
        slotsAvailable[c.slot_type] = (slotsAvailable[c.slot_type] ?? 0) + c.maxExclusive;
    }

    // Sort exclusives by marginal value descending, then greedily pick
    const totals = { ...base };
    const chosen = [];   // { item, slot_type }
    const used = {};     // slot_type → count placed

    const sorted = [...exclusives]
        .map(item => ({ item, mv: marginalValue(getContrib(item, bonusId), totals) }))
        .filter(x => x.mv > 0)
        .sort((a, b) => b.mv - a.mv);

    // We need to re-score after each pick (multiplier changes marginals)
    // Use an insertion-sort style greedy: pick best, update totals, repeat
    const remaining = sorted.map(x => x.item);

    while (remaining.length) {
        // Find best marginal from remaining
        let bestIdx = -1, bestMv = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const item = remaining[i];
            const slotType = item.slot;
            if ((used[slotType] ?? 0) >= (slotsAvailable[slotType] ?? 0)) continue;
            const mv = marginalValue(getContrib(item, bonusId), totals);
            if (mv > bestMv) { bestMv = mv; bestIdx = i; }
        }
        if (bestIdx === -1 || bestMv <= 0) break;

        const item = remaining.splice(bestIdx, 1)[0];
        used[item.slot] = (used[item.slot] ?? 0) + 1;
        chosen.push(item);

        const contrib = getContrib(item, bonusId);
        totals.flat      += contrib.flat;
        totals.percent   += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    // Build a slot assignment from chosen items
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    for (const item of chosen) {
        const container = slots.find(c => c.slot_type === item.slot && c.items.filter(i => i.exclusive).length < c.maxExclusive);
        if (container) {
            container.items.push(item);
            container.remaining -= 1;
        }
    }

    // Fill remaining space with stackables
    const placedExclusiveIds = new Set(chosen.map(i => i.id));
    const excludedIds = new Set(chosen.flatMap(i => i.constraint?.excludes ?? []));
    const filteredStackables = stackables.filter(s => {
        if (excludedIds.has(s.id)) return false;
        if ((s.constraint?.excludes ?? []).some(id => placedExclusiveIds.has(id))) return false;
        return true;
    });

    const totalFree = slots.reduce((sum, c) => sum + c.remaining, 0);
    const placedCounts = {};
    for (let i = 0; i < totalFree; i++) {
        const best = filteredStackables
            .map(s => ({ ...s, _marginal: marginalValue(getContrib(s, bonusId), totals) }))
            .filter(s => s._marginal > 0)
            .filter(s => !s.max || (placedCounts[s.id] ?? 0) < s.max)
            .sort((a, b) => b._marginal - a._marginal)[0];

        if (!best) break;

        const container = slots.find(c => c.slot_type === best.slot && c.remaining >= 1);
        if (!container) break;

        placedCounts[best.id] = (placedCounts[best.id] ?? 0) + 1;
        container.items.push(best);
        container.remaining -= 1;

        const contrib = getContrib(best, bonusId);
        totals.flat    += contrib.flat;
        totals.percent += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    console.log(`[optimizer] fast-path done in ${(performance.now() - t0).toFixed(2)}ms — ${chosen.length} exclusives placed for ${bonusId}`);
    return { assignment: slots, total: computeFinal(totals) };
}

function getContribFromSlots(slots, bonusId) {
    const contrib = { flat: 0, percent: 0, multiplier: 1 };
    for (const slot of slots) {
        for (const item of slot.items) {
            const c = getContrib(item, bonusId);
            contrib.flat      += c.flat;
            contrib.percent   += c.percent;
            if (c.multiplier) contrib.multiplier *= c.multiplier;
        }
    }
    return contrib;
}

// ── SHARED HELPERS ─────────────────────────────────────────────────────────────

function tryAssignment(containers, exclusiveCombo, stackableItems, bonusId, base) {
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base };

    for (const item of [...exclusiveCombo].sort((a, b) => (b.size ?? 1) - (a.size ?? 1))) {
        const container = slots.find(c =>
            c.slot_type === item.slot &&
            c.remaining >= (item.size ?? 1) &&
            c.items.filter(i => i.exclusive).length < c.maxExclusive
        );
        if (!container) return { total: -Infinity, assignment: null };
        container.items.push(item);
        container.remaining -= (item.size ?? 1);

        const contrib = getContrib(item, bonusId);
        totals.flat    += contrib.flat;
        totals.percent += contrib.percent;
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

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

        const container = slots.find(c => c.slot_type === best.slot && c.remaining >= 1);
        if (!container) break;

        placedCounts[best.id] = (placedCounts[best.id] ?? 0) + 1;
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