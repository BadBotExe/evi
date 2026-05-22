import { computeEngineeringSteadyStateThroughput, computeEngineeringThroughput } from '../lib/engineeringThroughput.js?v=d8856f548a';

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
        const mode = this.engineeringPlannerState?.mode;
        if (mode === 'throughput_calc') return 'throughput_calc';
        if (mode === 'throughput' || mode === 'throughput_game') return 'throughput_game';
        return 'requirements';
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

    engineeringPlannerInputMode() {
        return this.engineeringPlannerState?.inputMode === 'percent' ? 'percent' : 'items';
    },

    engineeringPlannerSlotUpgrade() {
        const config = this.engineeringPlannerConfig()?.slot_upgrade;
        if (!config?.source_id) return null;
        const src = this.data?.sources?.find(source => source.id === config.source_id) ?? null;
        if (!src) return null;
        const multiplier = Number(src.bonuses?.find(b => b.bonus === 'engineer_production_speed' && b.unit_type === 'multiplier')?.value ?? 1);
        const maxLevel = Math.max(
            Number(src.enhancement?.max_level ?? 0),
            ...((src.bonuses ?? []).map(b => Number(b.tiers_formula?.max_tier ?? 0))),
            ...((src.enhancement?.segments ?? []).flatMap(segment =>
                (segment.costs ?? []).map(cost => Array.isArray(cost.amount?.values) ? cost.amount.values.length : 0)
            ))
        );
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

    engineeringPlannerAnchorSpeed() {
        if (this.engineeringPlannerInputMode() === 'items') {
            const slotId = this.engineeringPlannerState?.anchorSlot;
            const resolvedSlot = this.engineeringPlannerResolvedSlots().find(slot => slot.id === slotId) ?? null;
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
        const plannerMode = this.engineeringPlannerMode();
        const signature = `${plannerMode}~${this.engineeringPlannerStateSignature()}`;
        if (this._engineeringPlannerRowsCache?.signature === signature) {
            return this._engineeringPlannerRowsCache.value;
        }

        const slots = this.engineeringPlannerResolvedSlots();
        const anchorSlotId = this.engineeringPlannerState?.anchorSlot;
        const weights = this.engineeringPlannerWeights(anchorSlotId);
        const throughputRows = plannerMode === 'throughput_calc'
            ? computeEngineeringSteadyStateThroughput({
                slots,
                anchorSlotId
            })
            : computeEngineeringThroughput({
                slots,
                anchorSlotId
            });
        const shortageConsumerIdsByProducerId = throughputRows.reduce((acc, row) => {
            for (const producerId of row.shortageProducerIds ?? []) {
                const consumerIds = acc.get(producerId) ?? [];
                consumerIds.push(row.slotId);
                acc.set(producerId, consumerIds);
            }
            return acc;
        }, new Map());

        const rows = slots.map(slot => {
            const throughputRow = throughputRows.find(entry => entry.slotId === slot.id) ?? null;
            const currentCapacityRatePerHour = Number(slot.currentRatePerHour) || 0;
            const grossOutputRatePerHour = throughputRow?.grossOutputRatePerHour ?? currentCapacityRatePerHour;
            const actualOutputRatePerHour = throughputRow?.actualOutputRatePerHour ?? 0;
            const shortageConsumerIds = shortageConsumerIdsByProducerId.get(slot.id) ?? [];
            const shouldEscalateToFullDemand = !!throughputRow?.inDependencyChain
                && shortageConsumerIds.length > 0
                && Number.isFinite(throughputRow?.targetRatePerHour)
                && Number.isFinite(throughputRow?.fullTargetRatePerHour)
                && (throughputRow.targetRatePerHour ?? 0) <= currentCapacityRatePerHour + 1e-9
                && (throughputRow.fullTargetRatePerHour ?? 0) > currentCapacityRatePerHour + 1e-9;
            const effectiveTargetRatePerHour = shouldEscalateToFullDemand
                ? throughputRow?.fullTargetRatePerHour
                : throughputRow?.targetRatePerHour;
            const requiredSpeed = throughputRow?.inDependencyChain
                ? this.engineeringPlannerRequiredSpeedForRate(
                    slot.effectiveBaseTime,
                    effectiveTargetRatePerHour,
                    slot.producedAmount
                )
                : null;
            const fullRequiredSpeed = throughputRow?.inDependencyChain
                ? this.engineeringPlannerRequiredSpeedForRate(
                    slot.effectiveBaseTime,
                    throughputRow.fullTargetRatePerHour,
                    slot.producedAmount
                )
                : null;
            const requiredSpeedIncrease = Number.isFinite(requiredSpeed)
                ? Math.max(0, requiredSpeed - slot.currentSpeed)
                : null;
            const fullRequiredSpeedIncrease = Number.isFinite(fullRequiredSpeed)
                ? Math.max(0, fullRequiredSpeed - slot.currentSpeed)
                : null;
            const requiredRateIncreasePerHour = (Number.isFinite(effectiveTargetRatePerHour) && Number.isFinite(currentCapacityRatePerHour))
                ? Math.max(0, effectiveTargetRatePerHour - currentCapacityRatePerHour)
                : null;
            const fullRequiredRateIncreasePerHour = (Number.isFinite(throughputRow?.fullTargetRatePerHour) && Number.isFinite(currentCapacityRatePerHour))
                ? Math.max(0, throughputRow.fullTargetRatePerHour - currentCapacityRatePerHour)
                : null;
            const uiRequiredRateIncreasePerHour = roundedRatePerHourValue(requiredRateIncreasePerHour ?? 0) ?? 0;
            const uiFullRequiredRateIncreasePerHour = roundedRatePerHourValue(fullRequiredRateIncreasePerHour ?? 0) ?? 0;
            const uiRequiredSpeedIncrease = roundedPercentValue(requiredSpeedIncrease ?? 0) ?? 0;
            const uiFullRequiredSpeedIncrease = roundedPercentValue(fullRequiredSpeedIncrease ?? 0) ?? 0;
            const uiLossOutputRatePerHour = roundedRatePerHourValue(throughputRow?.lossOutputRatePerHour ?? 0) ?? 0;
            const blocking = this.engineeringPlannerInputMode() === 'items'
                ? !!throughputRow?.inDependencyChain && uiRequiredRateIncreasePerHour > 0
                : !!throughputRow?.inDependencyChain && uiRequiredSpeedIncrease > 0;

            return {
                ...slot,
                weight: throughputRow?.inDependencyChain ? (weights[slot.id] ?? null) : null,
                inDependencyChain: throughputRow?.inDependencyChain ?? false,
                targetRatePerHour: effectiveTargetRatePerHour ?? null,
                fullTargetRatePerHour: throughputRow?.fullTargetRatePerHour ?? null,
                spendRatePerHour: throughputRow?.spendRatePerHour ?? null,
                rawDemandRatePerHour: throughputRow?.rawDemandRatePerHour ?? null,
                netRatePerHour: Number.isFinite(actualOutputRatePerHour) && Number.isFinite(throughputRow?.spendRatePerHour)
                    ? actualOutputRatePerHour - throughputRow.spendRatePerHour
                    : null,
                currentRatePerHour: actualOutputRatePerHour,
                currentCapacityRatePerHour,
                grossOutputRatePerHour,
                actualOutputRatePerHour,
                requiredSpeed,
                fullRequiredSpeed,
                requiredSpeedIncrease,
                fullRequiredSpeedIncrease,
                requiredRateIncreasePerHour,
                fullRequiredRateIncreasePerHour,
                uiRequiredSpeedIncrease,
                uiFullRequiredSpeedIncrease,
                uiRequiredRateIncreasePerHour,
                uiFullRequiredRateIncreasePerHour,
                shortageDrivenBlocking: shouldEscalateToFullDemand,
                blocking,
                starved: !!throughputRow?.starved && uiLossOutputRatePerHour > 0,
                lossOutputRatePerHour: throughputRow?.lossOutputRatePerHour ?? null,
                uiLossOutputRatePerHour,
                consumerLabels: (throughputRow?.consumerIds ?? [])
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean),
                blockingConsumers: (shortageConsumerIds.length ? shortageConsumerIds : (throughputRow?.blockingConsumers ?? []))
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean),
                starvationSources: (throughputRow?.shortageProducerIds ?? [])
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean),
                starvationContenders: (throughputRow?.contenderIds ?? [])
                    .map(id => this.engineeringPlannerSlotById(id)?.label)
                    .filter(Boolean)
            };
        });

        this._engineeringPlannerRowsCache = { signature, value: rows };
        return rows;
    },

    engineeringPlannerRows() {
        return this.engineeringPlannerMode() !== 'requirements'
            ? this.engineeringPlannerThroughputRows()
            : this.engineeringPlannerRequirementRows();
    },
};
