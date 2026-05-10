export function optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals = {}) {
    const compoundRule = currentTotals.compoundRule ?? null;
    const base = {
        flat:       currentTotals.flat       ?? 0,
        percent:    currentTotals.percent    ?? 0,
        percentStages: clonePercentStages(currentTotals.percentStages),
        multiplier: currentTotals.multiplier ?? 1,
    };

    const maxContainerSize = Math.max(...containers.map(c => c.slots));

    const validExclusives = exclusiveItems.filter(item => {
        const contrib = getContrib(item, bonusId, compoundRule);
        if (contrib.flat || contrib.percent || contrib.multiplier) return true;
        return (item.size ?? 1) < maxContainerSize;
    });

    const validStackables = stackableItems.filter(s => {
        const contrib = getContrib(s, bonusId, compoundRule);
        return contrib.flat || contrib.percent || contrib.multiplier;
    });

    if (canUseFastPath(validExclusives, containers)) {
        return fastPathAssign(containers, validExclusives, validStackables, bonusId, base, compoundRule);
    }

    const slotTypes = [...new Set([
        ...validExclusives.map(i => i.slot),
        ...validStackables.map(i => i.slot),
    ])];

    const t0 = performance.now();
    let totalPasses = 0;
    const allSlots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base, percentStages: clonePercentStages(base.percentStages) };

    for (const slotType of slotTypes) {
        const slotContainers = containers.filter(c => c.slot_type === slotType);
        const slotExclusives = validExclusives.filter(i => i.slot === slotType);
        const slotStackables = validStackables.filter(s => s.slot === slotType);

        if (canUseFastPath(slotExclusives, slotContainers)) {
            const result = fastPathAssign(slotContainers, slotExclusives, slotStackables, bonusId, totals, compoundRule);
            for (const rc of result.assignment) {
                const ac = allSlots.find(c => c.id === rc.id);
                if (ac) { ac.items = rc.items; ac.remaining = rc.remaining; }
            }
            const contrib = getContribFromSlots(result.assignment, bonusId, compoundRule);
            totals.flat += contrib.flat;
            totals.percent += contrib.percent;
            mergePercentStages(totals.percentStages, contrib.percentStages);
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
                const result = tryAssignment(slotContainers, combo, slotStackables, bonusId, totals, compoundRule);
                if (result.total > bestResult.total) bestResult = result;
            }

            if (bestResult.assignment) {
                for (const rc of bestResult.assignment) {
                    const ac = allSlots.find(c => c.id === rc.id);
                    if (ac) { ac.items = rc.items; ac.remaining = rc.remaining; }
                }
                const contrib = getContribFromSlots(bestResult.assignment, bonusId, compoundRule);
                totals.flat += contrib.flat;
                totals.percent += contrib.percent;
                mergePercentStages(totals.percentStages, contrib.percentStages);
                if (contrib.multiplier !== 1) totals.multiplier *= contrib.multiplier;
            }
        }
    }

    console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms — ${totalPasses} full-combo passes for ${bonusId}`);
    return { assignment: allSlots, total: computeFinal(totals, compoundRule) };
}

function canUseFastPath(exclusives, containers) {
    const ids = new Set(exclusives.map(i => i.id));
    for (const item of exclusives) {
        if ((item.size ?? 1) > 1) return false;
        if ((item.constraint?.excludes ?? []).some(id => ids.has(id))) return false;
    }
    return true;
}

function fastPathAssign(containers, exclusives, stackables, bonusId, base, compoundRule) {
    const t0 = performance.now();
    const slotsAvailable = {};
    for (const c of containers) {
        slotsAvailable[c.slot_type] = (slotsAvailable[c.slot_type] ?? 0) + c.maxExclusive;
    }

    const totals = { ...base, percentStages: clonePercentStages(base.percentStages) };
    const chosen = [];
    const used = {};

    const sorted = [...exclusives]
        .map(item => ({ item, mv: marginalValue(getContrib(item, bonusId, compoundRule), totals, compoundRule) }))
        .filter(x => x.mv > 0)
        .sort((a, b) => b.mv - a.mv);

    const remaining = sorted.map(x => x.item);

    while (remaining.length) {
        let bestIdx = -1, bestMv = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const item = remaining[i];
            const slotType = item.slot;
            if ((used[slotType] ?? 0) >= (slotsAvailable[slotType] ?? 0)) continue;
            const mv = marginalValue(getContrib(item, bonusId, compoundRule), totals, compoundRule);
            if (mv > bestMv) { bestMv = mv; bestIdx = i; }
        }
        if (bestIdx === -1 || bestMv <= 0) break;

        const item = remaining.splice(bestIdx, 1)[0];
        used[item.slot] = (used[item.slot] ?? 0) + 1;
        chosen.push(item);

        const contrib = getContrib(item, bonusId, compoundRule);
        totals.flat += contrib.flat;
        totals.percent += contrib.percent;
        mergePercentStages(totals.percentStages, contrib.percentStages);
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    for (const item of chosen) {
        const container = slots.find(c => c.slot_type === item.slot && c.items.filter(i => i.exclusive).length < c.maxExclusive);
        if (container) {
            container.items.push(item);
            container.remaining -= 1;
        }
    }

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
            .map(s => ({ ...s, _marginal: marginalValue(getContrib(s, bonusId, compoundRule), totals, compoundRule) }))
            .filter(s => s._marginal > 0)
            .filter(s => !s.max || (placedCounts[s.id] ?? 0) < s.max)
            .filter(s => slots.some(c => c.slot_type === s.slot && c.remaining >= 1))
            .sort((a, b) => b._marginal - a._marginal)[0];

        if (!best) break;

        const container = slots.find(c => c.slot_type === best.slot && c.remaining >= 1);
        if (!container) break;

        placedCounts[best.id] = (placedCounts[best.id] ?? 0) + 1;
        container.items.push(best);
        container.remaining -= 1;

        const contrib = getContrib(best, bonusId, compoundRule);
        totals.flat += contrib.flat;
        totals.percent += contrib.percent;
        mergePercentStages(totals.percentStages, contrib.percentStages);
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    console.log(`[optimizer] fast-path done in ${(performance.now() - t0).toFixed(2)}ms — ${chosen.length} exclusives placed for ${bonusId}`);
    return { assignment: slots, total: computeFinal(totals, compoundRule) };
}

function getContribFromSlots(slots, bonusId, compoundRule = null) {
    const contrib = { flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
    for (const slot of slots) {
        for (const item of slot.items) {
            const c = getContrib(item, bonusId, compoundRule);
            contrib.flat += c.flat;
            contrib.percent += c.percent;
            mergePercentStages(contrib.percentStages, c.percentStages);
            if (c.multiplier) contrib.multiplier *= c.multiplier;
        }
    }
    return contrib;
}

function tryAssignment(containers, exclusiveCombo, stackableItems, bonusId, base, compoundRule) {
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base, percentStages: clonePercentStages(base.percentStages) };

    for (const item of [...exclusiveCombo].sort((a, b) => (b.size ?? 1) - (a.size ?? 1))) {
        const container = slots.find(c =>
            c.slot_type === item.slot &&
            c.remaining >= (item.size ?? 1) &&
            c.items.filter(i => i.exclusive).length < c.maxExclusive
        );
        if (!container) return { total: -Infinity, assignment: null };
        container.items.push(item);
        container.remaining -= (item.size ?? 1);

        const contrib = getContrib(item, bonusId, compoundRule);
        totals.flat += contrib.flat;
        totals.percent += contrib.percent;
        mergePercentStages(totals.percentStages, contrib.percentStages);
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
            .map(s => ({ ...s, _marginal: marginalValue(getContrib(s, bonusId, compoundRule), totals, compoundRule) }))
            .filter(s => s._marginal > 0)
            .filter(s => !s.max || (placedCounts[s.id] ?? 0) < s.max)
            .filter(s => slots.some(c => c.slot_type === s.slot && c.remaining >= 1))
            .sort((a, b) => b._marginal - a._marginal)[0];

        if (!best) break;

        const container = slots.find(c => c.slot_type === best.slot && c.remaining >= 1);
        if (!container) break;

        placedCounts[best.id] = (placedCounts[best.id] ?? 0) + 1;
        container.items.push(best);
        container.remaining -= 1;

        const contrib = getContrib(best, bonusId, compoundRule);
        totals.flat += contrib.flat;
        totals.percent += contrib.percent;
        mergePercentStages(totals.percentStages, contrib.percentStages);
        if (contrib.multiplier) totals.multiplier *= contrib.multiplier;
    }

    return { total: computeFinal(totals, compoundRule), assignment: slots };
}

function marginalValue(contrib, totals, compoundRule) {
    const before = computeFinal(totals, compoundRule);
    const after = computeFinal({
        flat: totals.flat + contrib.flat,
        percent: totals.percent + contrib.percent,
        percentStages: mergePercentStages(clonePercentStages(totals.percentStages), contrib.percentStages),
        multiplier: totals.multiplier * (contrib.multiplier > 0 ? contrib.multiplier : 1),
    }, compoundRule);
    return after - before;
}

function computeFinal({ flat, percent, percentStages = {}, multiplier }, compoundRule = null) {
    if (flat === 0 && percent > 0) return percent * multiplier;
    if (compoundRule?.percent_stages?.length) {
        let value = flat;
        let matchedPercent = 0;
        for (const stage of compoundRule.percent_stages) {
            const stagePercent = percentStages[stage.id] ?? 0;
            matchedPercent += stagePercent;
            value *= (1 + stagePercent / 100);
        }
        const remainingPercent = percent - matchedPercent;
        if (remainingPercent) value *= (1 + remainingPercent / 100);
        return value * multiplier;
    }
    return flat * (1 + percent / 100) * multiplier;
}

function getContrib(item, bonusId, compoundRule = null) {
    const contrib = { flat: 0, percent: 0, percentStages: {}, multiplier: 0 };
    const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
    for (const b of item.bonuses ?? []) {
        if (!ids.includes(b.bonus)) continue;
        const ut = b.unit_type ?? 'flat';
        contrib[ut] = (contrib[ut] ?? 0) + (b.value ?? 0);
        if (ut === 'percent') {
            const stageId = getPercentStageId(b, compoundRule);
            if (stageId) contrib.percentStages[stageId] = (contrib.percentStages[stageId] ?? 0) + (b.value ?? 0);
        }
    }
    return contrib;
}

function getPercentStageId(bonusEntry, compoundRule) {
    if (!compoundRule?.percent_stages?.length || !bonusEntry) return null;
    if ((bonusEntry.unit_type ?? 'flat') !== 'percent') return null;
    for (const stage of compoundRule.percent_stages) {
        if (!stage?.id || !stage.match) continue;
        if (matchesPercentStage(stage.match, bonusEntry)) return stage.id;
    }
    return compoundRule.percent_stages.find(stage => stage?.id && !stage.match)?.id ?? null;
}

function matchesPercentStage(match, bonusEntry) {
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
}

function clonePercentStages(percentStages = {}) {
    return { ...percentStages };
}

function mergePercentStages(target = {}, source = {}, factor = 1) {
    for (const [stageId, value] of Object.entries(source ?? {})) {
        if (!value) continue;
        target[stageId] = (target[stageId] ?? 0) + (value * factor);
    }
    return target;
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
