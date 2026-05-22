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
            entries.push({
                consumerId: consumer.id,
                amount,
                producedAmount: Number(consumer.producedAmount) || 1
            });
            consumerMap.set(producer.id, entries);
        }
    }
    return consumerMap;
}

function buildInputMap(slots, enabledSlotIds, producedByItem) {
    const inputMap = new Map();
    for (const consumer of slots) {
        if (!enabledSlotIds.has(consumer.id)) continue;
        const entries = [];
        for (const [itemId, rawAmount] of Object.entries(consumer.consumes ?? {})) {
            const producer = producedByItem.get(itemId);
            if (!producer || !enabledSlotIds.has(producer.id)) continue;
            const amount = Number(rawAmount) || 0;
            if (!(amount > 0)) continue;
            entries.push({
                producerId: producer.id,
                amount,
                producedAmount: Number(consumer.producedAmount) || 1
            });
        }
        inputMap.set(consumer.id, entries);
    }
    return inputMap;
}

function buildGrossRateMap(enabledSlots) {
    return new Map(
        enabledSlots.map(slot => {
            const rate = Number(slot.currentRatePerHour);
            return [slot.id, Number.isFinite(rate) && rate > 0 ? rate : 0];
        })
    );
}

function sumGrossDemand(consumers, grossRateBySlotId) {
    return consumers.reduce((sum, entry) => {
        const consumerRate = Number(grossRateBySlotId.get(entry.consumerId));
        return Number.isFinite(consumerRate) && entry.producedAmount > 0
            ? sum + (consumerRate * entry.amount / entry.producedAmount)
            : sum;
    }, 0);
}

function prepareThroughputContext(slots, anchorSlotId) {
    const orderedSlots = Array.isArray(slots) ? slots : [];
    const anchorIndex = orderedSlots.findIndex(slot => slot.id === anchorSlotId);
    const enabledSlots = anchorIndex >= 0 ? orderedSlots.slice(0, anchorIndex + 1) : [];
    const enabledSlotIds = new Set(enabledSlots.map(slot => slot.id));
    const producedByItem = buildProducerMap(orderedSlots);
    const consumerMap = buildConsumerMap(orderedSlots, enabledSlotIds, producedByItem);
    const inputMap = buildInputMap(orderedSlots, enabledSlotIds, producedByItem);
    const grossRateBySlotId = buildGrossRateMap(enabledSlots);

    return {
        orderedSlots,
        enabledSlots,
        enabledSlotIds,
        consumerMap,
        inputMap,
        grossRateBySlotId
    };
}

function createInactiveRow(slotId) {
    return {
        slotId,
        inDependencyChain: false,
        targetRatePerHour: null,
        fullTargetRatePerHour: null,
        rawDemandRatePerHour: null,
        grossOutputRatePerHour: null,
        actualOutputRatePerHour: null,
        spendRatePerHour: null,
        netRatePerHour: null,
        lossOutputRatePerHour: null,
        starved: false,
        consumerIds: [],
        shortageProducerIds: [],
        contenderIds: []
    };
}

function mapThroughputRows(context, perSlotData) {
    return context.orderedSlots.map(slot => {
        if (!context.enabledSlotIds.has(slot.id)) {
            return createInactiveRow(slot.id);
        }

        const slotData = perSlotData.get(slot.id);
        const consumerIds = (context.consumerMap.get(slot.id) ?? []).map(entry => entry.consumerId);
        const inputProducerIds = (context.inputMap.get(slot.id) ?? []).map(entry => entry.producerId);

        return {
            slotId: slot.id,
            inDependencyChain: true,
            targetRatePerHour: slotData.targetRatePerHour,
            fullTargetRatePerHour: slotData.fullTargetRatePerHour,
            rawDemandRatePerHour: slotData.rawDemandRatePerHour,
            grossOutputRatePerHour: slotData.grossOutputRatePerHour,
            actualOutputRatePerHour: slotData.actualOutputRatePerHour,
            spendRatePerHour: slotData.spendRatePerHour,
            netRatePerHour: slotData.netRatePerHour,
            lossOutputRatePerHour: slotData.lossOutputRatePerHour,
            starved: slotData.starved,
            consumerIds,
            blockingConsumers: consumerIds,
            shortageProducerIds: slotData.shortageProducerIds,
            contenderIds: slotData.contenderIds,
            inputProducerIds
        };
    });
}

