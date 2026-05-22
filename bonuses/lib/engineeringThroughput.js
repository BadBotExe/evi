function buildProducerMap(slots) {
    const producedByItem = new Map();
    for (const slot of slots) {
        const produceEntries = Object.entries(slot.produces ?? {});
        if (!produceEntries.length) continue;
        const [itemId] = produceEntries[0];
        producedByItem.set(itemId, slot);
    }
    return producedByItem;
}

function buildConsumerMap(slots, enabledSlotIds, producedByItem) {
    const consumerMap = new Map();
    for (const consumer of slots) {
        if (!enabledSlotIds.has(consumer.id)) continue;
        for (const [itemId, rawAmount] of Object.entries(consumer.consumes ?? {})) {
            const producer = producedByItem.get(itemId);
            if (!producer || !enabledSlotIds.has(producer.id)) continue;
            const amount = Number(rawAmount) || 0;
            if (!(amount > 0)) continue;
            const entries = consumerMap.get(producer.id) ?? [];
            entries.push({ consumer, amount });
            consumerMap.set(producer.id, entries);
        }
    }
    return consumerMap;
}

function sumConsumerDemand(consumers, rateBySlotId) {
    return consumers.reduce((sum, { consumer, amount }) => {
        const consumerRate = Number(rateBySlotId.get(consumer.id));
        const producedAmount = Number(consumer.producedAmount) || 1;
        return Number.isFinite(consumerRate) && producedAmount > 0
            ? sum + (consumerRate * amount / producedAmount)
            : sum;
    }, 0);
}

function sumStableSpend(consumers, stableRateBySlotId) {
    return consumers.reduce((sum, { consumer, amount }) => {
        const consumerRate = Number(stableRateBySlotId.get(consumer.id));
        const producedAmount = Number(consumer.producedAmount) || 1;
        return Number.isFinite(consumerRate) && producedAmount > 0
            ? sum + (consumerRate * amount / producedAmount)
            : sum;
    }, 0);
}

function buildShortageMaps(slots, enabledSlotIds, consumerMap, rateBySlotId) {
    const shortageSourceIdsBySlotId = new Map();
    const contenderIdsBySlotId = new Map();

    for (const slot of slots) {
        if (!enabledSlotIds.has(slot.id)) continue;
        const slotRate = Number(rateBySlotId.get(slot.id));
        const directSources = [];
        const contenderIds = new Set();

        for (const [itemId, rawAmount] of Object.entries(slot.consumes ?? {})) {
            const producerId = slots.find(candidate => Object.prototype.hasOwnProperty.call(candidate.produces ?? {}, itemId))?.id;
            if (!producerId || !enabledSlotIds.has(producerId)) continue;
            const producerConsumers = consumerMap.get(producerId) ?? [];
            const producerDemand = sumConsumerDemand(producerConsumers, rateBySlotId);
            const producerRate = Number(rateBySlotId.get(producerId));
            const amount = Number(rawAmount) || 0;
            const selfDemand = Number.isFinite(slotRate) && amount > 0 && (slot.producedAmount ?? 0) > 0
                ? (slotRate * amount / slot.producedAmount)
                : 0;
            const shortage = producerRate + 1e-9 < Math.max(selfDemand, producerDemand);
            if (!shortage) continue;
            directSources.push(producerId);
            for (const entry of producerConsumers) {
                if (entry.consumer.id !== slot.id) contenderIds.add(entry.consumer.id);
            }
        }

        shortageSourceIdsBySlotId.set(slot.id, directSources);
        contenderIdsBySlotId.set(slot.id, [...contenderIds]);
    }

    return { shortageSourceIdsBySlotId, contenderIdsBySlotId };
}

