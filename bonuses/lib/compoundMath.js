export function clonePercentStages(percentStages = {}) {
    return { ...percentStages };
}

export function mergePercentStages(target = {}, source = {}, factor = 1) {
    for (const [stageId, value] of Object.entries(source ?? {})) {
        if (!value) continue;
        target[stageId] = (target[stageId] ?? 0) + (value * factor);
    }
    return target;
}

export function emptyCompoundContrib() {
    return { flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
}

export function hasNonZeroCompoundContrib(contrib) {
    if (!contrib) return false;
    if (contrib.flat || contrib.percent) return true;
    if ((contrib.multiplier ?? 1) !== 1) return true;
    return Object.values(contrib.percentStages ?? {}).some(Boolean);
}

export function mergeCompoundContrib(left, right) {
    return {
        flat: (left.flat ?? 0) + (right.flat ?? 0),
        percent: (left.percent ?? 0) + (right.percent ?? 0),
        percentStages: mergePercentStages(clonePercentStages(left.percentStages), right.percentStages),
        multiplier: (left.multiplier ?? 1) * (right.multiplier ?? 1),
    };
}

export function addCompoundContrib(base, contrib) {
    return {
        flat: (base.flat ?? 0) + (contrib.flat ?? 0),
        percent: (base.percent ?? 0) + (contrib.percent ?? 0),
        percentStages: mergePercentStages(clonePercentStages(base.percentStages), contrib.percentStages),
        multiplier: (base.multiplier ?? 1) * (contrib.multiplier ?? 1),
    };
}

export function computeCompoundFlatValue(flat, percent, percentStages, multiplier, compoundRule) {
    if (!compoundRule || !Array.isArray(compoundRule.percent_stages) || !compoundRule.percent_stages.length) {
        return flat * (1 + percent / 100) * (multiplier || 1);
    }
    let value = flat;
    let matchedPercent = 0;
    for (const stage of compoundRule.percent_stages) {
        const stagePercent = percentStages?.[stage.id] ?? 0;
        matchedPercent += stagePercent;
        value *= (1 + stagePercent / 100);
    }
    const remainingPercent = percent - matchedPercent;
    if (remainingPercent) value *= (1 + remainingPercent / 100);
    return value * (multiplier || 1);
}

export function computeCompoundValue({ flat = 0, percent = 0, percentStages = {}, multiplier = 1 }, compoundRule = null) {
    const hasFlat = flat !== 0;
    const hasPercent = percent !== 0 || Object.values(percentStages ?? {}).some(Boolean);
    const hasMultiplier = (multiplier ?? 1) !== 1;

    if (hasFlat) {
        return computeCompoundFlatValue(flat, percent, percentStages, multiplier, compoundRule);
    }
    if (hasPercent) return percent * multiplier;
    if (hasMultiplier) return multiplier;
    return 0;
}

export function compoundTotalFromItems(items = [], compoundRule = null) {
    if (!items.length) {
        return { value: 0, unit_type: 'flat', isMixed: false, flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
    }

    let flat = 0;
    let percent = 0;
    let multiplier = 1;
    let multiplierCount = 0;
    const percentStages = {};
    const unitTypes = new Set();

    for (const item of items) {
        const unitType = item.unit_type || 'flat';
        unitTypes.add(unitType);
        const total = Number(item.value ?? 0) * Number(item.mult ?? 1);
        if (unitType === 'flat') {
            flat += total;
        } else if (unitType === 'percent') {
            percent += total;
            mergePercentStages(percentStages, item.percentStages, item.mult);
        } else if (unitType === 'multiplier') {
            multiplier *= Math.pow(Number(item.value ?? 1), Number(item.mult ?? 1));
            multiplierCount += Number(item.mult ?? 1);
        }
    }

    const hasFlat = unitTypes.has('flat');
    const hasPercent = unitTypes.has('percent');
    const hasMultiplier = unitTypes.has('multiplier');
    const summary = { flat, percent, percentStages, multiplier };

    if (hasFlat) {
        return {
            ...summary,
            value: computeCompoundValue(summary, compoundRule),
            unit_type: 'flat',
            isMixed: hasPercent || hasMultiplier,
            multiplierCount
        };
    }
    if (hasPercent) {
        return {
            ...summary,
            value: computeCompoundValue(summary, compoundRule),
            unit_type: 'percent',
            isMixed: hasMultiplier,
            multiplierCount
        };
    }
    return {
        ...summary,
        value: computeCompoundValue(summary, compoundRule),
        unit_type: 'multiplier',
        isMixed: false,
        multiplierCount
    };
}
