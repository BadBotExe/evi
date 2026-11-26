import { formatFixedNumber } from '../../bonuses/lib/utils.js?v=782d378ffe';

export function dropRateMultiplier(dr) {
    return 1 + dr / 100;
}

export function adjustedDropRate({ baseRate, affectedByDr }, dr) {
    return affectedByDr ? baseRate * dropRateMultiplier(dr) : baseRate;
}

export function formatDropRate(rate) {
    if (!(rate > 0)) return '';
    const formatted = formatFixedNumber(rate > 1 ? rate : 1 / rate, { maximumFractionDigits: 3 })
        .replaceAll(',', '\u00A0');
    return rate > 1 ? `${formatted} in 1` : `1 in ${formatted}`;
}
