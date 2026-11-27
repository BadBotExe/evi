import { t } from '../../i18n/locale.js?v=b7fe748fcc';
import { formatFixedNumber } from '../../bonuses/lib/utils.js?v=cb138a904c';

export function dropRateMultiplier(dr) {
    return 1 + dr / 100;
}

export function adjustedDropRate({ baseRate, affectedByDr }, dr) {
    return affectedByDr ? baseRate * dropRateMultiplier(dr) : baseRate;
}

export function formatDropRate(rate) {
    if (!(rate > 0)) return '';
    const formatted = formatFixedNumber(rate > 1 ? rate : 1 / rate, {
        maximumFractionDigits: 3,
        wholeNumberFrom: 100,
        groupSeparator: '\u00a0'
    });
    return t('cards.odds', rate > 1 ? { count: formatted, total: 1 } : { count: 1, total: formatted });
}