export function computeEngineeringThroughput({ slots, anchorSlotId, weights }) {
    const orderedSlots = Array.isArray(slots) ? slots : [];
    const anchorIndex = orderedSlots.findIndex(slot => slot.id === anchorSlotId);
    const enabledSlots = anchorIndex >= 0 ? orderedSlots.slice(0, anchorIndex + 1) : [];
    const enabledSlotIds = new Set(enabledSlots.map(slot => slot.id));
    const producedByItem = buildProducerMap(orderedSlots);
    const consumerMap = buildConsumerMap(orderedSlots, enabledSlotIds, producedByItem);
    const rateBySlotId = new Map(
        enabledSlots.map(slot => [slot.id, Number.isFinite(slot.currentRatePerHour) ? slot.currentRatePerHour : 0])
    );

    const anchorWeight = Number(weights?.[anchorSlotId]) || 1;
    const anchorRate = Number(rateBySlotId.get(anchorSlotId)) || 0;
    const targetChainScale = anchorWeight > 0 ? anchorRate / anchorWeight : null;

    const capacities = enabledSlots
        .map(slot => {
            const weight = Number(weights?.[slot.id]);
            const rate = Number(rateBySlotId.get(slot.id));
            if (!(weight > 0) || !(Number.isFinite(rate) && rate >= 0)) return null;
            return {
                slotId: slot.id,
                normalizedCapacity: rate / weight
            };
        })
        .filter(Boolean);

    const chainScale = capacities.length
        ? Math.min(...capacities.map(entry => entry.normalizedCapacity))
        : null;

    const stableRateBySlotId = new Map(
        enabledSlots.map(slot => {
            const weight = Number(weights?.[slot.id]);
            const stableRate = Number.isFinite(chainScale) && weight > 0
                ? chainScale * weight
                : 0;
            return [slot.id, stableRate];
        })
    );

    const { shortageSourceIdsBySlotId, contenderIdsBySlotId } = buildShortageMaps(
        enabledSlots,
        enabledSlotIds,
        consumerMap,
        rateBySlotId
    );

    return orderedSlots.map(slot => {
        const inDependencyChain = enabledSlotIds.has(slot.id);
        if (!inDependencyChain) {
            return {
                slotId: slot.id,
                inDependencyChain: false,
                targetRatePerHour: null,
                rawDemandRatePerHour: null,
                stableOutputRatePerHour: null,
                spendRatePerHour: null,
                netRatePerHour: null,
                lossOutputRatePerHour: null,
                starved: false,
                blockingConsumers: [],
                shortageProducerIds: [],
                contenderIds: []
            };
        }

        const consumers = consumerMap.get(slot.id) ?? [];
        const currentCapacityRatePerHour = Number(rateBySlotId.get(slot.id)) || 0;
        const stableOutputRatePerHour = Number(stableRateBySlotId.get(slot.id)) || 0;
        const spendRatePerHour = sumStableSpend(consumers, stableRateBySlotId);
        const rawDemandRatePerHour = sumConsumerDemand(consumers, rateBySlotId);
        const weight = Number(weights?.[slot.id]);
        const targetRatePerHour = Number.isFinite(targetChainScale) && weight > 0
            ? targetChainScale * weight
            : null;
        const lossOutputRatePerHour = Object.keys(slot.consumes ?? {}).length > 0
            ? Math.max(0, currentCapacityRatePerHour - stableOutputRatePerHour)
            : 0;
        const blocking = Number.isFinite(targetRatePerHour)
            ? targetRatePerHour > currentCapacityRatePerHour + 1e-9
            : false;
        const starved = !blocking
            && Object.keys(slot.consumes ?? {}).length > 0
            && lossOutputRatePerHour > 1e-9;

        return {
            slotId: slot.id,
            inDependencyChain: true,
            targetRatePerHour,
            rawDemandRatePerHour,
            stableOutputRatePerHour,
            spendRatePerHour,
            netRatePerHour: stableOutputRatePerHour - spendRatePerHour,
            lossOutputRatePerHour,
            starved,
            consumerIds: consumers.map(({ consumer }) => consumer.id),
            blockingConsumers: blocking ? consumers.map(({ consumer }) => consumer.id) : [],
            shortageProducerIds: shortageSourceIdsBySlotId.get(slot.id) ?? [],
            contenderIds: contenderIdsBySlotId.get(slot.id) ?? []
        };
    });
}
