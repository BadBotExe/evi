const SHORT_PARAM_KEYS = {
    act: 'a',
    item: 'i',
    tab: 't',
    speed: 's',
    gemshop: 'gs',
    multicraft: 'mc'
};

const MOBILE_TAB_ROUTE_KEYS = {
    item: 'i',
    browse: 'b'
};

function readRouteParam(params, field) {
    return params.get(SHORT_PARAM_KEYS[field]);
}

function readRouteField(state, field) {
    const shortValue = state?.[SHORT_PARAM_KEYS[field]];
    if (shortValue != null && shortValue !== '') return String(shortValue);

    const canonicalValue = state?.[field];
    if (canonicalValue != null && canonicalValue !== '') return String(canonicalValue);
    return '';
}

export function normalizeSmithRouteState(state = {}) {
    return {
        act: readRouteField(state, 'act'),
        item: readRouteField(state, 'item'),
        tab: readRouteField(state, 'tab'),
        speed: readRouteField(state, 'speed'),
        gemshop: readRouteField(state, 'gemshop'),
        multicraft: readRouteField(state, 'multicraft')
    };
}

export function resolveSmithRouteState(search = '') {
    const params = new URLSearchParams(search);
    return {
        act: readRouteParam(params, 'act') ?? '',
        item: readRouteParam(params, 'item') ?? '',
        tab: readRouteParam(params, 'tab') ?? '',
        speed: readRouteParam(params, 'speed') ?? '',
        gemshop: readRouteParam(params, 'gemshop') ?? '',
        multicraft: readRouteParam(params, 'multicraft') ?? ''
    };
}

function buildRouteValueMaps(data = null) {
    const actIdByKey = new Map();
    const actKeyById = new Map();
    (data?.tabs ?? []).forEach(tab => {
        if (!tab?.id || !tab?.key) return;
        actIdByKey.set(tab.key, tab.id);
        actKeyById.set(tab.id, tab.key);
    });

    const itemIdByKey = new Map();
    const itemKeyById = new Map();
    Object.values(data?.itemsById ?? {}).forEach(item => {
        if (!item?.id || !item?.key) return;
        itemIdByKey.set(item.key, item.id);
        itemKeyById.set(item.id, item.key);
    });

    const tabIdByKey = new Map();
    const tabKeyById = new Map();
    Object.entries(MOBILE_TAB_ROUTE_KEYS).forEach(([id, key]) => {
        tabIdByKey.set(key, id);
        tabKeyById.set(id, key);
    });

    return {
        actIdByKey,
        actKeyById,
        itemIdByKey,
        itemKeyById,
        tabIdByKey,
        tabKeyById
    };
}

export function decodeSmithRouteState(state = {}, { data = null } = {}) {
    const normalized = normalizeSmithRouteState(state);
    const maps = buildRouteValueMaps(data);
    return {
        act: maps.actIdByKey.get(normalized.act) ?? '',
        item: maps.itemIdByKey.get(normalized.item) ?? '',
        tab: maps.tabIdByKey.get(normalized.tab) ?? '',
        speed: normalized.speed,
        gemshop: normalized.gemshop,
        multicraft: normalized.multicraft
    };
}

export function serializeSmithRouteState(state = {}, { data = null } = {}) {
    const normalized = normalizeSmithRouteState(state);
    const maps = buildRouteValueMaps(data);
    const params = new URLSearchParams();
    const actKey = maps.actKeyById.get(normalized.act);
    const itemKey = maps.itemKeyById.get(normalized.item);
    const tabKey = maps.tabKeyById.get(normalized.tab);

    if (actKey) params.set(SHORT_PARAM_KEYS.act, actKey);
    if (itemKey) params.set(SHORT_PARAM_KEYS.item, itemKey);
    if (tabKey) params.set(SHORT_PARAM_KEYS.tab, tabKey);
    if (normalized.speed) params.set(SHORT_PARAM_KEYS.speed, normalized.speed);
    if (normalized.gemshop) params.set(SHORT_PARAM_KEYS.gemshop, normalized.gemshop);
    if (normalized.multicraft) params.set(SHORT_PARAM_KEYS.multicraft, normalized.multicraft);
    return params;
}
