/* ==========================================
   CONSTANTS
========================================== */
export const DEFAULT_UNITS = { flat: '', percent: '%', multiplier: '' };
export const DEFAULT_ITEM_CATEGORY_ID = '__default__';
export const DEFAULT_ITEM_CATEGORY_KEY = 'default';

/* ==========================================
   SHARED HELPERS (pure functions, no state)
========================================== */
export function unitFor(bonusTypes, bonusId, unitType) {
    const bt = bonusTypes.find(b => b.id === bonusId);
    const ut = unitType || 'flat';
    if (!bt) return DEFAULT_UNITS[ut] || '';
    if (bt.units && bt.units[ut] !== undefined) return bt.units[ut];
    return DEFAULT_UNITS[ut] || '';
}

export function formatVal(value, unit, unitType) {
    const v = normalizeValue(value);
    const sign = v >= 0 ? '+' : '';
    const formatted = v.toLocaleString();
    if (unitType === 'multiplier') return 'x' + formatted + (unit ? ' ' + unit : '');
    if (unitType === 'percent') return sign + formatted + unit;
    return sign + formatted + (unit ? ' ' + unit : '');
}

export function formatValFixed(value, unit, unitType, decimals) {
    const precision = Math.max(0, Math.floor(Number(decimals) || 0));
    const v = normalizeValue(value, precision);
    const formatted = v.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
    });
    const sign = v >= 0 ? '+' : '';
    if (unitType === 'multiplier') return 'x' + formatted + (unit ? ' ' + unit : '');
    if (unitType === 'percent') return sign + formatted + unit;
    return sign + formatted + (unit ? ' ' + unit : '');
}

export function formatValExact(value, unit, unitType, decimals) {
    const precision = Math.max(0, Math.floor(Number(decimals) || 0));
    const v = normalizeValue(value, precision);
    const formatted = v.toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
    });
    const sign = v >= 0 ? '+' : '';
    if (unitType === 'multiplier') return 'x' + formatted + (unit ? ' ' + unit : '');
    if (unitType === 'percent') return sign + formatted + unit;
    return sign + formatted + (unit ? ' ' + unit : '');
}

export function decimalPlacesForDisplay(value, maxDecimals = 0) {
    const precision = Math.max(0, Math.floor(Number(maxDecimals) || 0));
    const normalized = normalizeValue(Number(value ?? 0), precision);
    const fraction = normalized.toString().split('.')[1] ?? '';
    return Math.min(precision, fraction.length);
}

export function sharedDisplayDecimals(values, maxDecimals = 0) {
    const precision = Math.max(0, Math.floor(Number(maxDecimals) || 0));
    return values.reduce((max, value) => {
        return Math.max(max, decimalPlacesForDisplay(value, precision));
    }, 0);
}

export function maxDecimalsInRows(rows) {
    return rows.reduce((max, r) => {
        if (r.isEllipsis || r._rawVal == null) return max;
        const s = normalizeValue(r._rawVal).toString().split('.')[1] ?? '';
        return Math.max(max, s.length);
    }, 0);
}

export function normalizeValue(value, digits = 4) {
    const coeff = Math.pow(10, digits);
    return Math.round(value * coeff) / coeff;
}

export function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function deepCloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

export function deepMergeObjects(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) return deepCloneJson(override);
    const merged = { ...deepCloneJson(base) };
    for (const [key, value] of Object.entries(override)) {
        if (isPlainObject(value) && isPlainObject(merged[key])) {
            merged[key] = deepMergeObjects(merged[key], value);
        } else {
            merged[key] = deepCloneJson(value);
        }
    }
    return merged;
}

export function positionPopover(el, clientX, clientY) {
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    let x = clientX + 12;
    let y = clientY + 12;
    if (x + pw > window.innerWidth) x = clientX - pw - 12;
    if (y + ph > window.innerHeight) y = window.innerHeight - ph - 12;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

export function clampPopover(el) {
    if (!el) return;
    let x = parseFloat(el.style.left) || 0;
    let y = parseFloat(el.style.top) || 0;
    x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

export function makeDraggable(el, handleEl, onFocus) {
    handleEl.style.cursor = 'grab';
    handleEl.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        onFocus?.();
        const startX = e.clientX - el.offsetLeft;
        const startY = e.clientY - el.offsetTop;
        handleEl.style.cursor = 'grabbing';

        function onMove(e) {
            let x = e.clientX - startX;
            let y = e.clientY - startY;
            x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        }

        function onUp() {
            handleEl.style.cursor = 'grab';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
}