function collectGameModelShortages(slotId, inputMap, consumerMap, netRateBySlotId) {
    const shortages = [];
    const contenders = new Set();

    for (const input of inputMap.get(slotId) ?? []) {
        if ((Number(netRateBySlotId.get(input.producerId)) || 0) >= -1e-9) {
            continue;
        }
        shortages.push(input.producerId);
        for (const contender of consumerMap.get(input.producerId) ?? []) {
            if (contender.consumerId !== slotId) {
                contenders.add(contender.consumerId);
            }
        }
    }

    return {
        shortageProducerIds: shortages,
        contenderIds: [...contenders]
    };
}

function computeGameModelRows(context) {
    const rawDemandBySlotId = new Map();
    const spendRateBySlotId = new Map();
    const netRateBySlotId = new Map();

    for (const slot of context.enabledSlots) {
        const consumerEntries = context.consumerMap.get(slot.id) ?? [];
        const rawDemandRatePerHour = sumGrossDemand(consumerEntries, context.grossRateBySlotId);
        const grossOutputRatePerHour = Number(context.grossRateBySlotId.get(slot.id)) || 0;
        rawDemandBySlotId.set(slot.id, rawDemandRatePerHour);
        spendRateBySlotId.set(slot.id, rawDemandRatePerHour);
        netRateBySlotId.set(slot.id, grossOutputRatePerHour - rawDemandRatePerHour);
    }

    const perSlotData = new Map();
    for (const slot of context.enabledSlots) {
        const grossOutputRatePerHour = Number(context.grossRateBySlotId.get(slot.id)) || 0;
        const spendRatePerHour = Number(spendRateBySlotId.get(slot.id)) || 0;
        const netRatePerHour = Number(netRateBySlotId.get(slot.id)) || 0;
        const consumerIds = (context.consumerMap.get(slot.id) ?? []).map(entry => entry.consumerId);
        const shortageInfo = collectGameModelShortages(slot.id, context.inputMap, context.consumerMap, netRateBySlotId);

        perSlotData.set(slot.id, {
            targetRatePerHour: consumerIds.length ? (Number(rawDemandBySlotId.get(slot.id)) || 0) : grossOutputRatePerHour,
            fullTargetRatePerHour: Number(rawDemandBySlotId.get(slot.id)) || 0,
            rawDemandRatePerHour: Number(rawDemandBySlotId.get(slot.id)) || 0,
            grossOutputRatePerHour,
            actualOutputRatePerHour: grossOutputRatePerHour,
            spendRatePerHour,
            netRatePerHour,
            lossOutputRatePerHour: Math.max(0, spendRatePerHour - grossOutputRatePerHour),
            starved: netRatePerHour < -1e-9,
            shortageProducerIds: shortageInfo.shortageProducerIds,
            contenderIds: shortageInfo.contenderIds
        });
    }

    return mapThroughputRows(context, perSlotData);
}

function buildAllocationsFromActualOutputs(enabledSlots, consumerMap, actualRateBySlotId) {
    const allocationsByProducerId = new Map();
    const allocationsByConsumerId = new Map();

    for (const slot of enabledSlots) {
        const producerId = slot.id;
        const consumerEntries = consumerMap.get(producerId) ?? [];
        const producerAllocations = [];

        for (const entry of consumerEntries) {
            const consumerRate = Number(actualRateBySlotId.get(entry.consumerId));
            const allocatedInput = Number.isFinite(consumerRate) && entry.producedAmount > 0
                ? (consumerRate * entry.amount / entry.producedAmount)
                : 0;
            const allocation = {
                consumerId: entry.consumerId,
                allocatedInput,
                amount: entry.amount,
                producedAmount: entry.producedAmount
            };
            producerAllocations.push(allocation);
            const consumerAllocations = allocationsByConsumerId.get(entry.consumerId) ?? [];
            consumerAllocations.push({
                producerId,
                allocatedInput,
                amount: entry.amount,
                producedAmount: entry.producedAmount
            });
            allocationsByConsumerId.set(entry.consumerId, consumerAllocations);
        }

        allocationsByProducerId.set(producerId, producerAllocations);
    }

    return { allocationsByProducerId, allocationsByConsumerId };
}

