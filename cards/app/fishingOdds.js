export function fishingWeightUnits(kg) {
    if (kg < 100) return Math.max(1, Math.round(kg * 10));
    if (kg < 1000) return Math.round(kg) * 10;
    return Math.round(kg / 10) * 100;
}

export function fishingDropRows(settings, pond, cardItem, drops) {
    const [primary, secondary] = Object.keys(pond.fish);
    const primaryChance = 1 - settings.secondaryChance - settings.junkChance
        - pond.card - Object.values(pond.extra).reduce((total, chance) => total + chance, 0);
    const probabilities = {
        [primary]: primaryChance,
        [secondary]: settings.secondaryChance,
        [cardItem]: pond.card,
        ...pond.extra
    };
    const present = new Set(drops.map(drop => drop.item));
    return [
        ...drops.map(drop => ({ ...drop, rollChance: probabilities[drop.item], fishKg: pond.fish[drop.item] })),
        ...Object.entries(pond.extra)
            .filter(([item]) => !present.has(item))
            .map(([item, rollChance]) => ({ item, rollChance })),
        { item: 'old_boot', rollChance: settings.junkChance }
    ];
}

export function guaranteedFishingWeight(settings, power) {
    return Math.floor(power * 10 / settings.hpPerKg) / 10;
}

function sampledFishHp(settings, normalKg, difficultyMultiplier) {
    const { centerFactor, weightSpread, minWeightRatio, maxWeightRatio, hpPerKg, weightQuantiles } = settings;
    const center = normalKg * centerFactor * difficultyMultiplier;
    return weightQuantiles.map(z => {
        const kg = Math.min(normalKg * maxWeightRatio,
            Math.max(normalKg * minWeightRatio, center * Math.exp(weightSpread * z)));
        return fishingWeightUnits(kg) * hpPerKg / 10;
    });
}

function tensionAtEqualPower({ startingTension, tensionLimit, pullStrength, pullDelay }) {
    return (1 - startingTension) * tensionLimit / pullStrength * pullDelay;
}

export function minimumFishingPower(settings, normalKg, difficultyMultiplier = 1) {
    const { pullCount, pullSpread } = settings;
    const sureRatio = Math.min(1, tensionAtEqualPower(settings) / (pullCount * (1 - pullSpread)));
    return Math.ceil(Math.max(...sampledFishHp(settings, normalKg, difficultyMultiplier)) * sureRatio);
}

export function fishingLandChance(settings, normalKg, power, difficultyMultiplier = 1) {
    if (power <= 0) return 0;
    const { pullCount, pullSpread } = settings;
    const tension = tensionAtEqualPower(settings);
    const samples = sampledFishHp(settings, normalKg, difficultyMultiplier);
    const total = samples.reduce((sum, hp) => {
        const ratio = power / hp;
        if (ratio >= 1) return sum + 1;
        const chance = (pullCount * (1 + pullSpread) - tension / ratio) / (2 * pullCount * pullSpread);
        return sum + Math.max(0, Math.min(1, chance));
    }, 0);
    return total / samples.length;
}
