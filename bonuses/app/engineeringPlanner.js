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

export const engineeringPlannerMethods = {
    engineeringPlannerConfig() { return this.data?.engineeringPlanner ?? null; },

    engineeringPlannerStateSignature() {
        const planner = this.engineeringPlannerState ?? {};
        return [
            planner.inputMode ?? '',
            planner.anchorSlot ?? '',
            planner.anchorSpeed ?? '',
            planner.anchorItemsPerHour ?? '',
            planner.slotUpgradeLevel ?? ''
        ].join('~');
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

    engineeringPlannerRows() {
        return this.engineeringPlannerRequirementRows();
    },
};
