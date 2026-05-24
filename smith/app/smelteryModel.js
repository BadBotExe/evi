function parseFiniteNumber(value) {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

export function normalizeSmelterySpeed(value) {
    const numericValue = parseFiniteNumber(value);
    if (numericValue == null) return '';
    return String(numericValue);
}

export function normalizeSmelteryGemshopLevel(value, maxLevel = 0) {
    const numericValue = parseFiniteNumber(value);
    if (numericValue == null) return '0';
    const clampedValue = Math.max(0, Math.min(Math.trunc(numericValue), Math.max(0, Number(maxLevel) || 0)));
    return String(clampedValue);
}

export function calculateSmelteryGemshopMultiplier(level, config = {}) {
    const numericLevel = parseFiniteNumber(level);
    const initMultiplier = Number(config?.initMultiplier);
    const tierStep = Number(config?.tierStep);
    if (numericLevel == null) return Number.isFinite(initMultiplier) && initMultiplier > 0 ? initMultiplier : 1;
    return (Number.isFinite(initMultiplier) && initMultiplier > 0 ? initMultiplier : 1)
        + (Math.max(0, numericLevel) * (Number.isFinite(tierStep) ? tierStep : 0));
}

export function calculateSmelteryEffectiveTime(baseTime, speedBonus, gemshopMultiplier = 1) {
    const numericBaseTime = parseFiniteNumber(baseTime);
    const numericSpeedBonus = parseFiniteNumber(speedBonus);
    const numericGemshopMultiplier = parseFiniteNumber(gemshopMultiplier);
    if (!(numericBaseTime > 0)) return null;
    if (!(numericGemshopMultiplier > 0)) return null;

    const speedMultiplier = 1 + ((numericSpeedBonus ?? 0) / 100);
    if (!(speedMultiplier > 0)) return null;

    return numericBaseTime / numericGemshopMultiplier / speedMultiplier;
}

export function calculateSmelterySpeedFromMeasuredSeconds(baseTime, measuredSeconds, gemshopMultiplier = 1) {
    const numericBaseTime = parseFiniteNumber(baseTime);
    const numericMeasuredSeconds = parseFiniteNumber(measuredSeconds);
    const numericGemshopMultiplier = parseFiniteNumber(gemshopMultiplier);
    if (!(numericBaseTime > 0)) return null;
    if (!(numericMeasuredSeconds > 0)) return null;
    if (!(numericGemshopMultiplier > 0)) return null;
    return ((numericBaseTime / numericGemshopMultiplier / numericMeasuredSeconds) - 1) * 100;
}

export function parseSmelteryMeasuredDuration(hours, minutes, seconds) {
    const numericHours = parseFiniteNumber(hours);
    const numericMinutes = parseFiniteNumber(minutes);
    const numericSeconds = parseFiniteNumber(seconds);
    if (numericHours == null && numericMinutes == null && numericSeconds == null) return null;
    if ((numericHours ?? 0) < 0 || (numericMinutes ?? 0) < 0 || (numericSeconds ?? 0) < 0) return null;
    if ((numericMinutes ?? 0) >= 60 || (numericSeconds ?? 0) >= 60) return null;
    const totalSeconds = ((numericHours ?? 0) * 3600) + ((numericMinutes ?? 0) * 60) + (numericSeconds ?? 0);
    return totalSeconds > 0 ? totalSeconds : null;
}

export function formatSmelterySeconds(value) {
    const numericValue = parseFiniteNumber(value);
    if (numericValue == null || numericValue < 0) return '--';

    const roundedTenths = Math.round(numericValue * 10);
    const totalSeconds = Math.floor(roundedTenths / 10);
    const tenths = roundedTenths % 10;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}${tenths > 0 ? `.${tenths}` : ''}s`;
}

export function buildSmelteryTimingRows(recipe, speedBonus, gemshopMultiplier = 1) {
    const normalizedSpeedBonus = normalizeSmelterySpeed(speedBonus);
    const numericBaseTime = parseFiniteNumber(recipe?.base_time);
    const numericGemshopMultiplier = parseFiniteNumber(gemshopMultiplier);
    const adjustedBaseTime = numericBaseTime != null && numericGemshopMultiplier > 0
        ? numericBaseTime / numericGemshopMultiplier
        : numericBaseTime;
    const effectiveTime = calculateSmelteryEffectiveTime(numericBaseTime, normalizedSpeedBonus, numericGemshopMultiplier);

    return [
        {
            id: 'base_time',
            label: 'Base Time',
            value: adjustedBaseTime == null ? 'Not added yet' : formatSmelterySeconds(adjustedBaseTime)
        },
        {
            id: 'effective_time',
            label: 'Effective Time',
            value: effectiveTime == null ? 'Not available' : formatSmelterySeconds(effectiveTime)
        }
    ];
}
