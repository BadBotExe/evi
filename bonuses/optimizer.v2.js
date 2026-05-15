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
            total: computeFinal(base, compoundRule)
        };
    }

    let frontier = [{
        contrib: emptyContrib(),
        assignment: []
    }];
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
        total: computeFinal(addContrib(base, totalContrib), compoundRule)
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

    return [...bySlotType.values()].filter(family => family.exclusives.length || family.stackables.length);
}

function filterRelevantItems(items, bonusId, compoundRule) {
    return items
        .map((item, index) => ({ ...item, _order: index, _contrib: getContrib(item, bonusId, compoundRule) }))
        .filter(item => hasNonZeroContrib(item._contrib));
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
    if (items.some(item => getItemLimit(item, family.containers.length) !== 1)) return false;
    if (items.some(item => (item.constraint?.excludes ?? []).length)) return false;
    return items.length <= 1 && family.containers.length <= 1;
}

function fastPathState(family, bonusId, base, compoundRule) {
    const containers = cloneContainers(family.containers);
    const item = family.exclusives[0] ?? family.stackables[0] ?? null;
    if (!item) return { contrib: emptyContrib(), assignment: containers };

    const withItem = cloneContainers(containers);
    placeItemInContainer(withItem[0], item);
    const states = [
        { contrib: emptyContrib(), assignment: containers },
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
    const items = sortItems([...family.exclusives, ...family.stackables]);
    const capacity = family.containers.length;
    const assignment = cloneContainers(family.containers);
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
            const limit = getItemLimit(item, capacity);
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
        placeItemInContainer(assignment[slotIndex], bestItem);
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
    const baseContainers = cloneContainers(family.containers);
    const exclusives = sortItems(family.exclusives);
    const stackables = sortItems(family.stackables);

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
        return [{ contrib: emptyContrib(), assignment: cloneContainers(family.containers) }];
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
    if (isBlockedBySelection(item, chosenIds, blockedIds)) return;

    const maxUse = getItemLimit(item, containers.length);
    if ((counts[item.id] ?? 0) >= maxUse) return;

    for (const container of containers) {
        if (!canPlaceExclusive(container, item)) continue;

        const nextContainers = cloneContainers(containers);
        const nextContainer = nextContainers.find(entry => entry.id === container.id);
        placeItemInContainer(nextContainer, item);

        const nextCounts = { ...counts, [item.id]: (counts[item.id] ?? 0) + 1 };
        const nextChosenIds = new Set(chosenIds);
        nextChosenIds.add(item.id);
        const nextBlockedIds = mergeIdSet(blockedIds, item.constraint?.excludes ?? []);

        walkExclusivePlacements(
            nextContainers,
            exclusives,
            stackables,
            index + 1,
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
            assignment: cloneContainers(containers)
        }, stats);
        return;
    }

    const item = stackables[index];
    const totalFree = containers.reduce((sum, container) => sum + container.remaining, 0);
    walkStackablePlacements(containers, stackables, index + 1, counts, chosenIds, blockedIds, frontier, bonusId, compoundRule, stats);

    if (totalFree <= 0 || isBlockedBySelection(item, chosenIds, blockedIds)) return;

    const limit = Math.min(totalFree, getItemLimit(item, totalFree));
    if (limit <= 0) return;

    for (let count = 1; count <= limit; count += 1) {
        if ((item.constraint?.excludes ?? []).includes(item.id) && count > 1) break;
        const nextContainers = cloneContainers(containers);
        if (!placeStackableCount(nextContainers, item, count)) break;

        const nextCounts = { ...counts, [item.id]: count };
        const nextChosenIds = new Set(chosenIds);
        nextChosenIds.add(item.id);
        const nextBlockedIds = mergeIdSet(blockedIds, item.constraint?.excludes ?? []);

        walkStackablePlacements(nextContainers, stackables, index + 1, nextCounts, nextChosenIds, nextBlockedIds, frontier, bonusId, compoundRule, stats);
    }
}

function combineFrontiers(globalFrontier, familyFrontier, base, compoundRule) {
    const next = [];
    for (const globalState of globalFrontier) {
        for (const familyState of familyFrontier) {
            const contrib = mergeContrib(globalState.contrib, familyState.contrib);
            pushFrontierState(next, {
                contrib,
                assignment: [...globalState.assignment, ...familyState.assignment]
            }, base, compoundRule);
        }
    }
    return next;
}