function solveSteadyStateActualOutputs(context) {
    const actualRateBySlotId = new Map(context.grossRateBySlotId);
    let previousSignature = '';
    let iterations = 0;
    const reverseSlots = [...context.enabledSlots].reverse();
    const epsilon = 1e-9;

    while (iterations < 50) {
        iterations += 1;
        for (const slot of reverseSlots) {
            const availableOutput = Number(actualRateBySlotId.get(slot.id)) || 0;
            const consumers = context.consumerMap.get(slot.id) ?? [];
            const totalDemand = consumers.reduce((sum, entry) => {
                const consumerRate = Number(actualRateBySlotId.get(entry.consumerId)) || 0;
                return sum + (entry.producedAmount > 0
                    ? (consumerRate * entry.amount / entry.producedAmount)
                    : 0);
            }, 0);

            if (!(totalDemand > availableOutput + epsilon)) {
                continue;
            }

            const scale = totalDemand > 0 ? availableOutput / totalDemand : 0;
            for (const entry of consumers) {
                const consumerRate = Number(actualRateBySlotId.get(entry.consumerId)) || 0;
                actualRateBySlotId.set(entry.consumerId, consumerRate * scale);
            }
        }

        const signature = context.enabledSlots
            .map(slot => Number(actualRateBySlotId.get(slot.id) ?? 0).toFixed(9))
            .join('|');
        if (signature === previousSignature) {
            break;
        }
        previousSignature = signature;
    }

    return {
        actualRateBySlotId,
        ...buildAllocationsFromActualOutputs(context.enabledSlots, context.consumerMap, actualRateBySlotId)
    };
}

function collectSteadyStateShortages(slotId, context, solveResult) {
    const epsilon = 1e-9;
    const shortages = [];
    const contenders = new Set();
    const inputs = solveResult.allocationsByConsumerId.get(slotId) ?? [];
    const grossRate = Number(context.grossRateBySlotId.get(slotId)) || 0;
    const actualRate = Number(solveResult.actualRateBySlotId.get(slotId)) || 0;

    for (const input of inputs) {
        const grossRequestedInput = input.amount > 0 && input.producedAmount > 0
            ? (grossRate * input.amount / input.producedAmount)
            : 0;
        const producerActualOutput = Number(solveResult.actualRateBySlotId.get(input.producerId)) || 0;
        const otherConsumersSpend = (solveResult.allocationsByProducerId.get(input.producerId) ?? [])
            .filter(entry => entry.consumerId !== slotId)
            .reduce((sum, entry) => sum + entry.allocatedInput, 0);
        const availableForSlot = Math.max(0, producerActualOutput - otherConsumersSpend);
        const supportedOutputRate = input.amount > 0 && input.producedAmount > 0
            ? (availableForSlot * input.producedAmount / input.amount)
            : Infinity;

        if (availableForSlot + epsilon < grossRequestedInput && supportedOutputRate <= actualRate + epsilon) {
            shortages.push(input.producerId);
            for (const contender of context.consumerMap.get(input.producerId) ?? []) {
                if (contender.consumerId !== slotId) {
                    contenders.add(contender.consumerId);
                }
            }
        }
    }

    return {
        shortageProducerIds: [...new Set(shortages)],
        contenderIds: [...contenders]
    };
}

function computeSteadyStateRows(context) {
    const solveResult = solveSteadyStateActualOutputs(context);
    const perSlotData = new Map();

    for (const slot of context.enabledSlots) {
        const consumerEntries = context.consumerMap.get(slot.id) ?? [];
        const rawDemandRatePerHour = sumGrossDemand(consumerEntries, context.grossRateBySlotId);
        const grossOutputRatePerHour = Number(context.grossRateBySlotId.get(slot.id)) || 0;
        const actualOutputRatePerHour = Number(solveResult.actualRateBySlotId.get(slot.id)) || 0;
        const spendRatePerHour = (solveResult.allocationsByProducerId.get(slot.id) ?? [])
            .reduce((sum, entry) => sum + entry.allocatedInput, 0);
        const lossOutputRatePerHour = Math.max(0, grossOutputRatePerHour - actualOutputRatePerHour);
        const starved = lossOutputRatePerHour > 1e-9;
        const shortageInfo = starved
            ? collectSteadyStateShortages(slot.id, context, solveResult)
            : { shortageProducerIds: [], contenderIds: [] };

        perSlotData.set(slot.id, {
            targetRatePerHour: consumerEntries.length ? rawDemandRatePerHour : actualOutputRatePerHour,
            fullTargetRatePerHour: rawDemandRatePerHour,
            rawDemandRatePerHour,
            grossOutputRatePerHour,
            actualOutputRatePerHour,
            spendRatePerHour,
            netRatePerHour: actualOutputRatePerHour - spendRatePerHour,
            lossOutputRatePerHour,
            starved,
            shortageProducerIds: shortageInfo.shortageProducerIds,
            contenderIds: shortageInfo.contenderIds
        });
    }

    return mapThroughputRows(context, perSlotData);
}

export function computeEngineeringThroughput({ slots, anchorSlotId }) {
    return computeGameModelRows(prepareThroughputContext(slots, anchorSlotId));
}

export function computeEngineeringSteadyStateThroughput({ slots, anchorSlotId }) {
    return computeSteadyStateRows(prepareThroughputContext(slots, anchorSlotId));
}
