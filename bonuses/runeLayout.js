function buildRuneInstances(sourceCounts, resolveSource) {
    const instances = [];
    for (const [sourceId, count] of sourceCounts.entries()) {
        const src = resolveSource(sourceId);
        if (!src || src.slot !== 'rune_socket') return null;
        const maxCount = Number(src.max ?? Infinity);
        if (count > maxCount) return null;
        const size = Math.max(1, Number(src.size ?? 1));
        const exclusive = Boolean(src.exclusive) || size > 1 || maxCount === 1;
        for (let i = 0; i < count; i += 1) {
            instances.push({
                id: src.id,
                size,
                exclusive,
                excludes: src.constraint?.excludes ?? []
            });
        }
    }
    return instances.sort((a, b) => {
        if (b.size !== a.size) return b.size - a.size;
        if (a.exclusive !== b.exclusive) return Number(b.exclusive) - Number(a.exclusive);
        return a.id.localeCompare(b.id);
    });
}

function buildRuneCircles(runeCircles) {
    return (runeCircles ?? []).map(circle => ({
        id: circle.id,
        slots: Number(circle.slots ?? 0),
        remaining: Number(circle.slots ?? 0),
        hasExclusive: false,
        items: []
    }));
}

function tryPlaceRuneInstances(circles, instances, index = 0) {
    if (index >= instances.length) return true;
    const instance = instances[index];
    const placedItems = circles.flatMap(circle => circle.items);

    for (const circle of circles) {
        if (circle.remaining < instance.size) continue;
        if (instance.exclusive && circle.hasExclusive) continue;

        let blocked = false;
        for (const placed of placedItems) {
            if (instance.excludes.includes(placed.id) || placed.excludes.includes(instance.id)) {
                blocked = true;
                break;
            }
        }
        if (blocked) continue;

        circle.remaining -= instance.size;
        circle.items.push(instance);
        const previousExclusive = circle.hasExclusive;
        if (instance.exclusive) circle.hasExclusive = true;

        if (tryPlaceRuneInstances(circles, instances, index + 1)) return true;

        circle.remaining += instance.size;
        circle.items.pop();
        circle.hasExclusive = previousExclusive;
    }

    return false;
}

export function buildRuneLayout(runeCircles, sourceCounts, resolveSource) {
    const circles = buildRuneCircles(runeCircles);
    if (!circles.length) return null;
    const instances = buildRuneInstances(sourceCounts, resolveSource);
    if (!instances) return null;
    return tryPlaceRuneInstances(circles, instances) ? circles : null;
}

export function canPlaceRuneSelection(runeCircles, sourceCounts, resolveSource) {
    return !!buildRuneLayout(runeCircles, sourceCounts, resolveSource);
}

export function getRuneAddLimitFromLayout(layout, sourceCounts, resolveSource, sourceId) {
    const src = resolveSource(sourceId);
    if (!src || src.slot !== 'rune_socket') return 0;
    if (!layout) return 0;

    const currentCount = Number(sourceCounts.get(sourceId) ?? 0);
    const maxCount = Number(src.max ?? Infinity);
    const remainingByMax = Number.isFinite(maxCount) ? Math.max(0, maxCount - currentCount) : Infinity;
    if (remainingByMax <= 0) return 0;

    const placedItems = layout.flatMap(circle => circle.items);
    for (const placed of placedItems) {
        const excludes = placed.excludes ?? [];
        const candidateExcludes = src.constraint?.excludes ?? [];
        if (excludes.includes(src.id) || candidateExcludes.includes(placed.id)) {
            return 0;
        }
    }

    const size = Math.max(1, Number(src.size ?? 1));
    const exclusive = Boolean(src.exclusive) || size > 1 || maxCount === 1;
    if (exclusive) {
        return layout.some(circle => !circle.hasExclusive && circle.remaining >= size) ? 1 : 0;
    }

    const totalFree = layout.reduce((sum, circle) => sum + circle.remaining, 0);
    if (!Number.isFinite(remainingByMax)) return totalFree;
    return Math.max(0, Math.min(remainingByMax, totalFree));
}

export function getRuneAddLimit(runeCircles, sourceCounts, resolveSource, sourceId) {
    const layout = buildRuneLayout(runeCircles, sourceCounts, resolveSource);
    return getRuneAddLimitFromLayout(layout, sourceCounts, resolveSource, sourceId);
}
