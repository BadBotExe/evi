function buildProducerMap(slots) {
    const producedByItem = new Map();
    for (const slot of slots) {
        const produceEntries = Object.entries(slot.produces ?? {});
        if (!produceEntries.length) continue;
        const [itemId, amount] = produceEntries[0];
        producedByItem.set(itemId, {
            slot,
            slotId: slot.id,
            amount: Number(amount) || 1
        });
    }
    return producedByItem;
}

function roundedRatePerHourValue(value) {
    if (!Number.isFinite(value)) return null;
    const digits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
    return Number(value.toFixed(digits));
}

function roundedPercentValue(value) {
    if (!Number.isFinite(value)) return null;
    return Math.ceil(value);
}

function compareWaitingSlots(a, b) {
    if (a.nextFinishAt !== b.nextFinishAt) return a.nextFinishAt - b.nextFinishAt;
    if (a.cycleTime !== b.cycleTime) return a.cycleTime - b.cycleTime;
    return a.order - b.order;
}

function chooseSimulationDuration(states) {
    const activeTimes = states
        .map(state => Number(state.cycleTime))
        .filter(value => Number.isFinite(value) && value > 0);
    const slowest = activeTimes.length ? Math.max(...activeTimes) : 0;
    const fastest = activeTimes.length ? Math.min(...activeTimes) : 0;
    return Math.min(
        24 * 3600,
        Math.max(
            3600,
            slowest * 12,
            fastest * 600
        )
    );
}

