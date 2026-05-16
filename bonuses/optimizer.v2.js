import {
    addCompoundContrib,
    clonePercentStages,
    computeCompoundValue,
    emptyCompoundContrib,
    hasNonZeroCompoundContrib,
    mergePercentStages
} from './compoundMath.js?v=badea150ed';
import {
    canPlaceExclusiveInContainer,
    clonePlacementContainers,
    getPlacementItemLimit,
    isPlacementItemBlocked,
    mergePlacementIdSet,
    placePlacementItemInContainer,
    placeStackablePlacementCount,
    sortPlacementItems
} from './slotPlacement.js?v=8da036ae76';

export function optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals = {}) {
    const t0 = performance.now();
    const compoundRule = currentTotals.compoundRule ?? null;
    const base = {
        flat: currentTotals.flat ?? 0,
        percent: currentTotals.percent ?? 0,
        percentStages: clonePercentStages(currentTotals.percentStages),
        multiplier: currentTotals.multiplier ?? 1,
    };
    const stats = createStats();

    const families = buildFamilies(containers, exclusiveItems, stackableItems, bonusId, compoundRule);
    if (!families.length) {
        console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms - 0 families for ${bonusId}`);
        return {
            assignment: containers.map(container => ({ ...container, remaining: container.slots, items: [] })),
            total: computeCompoundValue(base, compoundRule)
        };
    }

    const runningTotals = { ...base, percentStages: clonePercentStages(base.percentStages) };
    const allAssignments = [];

    for (const family of families) {
        const familyState = solveFamily(family, bonusId, runningTotals, compoundRule, stats);
        if (!familyState) continue;
        allAssignments.push(...familyState.assignment);
        runningTotals.flat += familyState.contrib.flat;
        runningTotals.percent += familyState.contrib.percent;
        mergePercentStages(runningTotals.percentStages, familyState.contrib.percentStages);
        runningTotals.multiplier *= familyState.contrib.multiplier;
    }

    const assignmentById = new Map(allAssignments.map(container => [container.id, container]));
    const assignment = containers.map(container => assignmentById.get(container.id) ?? { ...container, remaining: container.slots, items: [] });
    const totalContrib = getContribFromSlots(assignment, bonusId, compoundRule);

    const result = {
        assignment,
        total: computeCompoundValue(addCompoundContrib(base, totalContrib), compoundRule)
    };
    console.log(
        `[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms - ` +
        `${families.length} families, fast=${stats.fastFamilies}, simple=${stats.simpleFamilies}, complex=${stats.complexFamilies}, ` +
        `branches=${stats.branches}, frontier=${stats.frontierStates} for ${bonusId}`
    );
    return result;
}

function buildFamilies(containers, exclusiveItems, stackableItems, bonusId, compoundRule) {
    const bySlotType = new Map();
    const filteredExclusives = filterRelevantItems(exclusiveItems, bonusId, compoundRule);
    const filteredStackables = filterRelevantItems(stackableItems, bonusId, compoundRule);

    for (const container of containers) {
        const slotType = container.slot_type;
        if (!bySlotType.has(slotType)) {
            bySlotType.set(slotType, { slotType, containers: [], exclusives: [], stackables: [] });
        }
        bySlotType.get(slotType).containers.push({ ...container });
    }

    for (const item of filteredExclusives) {
        const family = bySlotType.get(item.slot);
        if (family) family.exclusives.push(item);
    }
    for (const item of filteredStackables) {
        const family = bySlotType.get(item.slot);
        if (family) family.stackables.push(item);
    }

    return [...bySlotType.values()]
        .map(pruneDominatedStackables)
        .filter(family => family.exclusives.length || family.stackables.length);
}

function filterRelevantItems(items, bonusId, compoundRule) {
    return items
        .map((item, index) => ({ ...item, _order: index, _contrib: getContrib(item, bonusId, compoundRule) }))
        .filter(item => hasNonZeroCompoundContrib(item._contrib));
}

function pruneDominatedStackables(family) {
    if (!family.stackables.length) return family;
    const capacity = family.containers.reduce((sum, container) => sum + (container.slots ?? 0), 0);
    const stackableIds = new Set(family.stackables.map(item => item.id));
    const pruned = family.stackables.filter((item, index, items) => {
        if (!isDominancePrunableStackable(item, stackableIds)) return true;
        return !items.some((other, otherIndex) =>
            otherIndex !== index
            && dominatesStackableCandidate(other, item, capacity, stackableIds)
        );
    });
    return { ...family, stackables: pruned };
}

function isDominancePrunableStackable(item, stackableIds) {
    if ((item.size ?? 1) !== 1) return false;
    const maxUse = item.max ?? Infinity;
    if (Number.isFinite(maxUse) && maxUse <= 0) return false;
    return !(item.constraint?.excludes ?? []).some(excludedId => stackableIds.has(excludedId));
}

function dominatesStackableCandidate(left, right, capacity, stackableIds) {
    if (!isDominancePrunableStackable(left, stackableIds) || !isDominancePrunableStackable(right, stackableIds)) return false;
    if (left.id === right.id) return false;

    const leftLimit = getPlacementItemLimit(left, capacity);
    const rightLimit = getPlacementItemLimit(right, capacity);
    if (leftLimit < rightLimit) return false;

    const leftContrib = left._contrib ?? emptyCompoundContrib();
    const rightContrib = right._contrib ?? emptyCompoundContrib();
    if (!dominates(leftContrib, rightContrib)) return false;

    const leftSignature = contribSignature(leftContrib);
    const rightSignature = contribSignature(rightContrib);
    if (leftSignature === rightSignature) {
        return (left._order ?? 0) < (right._order ?? 0);
    }
    return true;
}

function solveFamily(family, bonusId, base, compoundRule, stats) {
    if (canUseProvableFastPath(family)) {
        stats.fastFamilies += 1;
        return fastPathState(family, bonusId, base, compoundRule);
    }
    if (isSimpleFamily(family)) {
        stats.simpleFamilies += 1;
        return solveSimpleFamily(family, bonusId, base, compoundRule, stats);
    }
    stats.complexFamilies += 1;
    const frontier = solveComplexFamily(family, bonusId, compoundRule, stats);
    return chooseBestState(frontier, base, compoundRule);
}

function canUseProvableFastPath(family) {
    const items = [...family.exclusives, ...family.stackables];
    if (!items.length) return true;
    if (!family.containers.every(container => container.slots === 1 && container.maxExclusive === 1)) return false;
    if (items.some(item => (item.size ?? 1) !== 1)) return false;
    if (items.some(item => getPlacementItemLimit(item, family.containers.length) !== 1)) return false;
    if (items.some(item => (item.constraint?.excludes ?? []).length)) return false;
    return items.length <= 1 && family.containers.length <= 1;
}

function fastPathState(family, bonusId, base, compoundRule) {
    const containers = clonePlacementContainers(family.containers);
    const item = family.exclusives[0] ?? family.stackables[0] ?? null;
    if (!item) return { contrib: emptyCompoundContrib(), assignment: containers };

    const withItem = clonePlacementContainers(containers);
    placePlacementItemInContainer(withItem[0], item);
    const states = [
        { contrib: emptyCompoundContrib(), assignment: containers },
        { contrib: getContribFromSlots(withItem, bonusId, compoundRule), assignment: withItem }
    ];
    return chooseBestState(states, base, compoundRule);
}

function isSimpleFamily(family) {
    if (!family.containers.every(container => container.slots === 1 && container.maxExclusive === 1)) return false;
    return [...family.exclusives, ...family.stackables].every(item =>
        (item.size ?? 1) === 1 && !(item.constraint?.excludes ?? []).length
    );
}

function solveSimpleFamily(family, bonusId, base, compoundRule, stats) {
    const items = sortPlacementItems([...family.exclusives, ...family.stackables]);
    const capacity = family.containers.length;
    const assignment = clonePlacementContainers(family.containers);
    const totals = {
        flat: base.flat ?? 0,
        percent: base.percent ?? 0,
        percentStages: clonePercentStages(base.percentStages),
        multiplier: base.multiplier ?? 1
    };
    const placedCounts = {};

    for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
        let bestItem = null;
        let bestMarginal = -Infinity;
        for (const item of items) {
            const limit = getPlacementItemLimit(item, capacity);
            if ((placedCounts[item.id] ?? 0) >= limit) continue;
            const contrib = item._contrib ?? getContrib(item, bonusId, compoundRule);
            const mv = marginalValue(contrib, totals, compoundRule);
            stats.branches += 1;
            if (mv > bestMarginal) {
                bestMarginal = mv;
                bestItem = item;
            }
        }
        if (!bestItem || bestMarginal <= 0) break;
        placePlacementItemInContainer(assignment[slotIndex], bestItem);
        placedCounts[bestItem.id] = (placedCounts[bestItem.id] ?? 0) + 1;
        const contrib = bestItem._contrib ?? getContrib(bestItem, bonusId, compoundRule);
        totals.flat += contrib.flat;
        totals.percent += contrib.percent;
        mergePercentStages(totals.percentStages, contrib.percentStages);
        totals.multiplier *= contrib.multiplier;
    }

    return {
        contrib: getContribFromSlots(assignment, bonusId, compoundRule),
        assignment
    };
}

function solveComplexFamily(family, bonusId, compoundRule, stats) {
    const frontier = [];
    const baseContainers = clonePlacementContainers(family.containers);
    const exclusives = sortPlacementItems(family.exclusives);
    const stackables = sortPlacementItems(family.stackables);

    walkExclusivePlacements(
        baseContainers,
        exclusives,
        stackables,
        0,
        {},
        new Set(),
        new Set(),
        frontier,
        bonusId,
        compoundRule,
        stats
    );

    if (!frontier.length) {
        return [{ contrib: emptyCompoundContrib(), assignment: clonePlacementContainers(family.containers) }];
    }
    return frontier;
}

function walkExclusivePlacements(containers, exclusives, stackables, index, counts, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats) {
    stats.branches += 1;
    if (index >= exclusives.length) {
        walkStackablePlacements(containers, stackables, 0, {}, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats);
        return;
    }

    walkExclusivePlacements(containers, exclusives, stackables, index + 1, counts, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats);

    const item = exclusives[index];
    if (isPlacementItemBlocked(item, chosenIds, blockedIds)) return;

    const maxUse = getPlacementItemLimit(item, containers.length);
    if ((counts[item.id] ?? 0) >= maxUse) return;

    for (const container of containers) {
        if (!canPlaceExclusiveInContainer(container, item)) continue;

        const nextContainers = clonePlacementContainers(containers);
        const nextContainer = nextContainers.find(entry => entry.id === container.id);
        placePlacementItemInContainer(nextContainer, item);

        const nextCounts = { ...counts, [item.id]: (counts[item.id] ?? 0) + 1 };
        const nextChosenIds = new Set(chosenIds);
        nextChosenIds.add(item.id);
        const nextBlockedIds = mergePlacementIdSet(blockedIds, item.constraint?.excludes ?? []);
        const nextIndex = nextCounts[item.id] >= maxUse ? index + 1 : index;

        walkExclusivePlacements(
            nextContainers,
            exclusives,
            stackables,
            nextIndex,
            nextCounts,
            nextChosenIds,
            nextBlockedIds,
            frontier,
            bonusId,
            compoundRule,
            stats
        );
    }
}

function walkStackablePlacements(containers, stackables, index, counts, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats) {
    stats.branches += 1;
    if (index >= stackables.length) {
        pushFrontierState(frontier, {
            contrib: getContribFromSlots(containers, bonusId, compoundRule),
            assignment: clonePlacementContainers(containers)
        }, stats);
        return;
    }

    const item = stackables[index];
    const totalFree = containers.reduce((sum, container) => sum + container.remaining, 0);
    walkStackablePlacements(containers, stackables, index + 1, counts, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats);

    if (totalFree <= 0 || isPlacementItemBlocked(item, chosenIds, blockedIds)) return;

    const limit = Math.min(totalFree, getPlacementItemLimit(item, totalFree));
    if (limit <= 0) return;

    for (let count = 1; count <= limit; count += 1) {
        if ((item.constraint?.excludes ?? []).includes(item.id) && count > 1) break;
        const nextContainers = clonePlacementContainers(containers);
        if (!placeStackablePlacementCount(nextContainers, item, count)) break;

        const nextCounts = { ...counts, [item.id]: count };
        const nextChosenIds = new Set(chosenIds);
        nextChosenIds.add(item.id);
        const nextBlockedIds = mergePlacementIdSet(blockedIds, item.constraint?.excludes ?? []);

        walkStackablePlacements(nextContainers, stackables, index + 1, nextCounts, nextChosenIds, nextBlockedIds, frontier, bonusId, compoundRule, stats);
    }
}

function chooseBestState(states, base, compoundRule) {
    let best = null;
    let bestScore = -Infinity;
    let bestSignature = '';

    for (const state of states) {
        const total = computeCompoundValue(addCompoundContrib(base, state.contrib), compoundRule);
        const signature = stateSignature(state);
        if (total > bestScore || (total === bestScore && signature < bestSignature)) {
            best = state;
            bestScore = total;
            bestSignature = signature;
        }
    }

    return best ?? { contrib: emptyCompoundContrib(), assignment: [] };
}

function pushFrontierState(frontier, state, stats = null) {
    if (!state.assignment) {
        frontier.push(state);
        if (stats) stats.frontierStates = Math.max(stats.frontierStates, frontier.length);
        return;
    }
    const signature = stateSignature(state);
    for (let i = frontier.length - 1; i >= 0; i -= 1) {
        const current = frontier[i];
        if (dominates(current.contrib, state.contrib)) {
            if (!dominates(state.contrib, current.contrib) || stateSignature(current) <= signature) return;
        }
        if (dominates(state.contrib, current.contrib)) {
            if (!dominates(current.contrib, state.contrib) || signature <= stateSignature(current)) {
                frontier.splice(i, 1);
            }
        }
    }
    frontier.push(state);
    if (stats) stats.frontierStates = Math.max(stats.frontierStates, frontier.length);
}

function createStats() {
    return {
        fastFamilies: 0,
        simpleFamilies: 0,
        complexFamilies: 0,
        branches: 0,
        frontierStates: 0
    };
}

function marginalValue(contrib, totals, compoundRule) {
    const before = computeCompoundValue(totals, compoundRule);
    const after = computeCompoundValue(addCompoundContrib(totals, contrib), compoundRule);
    return after - before;
}

function dominates(left, right) {
    const stageIds = new Set([
        ...Object.keys(left.percentStages ?? {}),
        ...Object.keys(right.percentStages ?? {})
    ]);

    if ((left.flat ?? 0) < (right.flat ?? 0)) return false;
    if ((left.percent ?? 0) < (right.percent ?? 0)) return false;
    if ((left.multiplier ?? 1) < (right.multiplier ?? 1)) return false;
    for (const stageId of stageIds) {
        if ((left.percentStages?.[stageId] ?? 0) < (right.percentStages?.[stageId] ?? 0)) return false;
    }
    return true;
}

function stateSignature(state) {
    return state.assignment
        .slice()
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map(container => `${container.id}:${container.items.map(item => item.id).sort().join(',')}`)
        .join('|');
}

function contribSignature(contrib) {
    const stageEntries = Object.entries(contrib.percentStages ?? {})
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([stageId, value]) => `${stageId}:${value}`)
        .join(',');
    return [
        contrib.flat ?? 0,
        contrib.percent ?? 0,
        contrib.multiplier ?? 1,
        stageEntries
    ].join('|');
}

function getContribFromSlots(slots, bonusId, compoundRule = null) {
    const contrib = emptyCompoundContrib();
    for (const slot of slots) {
        for (const item of slot.items) {
            const itemContrib = item._contrib ?? getContrib(item, bonusId, compoundRule);
            contrib.flat += itemContrib.flat;
            contrib.percent += itemContrib.percent;
            mergePercentStages(contrib.percentStages, itemContrib.percentStages);
            contrib.multiplier *= (itemContrib.multiplier || 1);
        }
    }
    return contrib;
}

function getContrib(item, bonusId, compoundRule = null) {
    const contrib = emptyCompoundContrib();
    const ids = Array.isArray(bonusId) ? bonusId : [bonusId];
    for (const bonusEntry of item.bonuses ?? []) {
        if (!ids.includes(bonusEntry.bonus)) continue;
        const unitType = bonusEntry.unit_type ?? 'flat';
        if (unitType === 'multiplier') {
            contrib.multiplier *= (bonusEntry.value ?? 1);
            continue;
        }
        contrib[unitType] = (contrib[unitType] ?? 0) + (bonusEntry.value ?? 0);
        if (unitType === 'percent') {
            const stageId = getPercentStageId(bonusEntry, compoundRule);
            if (stageId) contrib.percentStages[stageId] = (contrib.percentStages[stageId] ?? 0) + (bonusEntry.value ?? 0);
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
