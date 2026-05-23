const SHORT_PARAM_KEYS = {
    act: 'a',
    item: 'i'
};

const LEGACY_PARAM_KEYS = {
    act: 'act',
    item: 'item'
};

function readRouteParam(params, field) {
    const shortValue = params.get(SHORT_PARAM_KEYS[field]);
    if (shortValue != null) return shortValue;
    return params.get(LEGACY_PARAM_KEYS[field]);
}

function readRouteField(state, field) {
    const shortValue = state?.[SHORT_PARAM_KEYS[field]];
    if (shortValue != null && shortValue !== '') return String(shortValue);

    const canonicalValue = state?.[field];
    if (canonicalValue != null && canonicalValue !== '') return String(canonicalValue);

    const legacyValue = state?.[LEGACY_PARAM_KEYS[field]];
    if (legacyValue != null && legacyValue !== '') return String(legacyValue);

    return '';
}

export function normalizeSmithRouteState(state = {}) {
    return {
        act: readRouteField(state, 'act'),
        item: readRouteField(state, 'item')
    };
}

export function resolveSmithRouteState(search = '') {
    const params = new URLSearchParams(search);
    return {
        act: readRouteParam(params, 'act') ?? '',
        item: readRouteParam(params, 'item') ?? ''
    };
}

export function serializeSmithRouteState(state = {}) {
    const normalized = normalizeSmithRouteState(state);
    const params = new URLSearchParams();
    if (normalized.act) params.set(SHORT_PARAM_KEYS.act, normalized.act);
    if (normalized.item) params.set(SHORT_PARAM_KEYS.item, normalized.item);
    return params;
}