function simulateThroughput(slots, enabledSlotIds, producedByItem) {
    const enabledSlots = slots.filter(slot => enabledSlotIds.has(slot.id));
    const states = enabledSlots.map((slot, order) => ({
        ...slot,
        order,
        cycleTime: Number(slot.currentReducedTime),
        inventory: 0,
        activeUntil: null,
        craftsStarted: 0,
        craftsCompleted: 0,
        producedTotal: 0,
        consumedByItem: {},
        waitingSince: null,
        waitingTime: 0,
        shortageCounts: {},
        contenderCounts: {}
    }));
    const stateById = new Map(states.map(state => [state.id, state]));
    const totalDuration = chooseSimulationDuration(states);
    const measurementStart = totalDuration / 2;
    let now = 0;
    let measurementCaptured = false;

    const waitingTimeAt = (state, time) => state.waitingTime + (
        state.waitingSince !== null ? Math.max(0, time - state.waitingSince) : 0
    );

    const consumedTotal = (state) => Object.values(state.consumedByItem).reduce((sum, value) => sum + value, 0);

    const captureMeasurementStart = (time) => {
        if (measurementCaptured) return;
        for (const state of states) {
            state.measurementProducedStart = state.producedTotal;
            state.measurementConsumedStart = consumedTotal(state);
            state.measurementWaitingStart = waitingTimeAt(state, time);
        }
        measurementCaptured = true;
    };

    const markWaiting = (state, inputId) => {
        const producerSlotId = producedByItem.get(inputId)?.slotId;
        if (!producerSlotId || !enabledSlotIds.has(producerSlotId)) return;
        state.shortageCounts[producerSlotId] = (state.shortageCounts[producerSlotId] ?? 0) + 1;

        const contenders = states.filter(other => {
            if (other.id === state.id) return false;
            if (other.activeUntil !== null) return false;
            return Object.prototype.hasOwnProperty.call(other.consumes ?? {}, inputId);
        });
        for (const contender of contenders) {
            state.contenderCounts[contender.id] = (state.contenderCounts[contender.id] ?? 0) + 1;
        }
    };

    const canStart = (state) => {
        if (state.activeUntil !== null) return false;
        if (!(Number.isFinite(state.cycleTime) && state.cycleTime > 0)) return false;
        for (const [inputId, rawAmount] of Object.entries(state.consumes ?? {})) {
            const amount = Number(rawAmount) || 0;
            const producerSlotId = producedByItem.get(inputId)?.slotId;
            const producerState = producerSlotId ? stateById.get(producerSlotId) : null;
            if (!producerState || producerState.inventory < amount) {
                if (state.waitingSince === null) {
                    state.waitingSince = now;
                }
                markWaiting(state, inputId);
                return false;
            }
        }
        return true;
    };

    const startCraft = (state) => {
        for (const [inputId, rawAmount] of Object.entries(state.consumes ?? {})) {
            const amount = Number(rawAmount) || 0;
            const producerSlotId = producedByItem.get(inputId)?.slotId;
            const producerState = producerSlotId ? stateById.get(producerSlotId) : null;
            if (producerState) {
                producerState.inventory -= amount;
                producerState.consumedByItem[inputId] = (producerState.consumedByItem[inputId] ?? 0) + amount;
            }
        }
        if (state.waitingSince !== null) {
            state.waitingTime += Math.max(0, now - state.waitingSince);
            state.waitingSince = null;
        }
        state.craftsStarted += 1;
        state.activeUntil = now + state.cycleTime;
    };

    const startReadyCrafts = () => {
        let started = false;
        while (true) {
            const readyStates = states
                .filter(state => canStart(state))
                .map(state => ({
                    ...state,
                    nextFinishAt: now + state.cycleTime
                }))
                .sort(compareWaitingSlots);

            if (!readyStates.length) break;
            const nextState = stateById.get(readyStates[0].id);
            if (!nextState || !canStart(nextState)) break;
            startCraft(nextState);
            started = true;
        }
        return started;
    };

    startReadyCrafts();

    while (now < totalDuration) {
        const nextCompletion = states
            .filter(state => Number.isFinite(state.activeUntil))
            .reduce((min, state) => Math.min(min, state.activeUntil), Number.POSITIVE_INFINITY);

        if (!Number.isFinite(nextCompletion)) break;
        if (!measurementCaptured && nextCompletion >= measurementStart) {
            captureMeasurementStart(measurementStart);
        }
        now = nextCompletion;

        for (const state of states) {
            if (state.activeUntil !== nextCompletion) continue;
            state.activeUntil = null;
            state.craftsCompleted += 1;
            state.producedTotal += state.producedAmount;
            state.inventory += state.producedAmount;
        }

        startReadyCrafts();
    }

    if (!measurementCaptured) {
        captureMeasurementStart(Math.min(measurementStart, now));
    }

    for (const state of states) {
        if (state.waitingSince !== null) {
            state.waitingTime += Math.max(0, totalDuration - state.waitingSince);
        }
    }

    const measurementDurationHours = Math.max((totalDuration - measurementStart) / 3600, 1 / 3600);
    const results = new Map();
    for (const state of states) {
        const shortageProducerIds = Object.entries(state.shortageCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([slotId]) => slotId);
        const contenderIds = Object.entries(state.contenderCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([slotId]) => slotId);
        const producedDuringMeasurement = Math.max(0, state.producedTotal - (state.measurementProducedStart ?? 0));
        const consumedDuringMeasurement = Math.max(0, consumedTotal(state) - (state.measurementConsumedStart ?? 0));
        const waitingDuringMeasurement = Math.max(0, state.waitingTime - (state.measurementWaitingStart ?? 0));
        const realizedOutputRatePerHour = producedDuringMeasurement / measurementDurationHours;
        const theoreticalOutputRatePerHour = Number.isFinite(state.currentRatePerHour)
            ? state.currentRatePerHour
            : 0;
        results.set(state.id, {
            producedTotal: producedDuringMeasurement,
            realizedOutputRatePerHour,
            realizedSpendRatePerHour: consumedDuringMeasurement / measurementDurationHours,
            lossOutputRatePerHour: Math.max(0, theoreticalOutputRatePerHour - realizedOutputRatePerHour),
            waitingTime: waitingDuringMeasurement,
            starved: waitingDuringMeasurement > 1e-9 && Object.keys(state.consumes ?? {}).length > 0,
            shortageProducerIds,
            contenderIds
        });
    }
    return { results, durationHours: measurementDurationHours };
}

