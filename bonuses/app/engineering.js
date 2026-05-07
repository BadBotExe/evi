export const engineeringMethods = {
    engineeringPlannerConfig() { return this.data?.engineeringPlanner ?? null; },

    engineeringPlannerMode() {
        return this.engineeringPlannerState?.mode === 'throughput' ? 'throughput' : 'requirements';
    },

    engineeringPlannerSlotUpgrade() {
        const config = this.engineeringPlannerConfig()?.slot_upgrade;
        if (!config?.source_id) return null;
        const src = this.data?.sources?.find(source => source.id === config.source_id) ?? null;
        if (!src) return null;
        const multiplier = Number(src.bonuses?.find(b => b.bonus === 'engineer_production_speed' && b.unit_type === 'multiplier')?.value ?? 1);
        const maxLevel = src.bonuses?.filter(b => b.format === 'plain' && /^Cost \(Tier \d+\)$/.test(b.bonus)).length ?? 0;
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

        const producers = new Map();
        for (const slot of slots) {
            const produceEntries = Object.entries(slot.produces ?? {});
            if (!produceEntries.length) continue;
            const [itemId, amount] = produceEntries[0];
            producers.set(itemId, { slot, amount: Number(amount) || 1 });
        }

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
        const value = Number(this.engineeringPlannerState?.throughputSpeeds?.[slotId] ?? 0);
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

    engineeringPlannerResolvedSlots() {
        const slots = this.engineeringPlannerConfig()?.slots ?? [];
        const slotUpgrade = this.engineeringPlannerSlotUpgrade();
        const slotUpgradeLevel = Math.max(0, Math.min(
            Number(this.engineeringPlannerState?.slotUpgradeLevel ?? 0),
            slotUpgrade?.maxLevel ?? 0
        ));

        return slots.map((slot, slotIndex) => {
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
    },

    engineeringPlannerRequirementRows() {
        const planner = this.engineeringPlannerState;
        const anchorSlot = planner.anchorSlot;
        const weights = this.engineeringPlannerWeights(anchorSlot);
        const slots = this.engineeringPlannerResolvedSlots().map(slot => ({
            ...slot,
            weight: weights[slot.id] ?? null
        }));
        const anchorConfig = slots.find(slot => slot.id === anchorSlot) ?? null;
        const anchorSpeed = Number(planner.anchorSpeed ?? 0);
        const anchorWeight = Number(anchorConfig?.weight) || null;
        const anchorRatePerHour = anchorConfig
            ? this.engineeringPlannerRatePerHour(anchorConfig.effectiveBaseTime, anchorSpeed, anchorConfig.producedAmount)
            : null;
        const chainScale = Number.isFinite(anchorRatePerHour) && anchorRatePerHour > 0 && anchorWeight
            ? (anchorRatePerHour / 3600) / anchorWeight
            : null;

        return slots.map(slot => {
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
    },

    engineeringPlannerThroughputRows() {
        const slots = this.engineeringPlannerResolvedSlots();
        const anchorSlotId = this.engineeringPlannerState?.anchorSlot;
        const anchorIndex = slots.findIndex(slot => slot.id === anchorSlotId);
        const enabledSlots = anchorIndex >= 0 ? slots.slice(0, anchorIndex + 1) : [];
        const enabledSlotIds = new Set(enabledSlots.map(slot => slot.id));
        const producedByItem = new Map(
            slots
                .filter(slot => slot.producedItemId)
                .map(slot => [slot.producedItemId, slot.id])
        );
        const consumerMap = new Map();

        for (const consumer of enabledSlots) {
            for (const [itemId, rawAmount] of Object.entries(consumer.consumes ?? {})) {
                const producerSlotId = producedByItem.get(itemId);
                if (!producerSlotId || !enabledSlotIds.has(producerSlotId)) continue;
                const amount = Number(rawAmount) || 0;
                if (!(amount > 0)) continue;
                const entries = consumerMap.get(producerSlotId) ?? [];
                entries.push({ consumer, amount });
                consumerMap.set(producerSlotId, entries);
            }
        }

        return slots.map(slot => {
            const inDependencyChain = enabledSlotIds.has(slot.id);
            const produceRatePerHour = inDependencyChain && Number.isFinite(slot.currentRatePerHour)
                ? slot.currentRatePerHour
                : null;
            const consumers = inDependencyChain ? (consumerMap.get(slot.id) ?? []) : [];
            const spendRatePerHour = inDependencyChain
                ? consumers.reduce((sum, { consumer, amount }) => {
                    const consumerRate = Number(consumer.currentRatePerHour);
                    const producedAmount = Number(consumer.producedAmount) || 1;
                    return Number.isFinite(consumerRate) && producedAmount > 0
                        ? sum + (consumerRate * amount / producedAmount)
                        : sum;
                }, 0)
                : null;
            const netRatePerHour = inDependencyChain && Number.isFinite(produceRatePerHour)
                ? produceRatePerHour - (Number.isFinite(spendRatePerHour) ? spendRatePerHour : 0)
                : null;
            const requiredSpeed = inDependencyChain
                ? this.engineeringPlannerRequiredSpeedForRate(
                    slot.effectiveBaseTime,
                    spendRatePerHour,
                    slot.producedAmount
                )
                : null;
            const requiredSpeedIncrease = Number.isFinite(requiredSpeed)
                ? Math.max(0, requiredSpeed - slot.currentSpeed)
                : null;
            const blocking = !inDependencyChain
                ? false
                : Number.isFinite(produceRatePerHour)
                ? (Number.isFinite(spendRatePerHour) ? spendRatePerHour > produceRatePerHour + 1e-9 : false)
                : (Number.isFinite(spendRatePerHour) ? spendRatePerHour > 0 : false);

            return {
                ...slot,
                weight: null,
                inDependencyChain,
                targetRatePerHour: spendRatePerHour,
                spendRatePerHour,
                netRatePerHour,
                requiredSpeed,
                requiredSpeedIncrease,
                blocking,
                blockingConsumers: blocking ? consumers.map(({ consumer }) => consumer.label) : []
            };
        });
    },

    engineeringPlannerRows() {
        return this.engineeringPlannerMode() === 'throughput'
            ? this.engineeringPlannerThroughputRows()
            : this.engineeringPlannerRequirementRows();
    },
};