function chooseBestState(states, base, compoundRule) {
    let best = null;
    let bestScore = -Infinity;
    let bestSignature = '';

    for (const state of states) {
        const total = computeFinal(addContrib(base, state.contrib), compoundRule);
        const signature = stateSignature(state);
        if (total > bestScore || (total === bestScore && signature < bestSignature)) {
            best = state;
            bestScore = total;
            bestSignature = signature;
        }
    }

    return best ?? { contrib: emptyContrib(), assignment: [] };
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
    const before = computeFinal(totals, compoundRule);
    const after = computeFinal(addContrib(totals, contrib), compoundRule);
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

function cloneContainers(containers) {
    return containers.map(container => ({
        ...container,
        remaining: container.remaining ?? container.slots,
        items: [...(container.items ?? [])]
    }));
}

function canPlaceExclusive(container, item) {
    return container.slot_type === item.slot
        && container.remaining >= (item.size ?? 1)
        && container.items.filter(entry => entry.exclusive).length < container.maxExclusive;
}

function placeItemInContainer(container, item) {
    container.items.push(item);
    container.remaining -= (item.size ?? 1);
}

function placeStackableCount(containers, item, count) {
    let remaining = count;
    for (const container of containers) {
        while (remaining > 0 && container.slot_type === item.slot && container.remaining > 0) {
            placeItemInContainer(container, item);
            remaining -= 1;
        }
        if (remaining === 0) return true;
    }
    return false;
}

function sortItems(items) {
    return [...items].sort((a, b) => {
        if ((b.size ?? 1) !== (a.size ?? 1)) return (b.size ?? 1) - (a.size ?? 1);
        if ((b.max ?? 1) !== (a.max ?? 1)) return (a.max ?? 1) - (b.max ?? 1);
        return (a._order ?? 0) - (b._order ?? 0);
    });
}

function compareItemsForPlacement(a, b) {
    if ((b.size ?? 1) !== (a.size ?? 1)) return (b.size ?? 1) - (a.size ?? 1);
    return String(a.id).localeCompare(String(b.id));
}

function getItemLimit(item, fallbackCapacity) {
    if (item.max != null) return Number(item.max);
    if (item.exclusive || (item.size ?? 1) > 1) return 1;
    return fallbackCapacity;
}

function mergeIdSet(source, ids) {
    const next = new Set(source);
    for (const id of ids ?? []) next.add(id);
    return next;
}

function isBlockedBySelection(item, chosenIds, blockedIds) {
    if (blockedIds.has(item.id)) return true;
    for (const excludedId of item.constraint?.excludes ?? []) {
        if (chosenIds.has(excludedId)) return true;
    }
    return false;
}

function emptyContrib() {
    return { flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
}

function hasNonZeroContrib(contrib) {
    if (!contrib) return false;
    if (contrib.flat || contrib.percent) return true;
    if ((contrib.multiplier ?? 1) !== 1) return true;
    return Object.values(contrib.percentStages ?? {}).some(Boolean);
}

function mergeContrib(left, right) {
    return {
        flat: (left.flat ?? 0) + (right.flat ?? 0),
        percent: (left.percent ?? 0) + (right.percent ?? 0),
        percentStages: mergePercentStages(clonePercentStages(left.percentStages), right.percentStages),
        multiplier: (left.multiplier ?? 1) * (right.multiplier ?? 1),
    };
}

function addContrib(base, contrib) {
    return {
        flat: (base.flat ?? 0) + (contrib.flat ?? 0),
        percent: (base.percent ?? 0) + (contrib.percent ?? 0),
        percentStages: mergePercentStages(clonePercentStages(base.percentStages), contrib.percentStages),
        multiplier: (base.multiplier ?? 1) * (contrib.multiplier ?? 1),
    };
}

function getContribFromSlots(slots, bonusId, compoundRule = null) {
    const contrib = emptyContrib();
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

function computeFinal({ flat, percent, percentStages = {}, multiplier }, compoundRule = null) {
    const base = flat === 0 && percent !== 0 ? 1 : flat;
    if (compoundRule?.percent_stages?.length) {
        let value = base;
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
    return base * (1 + percent / 100) * multiplier;
}

function getContrib(item, bonusId, compoundRule = null) {
    const contrib = emptyContrib();
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