export const engineeringPlannerMethods = {
    engineeringPlannerConfig() { return this.data?.engineeringPlanner ?? null; },

    engineeringPlannerStateSignature() {
        const planner = this.engineeringPlannerState ?? {};
        const throughputSpeeds = this.engineeringPlannerConfig()?.slots?.map(slot => `${slot.id}:${planner.throughputSpeeds?.[slot.id] ?? ''}`).join('|') ?? '';
        const throughputItems = this.engineeringPlannerConfig()?.slots?.map(slot => `${slot.id}:${planner.throughputItemsPerHour?.[slot.id] ?? ''}`).join('|') ?? '';
        return [
            planner.mode ?? '',
            planner.inputMode ?? '',
            planner.anchorSlot ?? '',
            planner.anchorSpeed ?? '',
            planner.anchorItemsPerHour ?? '',
            planner.slotUpgradeLevel ?? '',
            throughputSpeeds,
            throughputItems
        ].join('~');
    },

    engineeringPlannerMode() {
        return this.engineeringPlannerState?.mode === 'throughput' ? 'throughput' : 'requirements';
    },

    engineeringPlannerInputMode() {
        return this.engineeringPlannerState?.inputMode === 'percent' ? 'percent' : 'items';
    },

    engineeringPlannerSlotUpgrade() {
        const config = this.engineeringPlannerConfig()?.slot_upgrade;
        if (!config?.source_id) return null;
        const src = this.data?.sources?.find(source => source.id === config.source_id) ?? null;
        if (!src) return null;
        const multiplier = Number(src.bonuses?.find(b => b.bonus === 'engineer_production_speed' && b.unit_type === 'multiplier')?.value ?? 1);
        const maxLevel = (src.bonuses ?? [])
            .filter(b => b.format === 'plain' && /^Cost \(Tier \d+\)$/.test(b.bonus))
            .length;
        return {
            sourceId: config.source_id,
            defaultLevel: Number(config.default_level ?? 0),
            name: src.name,
            multiplier,
            maxLevel
        };
    },

    engineeringPlannerDefaultAnchorSlot() {
        return this.engineeringPlannerConfig()?.default_anchor_slot
            ?? this.engineeringPlannerConfig()?.slots?.[0]?.id
            ?? null;
    },

    engineeringPlannerSlotById(slotId) {
        return this.engineeringPlannerConfig()?.slots?.find(slot => slot.id === slotId) ?? null;
    },

    engineeringPlannerSlotByKey(slotKey) {
        return this.engineeringPlannerConfig()?.slots?.find(slot => slot.key === slotKey) ?? null;
    },

    engineeringPlannerSpeedParamKey(slotOrId) {
        const slot = typeof slotOrId === 'string'
            ? this.engineeringPlannerSlotById(slotOrId)
            : slotOrId;
        return slot?.key ? `ev${slot.key}` : null;
    },

    engineeringPlannerItemsParamKey(slotOrId) {
        const slot = typeof slotOrId === 'string'
            ? this.engineeringPlannerSlotById(slotOrId)
            : slotOrId;
        return slot?.key ? `ei${slot.key}` : null;
    },

    engineeringPlannerSlots() {
        const slots = this.engineeringPlannerConfig()?.slots ?? [];
        const weights = this.engineeringPlannerWeights();
        return slots.map(slot => ({
            ...slot,
            weight: weights[slot.id] ?? null,
            recipe: this.engineeringRecipeLabel(slot)
        }));
    },

    isEngineeringProductionBonus(bonusId) {
        if (!bonusId) return false;
        if (bonusId === 'engineer_production_speed') return !!this.engineeringPlannerConfig();
        return this.engineeringPlannerSlots().some(slot => slot.bonus === bonusId);
    },

    engineeringRecipeLabel(slot) {
        const consumes = Object.entries(slot.consumes ?? {});
        if (!consumes.length) return 'Time only';
        return consumes.map(([itemId, amount]) => `${amount} ${this.engineeringItemLabel(itemId, amount)}`).join(' + ');
    },

    engineeringItemLabel(itemId, amount = 1) {
        const base = this.data?.items?.get(itemId)?.name
            ?? this.categoryLabel(itemId)
            ?? itemId;
        return amount === 1 ? base : `${base}${base.endsWith('s') ? '' : 's'}`;
    },

    engineeringPlannerWeights(anchorSlotId = this.engineeringPlannerState.anchorSlot) {
        const slots = this.engineeringPlannerConfig()?.slots ?? [];
        if (!slots.length) return {};

        const producers = buildProducerMap(slots);
        const anchorSlot = slots.find(slot => slot.id === anchorSlotId) ?? null;
        const [anchorItemId] = Object.keys(anchorSlot?.produces ?? {});
        if (!anchorItemId) return {};

        const requirements = { [anchorItemId]: 1 };
        const expandRequirements = (itemId, amountNeeded) => {
            const producer = producers.get(itemId);
            if (!producer) return;
            const producedAmount = producer.amount || 1;
            for (const [inputId, inputAmount] of Object.entries(producer.slot.consumes ?? {})) {
                const inputRequired = amountNeeded * (Number(inputAmount) || 0) / producedAmount;
                requirements[inputId] = (requirements[inputId] ?? 0) + inputRequired;
                expandRequirements(inputId, inputRequired);
            }
        };
        expandRequirements(anchorItemId, 1);

        const weights = {};
        for (const slot of slots) {
            const [producedItemId] = Object.keys(slot.produces ?? {});
            if (!producedItemId) continue;
            if (requirements[producedItemId] > 0) {
                weights[slot.id] = requirements[producedItemId];
            }
        }
        return weights;
    },

    engineeringProductionMaxPercent(bonusId) {
        if (!this.data?.sources?.length) return 0;
        return this.data.sources
            .filter(src => src.type === 'engineering_production')
            .reduce((total, src) => total + src.bonuses
                .filter(b => b.bonus === bonusId && (b.unit_type ?? 'flat') === 'percent')
                .reduce((sum, b) => sum + this._resolveValue(b), 0), 0);
    },

    engineeringPlannerThroughputSpeed(slotId) {
        if (this.engineeringPlannerInputMode() === 'items') {
            const resolvedSlot = this.engineeringPlannerResolvedSlotBase(slotId);
            const rawRatePerHour = this.engineeringPlannerState?.throughputItemsPerHour?.[slotId];
            if (rawRatePerHour == null || rawRatePerHour === '') return 0;
            const ratePerHour = Number(rawRatePerHour);
            return this.engineeringPlannerSpeedFromRate(
                resolvedSlot?.effectiveBaseTime,
                Number.isFinite(ratePerHour) ? ratePerHour : 0,
                resolvedSlot?.producedAmount
            );
        }
        const value = Number(this.engineeringPlannerState?.throughputSpeeds?.[slotId] ?? 0);
        return Number.isFinite(value) ? value : 0;
    },

    engineeringPlannerResolvedSlotBase(slotId) {
        const slots = this.engineeringPlannerConfig()?.slots ?? [];
        const slotUpgrade = this.engineeringPlannerSlotUpgrade();
        const slotUpgradeLevel = Math.max(0, Math.min(
            Number(this.engineeringPlannerState?.slotUpgradeLevel ?? 0),
            slotUpgrade?.maxLevel ?? 0
        ));
        const slotIndex = slots.findIndex(slot => slot.id === slotId);
        const slot = slotIndex >= 0 ? slots[slotIndex] : null;
        if (!slot) return null;
        const rawBaseTime = Number(slot.base_time);
        const slotUpgradeMultiplier = slotIndex < slotUpgradeLevel ? Number(slotUpgrade?.multiplier ?? 1) : 1;
        const effectiveBaseTime = rawBaseTime / Math.max(slotUpgradeMultiplier, 1);
        const producedAmount = Number(Object.values(slot.produces ?? {})[0]) || 1;
        return { effectiveBaseTime, producedAmount };
    },

    engineeringPlannerAnchorSpeed() {
        if (this.engineeringPlannerInputMode() === 'items') {
            const slotId = this.engineeringPlannerState?.anchorSlot;
            const resolvedSlot = this.engineeringPlannerResolvedSlotBase(slotId);
            const rawRatePerHour = this.engineeringPlannerState?.anchorItemsPerHour;
            if (rawRatePerHour == null || rawRatePerHour === '') return 0;
            const ratePerHour = Number(rawRatePerHour);
            return this.engineeringPlannerSpeedFromRate(
                resolvedSlot?.effectiveBaseTime,
                Number.isFinite(ratePerHour) ? ratePerHour : 0,
                resolvedSlot?.producedAmount
            );
        }
        const value = Number(this.engineeringPlannerState?.anchorSpeed ?? 0);
        return Number.isFinite(value) ? value : 0;
    },

    engineeringPlannerRatePerHour(effectiveBaseTime, speed, producedAmount = 1) {
        if (!(effectiveBaseTime > 0)) return null;
        const speedMultiplier = 1 + Number(speed ?? 0) / 100;
        if (!(speedMultiplier > 0)) return null;
        return (3600 * speedMultiplier * producedAmount) / effectiveBaseTime;
    },

    engineeringPlannerRequiredSpeedForRate(effectiveBaseTime, ratePerHour, producedAmount = 1) {
        if (!(effectiveBaseTime > 0) || !(producedAmount > 0) || !Number.isFinite(ratePerHour) || ratePerHour <= 0) {
            return 0;
        }
        return (((ratePerHour / 3600) * effectiveBaseTime) / producedAmount - 1) * 100;
    },

    engineeringPlannerSpeedFromRate(effectiveBaseTime, ratePerHour, producedAmount = 1) {
        if (ratePerHour == null || ratePerHour === '') {
            return 0;
        }
        if (!(effectiveBaseTime > 0) || !(producedAmount > 0) || !Number.isFinite(ratePerHour)) {
            return 0;
        }
        if (ratePerHour <= 0) {
            return 0;
        }
        return (((ratePerHour / 3600) * effectiveBaseTime) / producedAmount - 1) * 100;
    },

    engineeringPlannerResolvedSlots() {
        const signature = this.engineeringPlannerStateSignature();
        if (this._engineeringPlannerResolvedSlotsCache?.signature === signature) {
            return this._engineeringPlannerResolvedSlotsCache.value;
        }
        const slots = this.engineeringPlannerConfig()?.slots ?? [];
        const slotUpgrade = this.engineeringPlannerSlotUpgrade();
        const slotUpgradeLevel = Math.max(0, Math.min(
            Number(this.engineeringPlannerState?.slotUpgradeLevel ?? 0),
            slotUpgrade?.maxLevel ?? 0
        ));

        const resolved = slots.map((slot, slotIndex) => {
            const rawBaseTime = Number(slot.base_time);
            const slotUpgradeMultiplier = slotIndex < slotUpgradeLevel ? Number(slotUpgrade?.multiplier ?? 1) : 1;
            const effectiveBaseTime = rawBaseTime / Math.max(slotUpgradeMultiplier, 1);
            const producedAmount = Number(Object.values(slot.produces ?? {})[0]) || 1;
            const currentSpeed = this.engineeringPlannerThroughputSpeed(slot.id);
            const currentRatePerHour = this.engineeringPlannerRatePerHour(effectiveBaseTime, currentSpeed, producedAmount);
            const currentReducedTime = Number.isFinite(currentRatePerHour) && currentRatePerHour > 0
                ? (3600 * producedAmount) / currentRatePerHour
                : null;
            const maxSpeed = this.engineeringProductionMaxPercent(slot.bonus);
            const maxRatePerHour = this.engineeringPlannerRatePerHour(effectiveBaseTime, maxSpeed, producedAmount);
            const maxReducedTime = Number.isFinite(maxRatePerHour) && maxRatePerHour > 0
                ? (3600 * producedAmount) / maxRatePerHour
                : null;
            const [producedItemId] = Object.keys(slot.produces ?? {});

            return {
                ...slot,
                recipe: this.engineeringRecipeLabel(slot),
                rawBaseTime,
                effectiveBaseTime,
                slotUpgradeMultiplier,
                producedAmount,
                producedItemId,
                currentSpeed,
                currentReducedTime,
                currentRatePerHour,
                maxSpeed,
                maxReducedTime,
                maxRatePerHour
            };
        });
        this._engineeringPlannerResolvedSlotsCache = { signature, value: resolved };
        return resolved;
    },

    engineeringPlannerRequirementRows() {
        const signature = `requirements~${this.engineeringPlannerStateSignature()}`;
        if (this._engineeringPlannerRowsCache?.signature === signature) {
            return this._engineeringPlannerRowsCache.value;
        }
        const planner = this.engineeringPlannerState;
        const anchorSlot = planner.anchorSlot;
        const weights = this.engineeringPlannerWeights(anchorSlot);
        const slots = this.engineeringPlannerResolvedSlots().map(slot => ({
            ...slot,
            weight: weights[slot.id] ?? null
        }));
        const anchorConfig = slots.find(slot => slot.id === anchorSlot) ?? null;
        const anchorSpeed = this.engineeringPlannerAnchorSpeed();
        const anchorWeight = Number(anchorConfig?.weight) || null;
        const anchorRatePerHour = anchorConfig
            ? this.engineeringPlannerRatePerHour(anchorConfig.effectiveBaseTime, anchorSpeed, anchorConfig.producedAmount)
            : null;
        const chainScale = Number.isFinite(anchorRatePerHour) && anchorRatePerHour > 0 && anchorWeight
            ? (anchorRatePerHour / 3600) / anchorWeight
            : null;

        const rows = slots.map(slot => {
            const inDependencyChain = Number(slot.weight) > 0;

            let targetRatePerSecond = null;
            let targetReducedTime = null;
            let targetSpeed = null;
            let feasible = null;
            let speedGap = null;

            if (inDependencyChain && chainScale && slot.effectiveBaseTime > 0) {
                targetRatePerSecond = chainScale * slot.weight;
                const targetCyclesPerSecond = targetRatePerSecond / slot.producedAmount;
                const rawTargetReducedTime = targetCyclesPerSecond > 0 ? 1 / targetCyclesPerSecond : null;
                const rawTargetSpeed = targetCyclesPerSecond > 0
                    ? ((slot.effectiveBaseTime * targetCyclesPerSecond) - 1) * 100
                    : null;
                targetReducedTime = rawTargetReducedTime;
                targetSpeed = rawTargetSpeed;

                if (Number.isFinite(targetSpeed)) {
                    const requiredSpeed = Math.max(0, targetSpeed);
                    if (targetSpeed < 0) {
                        targetSpeed = 0;
                        targetReducedTime = slot.effectiveBaseTime;
                        targetRatePerSecond = slot.producedAmount / slot.effectiveBaseTime;
                    }
                    feasible = slot.maxSpeed >= requiredSpeed;
                    speedGap = slot.maxSpeed - requiredSpeed;
                }
            }

            return {
                ...slot,
                weight: slot.weight,
                inDependencyChain,
                targetSpeed,
                targetReducedTime,
                targetRatePerHour: Number.isFinite(targetRatePerSecond) ? targetRatePerSecond * 3600 : null,
                feasible,
                speedGap
            };
        });
        this._engineeringPlannerRowsCache = { signature, value: rows };
        return rows;
    },

    engineeringPlannerThroughputRows() {
        const signature = `throughput~${this.engineeringPlannerStateSignature()}`;
        if (this._engineeringPlannerRowsCache?.signature === signature) {
            return this._engineeringPlannerRowsCache.value;
        }
        const slots = this.engineeringPlannerResolvedSlots();
        const anchorSlotId = this.engineeringPlannerState?.anchorSlot;
        const anchorIndex = slots.findIndex(slot => slot.id === anchorSlotId);
        const enabledSlots = anchorIndex >= 0 ? slots.slice(0, anchorIndex + 1) : [];
        const enabledSlotIds = new Set(enabledSlots.map(slot => slot.id));
        const weights = this.engineeringPlannerWeights(anchorSlotId);
        const anchorSlot = enabledSlots.find(slot => slot.id === anchorSlotId) ?? null;
        const anchorWeight = Number(weights[anchorSlotId]) || 1;
        const targetChainScale = anchorSlot && Number.isFinite(anchorSlot.currentRatePerHour) && anchorWeight > 0
            ? anchorSlot.currentRatePerHour / anchorWeight
            : null;
        const producedByItem = buildProducerMap(slots);
        const simulation = simulateThroughput(slots, enabledSlotIds, producedByItem);
        const simulationResults = simulation.results;
        const consumerMap = new Map();

        for (const consumer of enabledSlots) {
            for (const [itemId, rawAmount] of Object.entries(consumer.consumes ?? {})) {
                const producerSlotId = producedByItem.get(itemId)?.slotId;
                if (!producerSlotId || !enabledSlotIds.has(producerSlotId)) continue;
                const amount = Number(rawAmount) || 0;
                if (!(amount > 0)) continue;
                const entries = consumerMap.get(producerSlotId) ?? [];
                entries.push({ consumer, amount });
                consumerMap.set(producerSlotId, entries);
            }
        }

        const capacities = enabledSlots
            .map(slot => {
                const weight = Number(weights[slot.id]);
                const rate = Number(slot.currentRatePerHour);
                if (!(weight > 0) || !(Number.isFinite(rate) && rate >= 0)) return null;
                return {
                    slotId: slot.id,
                    weight,
                    normalizedCapacity: rate / weight
                };
            })
            .filter(Boolean);
        const chainScale = capacities.length
            ? Math.min(...capacities.map(entry => entry.normalizedCapacity))
            : null;
        const bottleneckSlotIds = new Set(
            capacities
                .filter(entry => chainScale !== null && Math.abs(entry.normalizedCapacity - chainScale) <= 1e-9)
                .map(entry => entry.slotId)
        );

        const rows = slots.map(slot => {
            const inDependencyChain = enabledSlotIds.has(slot.id);
            const consumers = inDependencyChain ? (consumerMap.get(slot.id) ?? []) : [];
            const rawDemandRatePerHour = inDependencyChain
                ? consumers.reduce((sum, { consumer, amount }) => {
                    const consumerRate = Number(consumer.currentRatePerHour);
                    const producedAmount = Number(consumer.producedAmount) || 1;
                    return Number.isFinite(consumerRate) && producedAmount > 0
                        ? sum + (consumerRate * amount / producedAmount)
                        : sum;
                }, 0)
                : null;
            const weight = Number(weights[slot.id]);
            const currentCapacityRatePerHour = Number(slot.currentRatePerHour) || 0;
            const targetRatePerHour = inDependencyChain && Number.isFinite(targetChainScale) && weight > 0
                ? targetChainScale * weight
                : null;
            const simulationRow = inDependencyChain ? simulationResults.get(slot.id) : null;
            const stableOutputRatePerHour = inDependencyChain && Number.isFinite(chainScale) && weight > 0
                ? chainScale * weight
                : 0;
            const produceRatePerHour = inDependencyChain
                ? stableOutputRatePerHour
                : null;
            const spendRatePerHour = inDependencyChain
                ? consumers.reduce((sum, { consumer, amount }) => {
                    const consumerWeight = Number(weights[consumer.id]);
                    const consumerOutput = Number.isFinite(chainScale) && consumerWeight > 0
                        ? chainScale * consumerWeight
                        : 0;
                    const producedAmount = Number(consumer.producedAmount) || 1;
                    return producedAmount > 0
                        ? sum + (consumerOutput * amount / producedAmount)
                        : sum;
                }, 0)
                : null;
            const lossOutputRatePerHour = inDependencyChain
                ? (Object.keys(slot.consumes ?? {}).length > 0 ? (simulationRow?.lossOutputRatePerHour ?? 0) : 0)
                : null;
            const netRatePerHour = inDependencyChain && Number.isFinite(produceRatePerHour)
                ? produceRatePerHour - (Number.isFinite(spendRatePerHour) ? spendRatePerHour : 0)
                : null;
            const requiredSpeed = inDependencyChain
                ? this.engineeringPlannerRequiredSpeedForRate(
                    slot.effectiveBaseTime,
                    targetRatePerHour,
                    slot.producedAmount
                )
                : null;
            const requiredSpeedIncrease = Number.isFinite(requiredSpeed)
                ? Math.max(0, requiredSpeed - slot.currentSpeed)
                : null;
            const requiredRateIncreasePerHour = (Number.isFinite(targetRatePerHour) && Number.isFinite(currentCapacityRatePerHour))
                ? Math.max(0, targetRatePerHour - currentCapacityRatePerHour)
                : null;
            const uiRequiredRateIncreasePerHour = roundedRatePerHourValue(requiredRateIncreasePerHour ?? 0) ?? 0;
            const uiRequiredSpeedIncrease = roundedPercentValue(requiredSpeedIncrease ?? 0) ?? 0;
            const uiLossOutputRatePerHour = roundedRatePerHourValue(lossOutputRatePerHour ?? 0) ?? 0;
            const rawBlocking = !inDependencyChain
                ? false
                : Number.isFinite(targetRatePerHour)
                ? targetRatePerHour > currentCapacityRatePerHour + 1e-9
                : false;
            const blocking = this.engineeringPlannerInputMode() === 'items'
                ? rawBlocking && uiRequiredRateIncreasePerHour > 0
                : rawBlocking && uiRequiredSpeedIncrease > 0;
            const shortageLabels = inDependencyChain
                ? (simulationRow?.shortageProducerIds ?? [])
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean)
                : [];
            const contenderLabels = inDependencyChain
                ? (simulationRow?.contenderIds ?? [])
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean)
                : [];

            return {
                ...slot,
                weight: inDependencyChain ? weight : null,
                inDependencyChain,
                targetRatePerHour,
                spendRatePerHour,
                rawDemandRatePerHour,
                netRatePerHour,
                currentRatePerHour: produceRatePerHour,
                currentCapacityRatePerHour,
                requiredSpeed,
                requiredSpeedIncrease,
                requiredRateIncreasePerHour,
                uiRequiredSpeedIncrease,
                uiRequiredRateIncreasePerHour,
                blocking,
                starved: !!simulationRow?.starved && uiLossOutputRatePerHour > 0,
                lossOutputRatePerHour,
                uiLossOutputRatePerHour,
                blockingConsumers: blocking ? consumers.map(({ consumer }) => consumer.label) : [],
                starvationSources: shortageLabels,
                starvationContenders: contenderLabels
            };
        });
        this._engineeringPlannerRowsCache = { signature, value: rows };
        return rows;
    },

    engineeringPlannerRows() {
        return this.engineeringPlannerMode() === 'throughput'
            ? this.engineeringPlannerThroughputRows()
            : this.engineeringPlannerRequirementRows();
    },
};
