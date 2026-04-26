/**
 * Generic slot optimizer with marginal value scoring.
 */
export function optimize(containers, exclusiveItems, stackableItems, bonusIds, currentTotals = {}) {
    const base = {
        flat:       currentTotals.flat       ?? 0,
        percent:    currentTotals.percent    ?? 0,
        multiplier: currentTotals.multiplier ?? 1,
    };

    const validExclusives = exclusiveItems.filter(item => {
        const c = getContrib(item, bonusIds);
        return c.flat || c.percent || c.multiplier || item.size < Math.max(...containers.map(c => c.slots));
    });

    const validStackables = stackableItems.filter(s => {
        const c = getContrib(s, bonusIds);
        return c.flat || c.percent || c.multiplier;
    });

    // Pre-compute contributions once
    const contribCache = new Map();
    const cachedContrib = item => {
        if (!contribCache.has(item.id)) contribCache.set(item.id, getContrib(item, bonusIds));
        return contribCache.get(item.id);
    };

    const expandedExclusives = validExclusives.flatMap(item =>
        Array(Math.min(item.max ?? containers.length, containers.length)).fill(item)
    );

    let best = { assignment: null, total: -Infinity };

    const t0 = performance.now();
    let pass = 0;
    for (const combo of combinations(expandedExclusives, containers.length)) {
        pass++;
        const result = tryAssignment(containers, combo, validStackables, base, cachedContrib);
        if (result.total > best.total) best = result;
    }

    console.log(`[optimizer] done in ${(performance.now() - t0).toFixed(2)}ms — ${pass} passes for ${bonusIds}`);
    return best;
}

function tryAssignment(containers, exclusiveCombo, stackableItems, base, cachedContrib) {
    const slots = containers.map(c => ({ ...c, remaining: c.slots, items: [] }));
    const totals = { ...base };

    // Place exclusives largest-first
    for (const item of [...exclusiveCombo].sort((a, b) => b.size - a.size)) {
        const container = slots.find(c =>
            c.remaining >= item.size &&
            (!item.exclusive || c.items.filter(i => i.exclusive).length < c.maxExclusive)
        );
        if (!container) return { total: -Infinity, assignment: null };
        container.items.push({ ...item, _exclusive: true });
        container.remaining -= item.size;
        addContrib(totals, cachedContrib(item));
    }

    // Filter stackables by constraints
    const placedIds = new Set(exclusiveCombo.map(i => i.id));
    const excluded  = new Set(exclusiveCombo.flatMap(i => i.constraint?.excludes ?? []));
    const eligible  = stackableItems.filter(s =>
        !excluded.has(s.id) &&
        !(s.constraint?.excludes ?? []).some(id => placedIds.has(id))
    );

    // Greedily fill remaining slots
    const placedCounts = {};
    const totalFree = slots.reduce((sum, c) => sum + c.remaining, 0);

    for (let i = 0; i < totalFree; i++) {
        const best = eligible
            .filter(s => !s.max || (placedCounts[s.id] ?? 0) < s.max)
            .map(s => ({ s, mv: marginalValue(cachedContrib(s), totals) }))
            .filter(x => x.mv > 0)
            .sort((a, b) => b.mv - a.mv)[0];

        if (!best) break;

        const container = slots.find(c => c.remaining >= 1);
        if (!container) break;

        container.items.push(best.s);
        container.remaining--;
        placedCounts[best.s.id] = (placedCounts[best.s.id] ?? 0) + 1;
        addContrib(totals, cachedContrib(best.s));
    }

    return { total: computeFinal(totals), assignment: slots };
}

function addContrib(totals, contrib) {
    totals.flat       += contrib.flat;
    totals.percent    += contrib.percent;
    totals.multiplier *= contrib.multiplier || 1;
}

function marginalValue(contrib, { flat, percent, multiplier }) {
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

function getContrib(item, bonusIds) {
    const contrib = { flat: 0, percent: 0, multiplier: 0 };
    const ids = Array.isArray(bonusIds) ? bonusIds : [bonusIds];
    for (const b of item.bonuses ?? []) {
        if (!ids.includes(b.bonus)) continue;
        contrib[b.unit_type ?? 'flat'] = (contrib[b.unit_type ?? 'flat'] ?? 0) + (b.value ?? 0);
    }
    return contrib;
}

function* combinations(items, maxSize) {
    yield [];
    function* combine(start, current, size) {
        if (size === 0) { yield [...current]; return; }
        for (let i = start; i <= items.length - size; i++) {
            current.push(items[i]);
            yield* combine(i + 1, current, size - 1);
            current.pop();
        }
    }
    for (let size = 1; size <= Math.min(maxSize, items.length); size++) {
        yield* combine(0, [], size);
    }
}