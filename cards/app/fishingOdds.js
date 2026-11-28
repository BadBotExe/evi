import { dropRateMultiplier } from './dropRates.js?v=30beba3042';

export function fishingWeightUnits(kg) {
    if (kg < 100) return Math.max(1, Math.round(kg * 10));
    if (kg < 1000) return Math.round(kg) * 10;
    return Math.round(kg / 10) * 100;
}

export function fishingDropRows(settings, pond, cardItem, drops, dr = 0) {
    const [primary, secondary] = Object.keys(pond.fish);
    const primaryChance = 1 - settings.secondaryChance - settings.junkChance
        - pond.card - Object.values(pond.extra).reduce((total, chance) => total + chance, 0);
    const probabilities = {
        [primary]: primaryChance,
        [secondary]: settings.secondaryChance,
        [cardItem]: pond.card,
        ...pond.extra
    };
    probabilities.old_boot = settings.junkChance;
    const multiplier = dropRateMultiplier(dr);
    if (dr !== 0) {
        for (const item of Object.keys(probabilities)) {
            const ratio = probabilities[item] / primaryChance;
            probabilities[item] = item === primary ? 1 : ratio * multiplier / (1 + ratio * (multiplier - 1));
        }
        const total = Object.values(probabilities).reduce((sum, rate) => sum + rate, 0);
        for (const item of Object.keys(probabilities)) probabilities[item] /= total;
    }

    const present = new Set(drops.map(drop => drop.item));
    return [
        ...drops.map(drop => ({ ...drop, rollChance: probabilities[drop.item], fishKg: pond.fish[drop.item] })),
        ...Object.entries(pond.extra)
            .filter(([item]) => !present.has(item))
            .map(([item]) => ({ item, rollChance: probabilities[item] })),
        { item: 'old_boot', rollChance: probabilities.old_boot }
    ];
}

export function guaranteedFishingWeight(settings, power) {
    return Math.floor(power * 10 / settings.hpPerKg) / 10;
}

function sampledFishHp(settings, normalKg, difficultyMultiplier, weightBonusPercent) {
    const { centerFactor, weightSpread, minWeightRatio, maxWeightRatio, hpPerKg, weightQuantiles } = settings;
    const center = normalKg * centerFactor * difficultyMultiplier * (1 + weightBonusPercent / 100);
    return weightQuantiles.map(z => {
        const kg = Math.min(normalKg * maxWeightRatio,
            Math.max(normalKg * minWeightRatio, center * Math.exp(weightSpread * z)));
        return fishingWeightUnits(kg) * hpPerKg / 10;
    });
}

function tensionAtEqualPower({ startingTension, tensionLimit, pullStrength, pullDelay }) {
    return (1 - startingTension) * tensionLimit / pullStrength * pullDelay;
}

export function minimumFishingPower(settings, normalKg, difficultyMultiplier = 1, weightBonusPercent = 0) {
    const { pullCount, pullSpread } = settings;
    const sureRatio = Math.min(1, tensionAtEqualPower(settings) / (pullCount * (1 - pullSpread)));
    return Math.ceil(Math.max(...sampledFishHp(settings, normalKg, difficultyMultiplier, weightBonusPercent)) * sureRatio);
}

export function fishingLandChance(settings, normalKg, power, difficultyMultiplier = 1, weightBonusPercent = 0) {
    if (power <= 0) return 0;
    const { pullCount, pullSpread } = settings;
    const tension = tensionAtEqualPower(settings);
    const samples = sampledFishHp(settings, normalKg, difficultyMultiplier, weightBonusPercent);
    const total = samples.reduce((sum, hp) => {
        const ratio = power / hp;
        if (ratio >= 1) return sum + 1;
        const chance = (pullCount * (1 + pullSpread) - tension / ratio) / (2 * pullCount * pullSpread);
        return sum + Math.max(0, Math.min(1, chance));
    }, 0);
    return total / samples.length;
}
