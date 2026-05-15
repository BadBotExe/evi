export function clonePlacementContainers(containers) {
    return containers.map(container => ({
        ...container,
        remaining: container.remaining ?? container.slots,
        items: [...(container.items ?? [])]
    }));
}

export function canPlaceExclusiveInContainer(container, item) {
    return container.slot_type === item.slot
        && container.remaining >= (item.size ?? 1)
        && container.items.filter(entry => entry.exclusive).length < container.maxExclusive;
}

export function placePlacementItemInContainer(container, item) {
    container.items.push(item);
    container.remaining -= (item.size ?? 1);
}

export function placeStackablePlacementCount(containers, item, count) {
    let remaining = count;
    for (const container of containers) {
        while (remaining > 0 && container.slot_type === item.slot && container.remaining > 0) {
            placePlacementItemInContainer(container, item);
            remaining -= 1;
        }
        if (remaining === 0) return true;
    }
    return false;
}

export function sortPlacementItems(items) {
    return [...items].sort((a, b) => {
        if ((b.size ?? 1) !== (a.size ?? 1)) return (b.size ?? 1) - (a.size ?? 1);
        if ((b.max ?? 1) !== (a.max ?? 1)) return (a.max ?? 1) - (b.max ?? 1);
        return (a._order ?? 0) - (b._order ?? 0);
    });
}

export function getPlacementItemLimit(item, fallbackCapacity) {
    if (item.max != null) return Number(item.max);
    if (item.exclusive || (item.size ?? 1) > 1) return 1;
    return fallbackCapacity;
}

export function mergePlacementIdSet(source, ids) {
    const next = new Set(source);
    for (const id of ids ?? []) next.add(id);
    return next;
}

export function isPlacementItemBlocked(item, chosenIds, blockedIds) {
    if (blockedIds.has(item.id)) return true;
    for (const excludedId of item.constraint?.excludes ?? []) {
        if (chosenIds.has(excludedId)) return true;
    }
    return false;
}

export function buildPlacementInstances(sourceCounts, resolveSource, slotId = null) {
    const instances = [];
    for (const [sourceId, count] of sourceCounts.entries()) {
        const src = resolveSource(sourceId);
        if (!src || (slotId && src.slot !== slotId)) return null;
        const maxCount = Number(src.max ?? Infinity);
        if (count > maxCount) return null;
        const size = Math.max(1, Number(src.size ?? 1));
        const exclusive = Boolean(src.exclusive) || size > 1 || maxCount === 1;
        for (let i = 0; i < count; i += 1) {
            instances.push({
                id: src.id,
                slot: src.slot,
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

export function canPlaceSelectionInContainers(containers, instances) {
    const nextContainers = clonePlacementContainers(containers);
    if (!nextContainers.length) return false;
    if (!instances) return false;

    const tryPlace = index => {
        if (index >= instances.length) return true;
        const instance = instances[index];
        const tried = new Set();
        const placedItems = nextContainers.flatMap(container => container.items);

        for (let i = 0; i < nextContainers.length; i += 1) {
            const container = nextContainers[i];
            if (container.slot_type !== instance.slot) continue;
            const signature = `${container.id}:${container.remaining}:${container.items.filter(item => item.exclusive).length}`;
            if (tried.has(signature)) continue;
            tried.add(signature);

            if (container.remaining < instance.size) continue;
            if (instance.exclusive && container.items.filter(item => item.exclusive).length >= container.maxExclusive) continue;

            let blocked = false;
            for (const placed of placedItems) {
                if (instance.excludes.includes(placed.id) || placed.excludes.includes(instance.id)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            placePlacementItemInContainer(container, instance);
            if (tryPlace(index + 1)) return true;
            container.items.pop();
            container.remaining += instance.size;
        }

        return false;
    };

    return tryPlace(0);
}
