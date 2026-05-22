const SHORT_PARAM_KEYS = {
    card: 'c',
    mode: 'm',
    stars: 's',
    filter: 'f',
    tab: 't'
};

const MODE_ROUTE_KEYS = {
    normal: 'n',
    hard: 'h',
    nightmare: 'nm'
};

const TAB_ROUTE_KEYS = {
    card: 'c',
    drops: 'd',
    browse: 'b'
};

const LEGACY_PARAM_KEYS = {
    card: 'card',
    mode: 'mode',
    stars: 'stars',
    filter: 'filter',
    tab: 'tab'
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

export function normalizeCardsRouteState(state = {}) {
    return {
        card: readRouteField(state, 'card'),
        mode: readRouteField(state, 'mode'),
        stars: readRouteField(state, 'stars'),
        filter: readRouteField(state, 'filter'),
        tab: readRouteField(state, 'tab')
    };
}

function buildRouteValueMaps(data = null, cardIndex = null) {
    const modeIdByKey = new Map();
    const modeKeyById = new Map();
    Object.entries(MODE_ROUTE_KEYS).forEach(([id, key]) => {
        modeIdByKey.set(key, id);
        modeKeyById.set(id, key);
    });
    (data?.modes ?? []).forEach(mode => {
        if (!mode?.id) return;
        const key = mode.key ?? mode.id;
        modeIdByKey.set(key, mode.id);
        modeKeyById.set(mode.id, key);
    });

    const tabIdByKey = new Map();
    const tabKeyById = new Map();
    Object.entries(TAB_ROUTE_KEYS).forEach(([id, key]) => {
        tabIdByKey.set(key, id);
        tabKeyById.set(id, key);
    });

    const bonusIdByKey = new Map();
    const bonusKeyById = new Map();
    (data?.bonus_types ?? []).forEach(entry => {
        if (!entry?.id) return;
        const key = entry.key ?? entry.id;
        bonusIdByKey.set(key, entry.id);
        bonusKeyById.set(entry.id, key);
    });

    const cardIdByKey = new Map();
    const cardKeyById = new Map();
    Object.values(cardIndex ?? {}).forEach(({ card }) => {
        if (!card?.id) return;
        const key = card.key ?? card.id;
        cardIdByKey.set(key, card.id);
        cardKeyById.set(card.id, key);
    });

    return {
        modeIdByKey,
        modeKeyById,
        tabIdByKey,
        tabKeyById,
        bonusIdByKey,
        bonusKeyById,
        cardIdByKey,
        cardKeyById
    };
}

function decodeFilterValue(rawValue, bonusIdByKey) {
    if (!rawValue) return '';
    return String(rawValue)
        .split(/[,-]/)
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => bonusIdByKey.get(part) ?? part)
        .join(',');
}

export function resolveCardsRouteState(search = '') {
    const params = new URLSearchParams(search);
    return {
        card: readRouteParam(params, 'card') ?? '',
        mode: readRouteParam(params, 'mode') ?? '',
        stars: readRouteParam(params, 'stars') ?? '',
        filter: readRouteParam(params, 'filter') ?? '',
        tab: readRouteParam(params, 'tab') ?? ''
    };
}

export function decodeCardsRouteState(state = {}, { data = null, cardIndex = null } = {}) {
    const normalized = normalizeCardsRouteState(state);
    const maps = buildRouteValueMaps(data, cardIndex);

    return {
        card: maps.cardIdByKey.get(normalized.card) ?? normalized.card,
        mode: maps.modeIdByKey.get(normalized.mode) ?? normalized.mode,
        stars: normalized.stars,
        filter: decodeFilterValue(normalized.filter, maps.bonusIdByKey),
        tab: maps.tabIdByKey.get(normalized.tab) ?? normalized.tab
    };
}

export function serializeCardsRouteState(state = {}, { data = null, cardIndex = null } = {}) {
    const normalized = normalizeCardsRouteState(state);
    const maps = buildRouteValueMaps(data, cardIndex);
    const params = new URLSearchParams();

    if (normalized.card) params.set(SHORT_PARAM_KEYS.card, maps.cardKeyById.get(normalized.card) ?? normalized.card);
    if (normalized.mode) params.set(SHORT_PARAM_KEYS.mode, maps.modeKeyById.get(normalized.mode) ?? normalized.mode);
    if (normalized.stars) params.set(SHORT_PARAM_KEYS.stars, normalized.stars);
    if (normalized.filter) {
        const filterValue = normalized.filter
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => maps.bonusKeyById.get(part) ?? part)
            .join('-');
        if (filterValue) params.set(SHORT_PARAM_KEYS.filter, filterValue);
    }
    if (normalized.tab) params.set(SHORT_PARAM_KEYS.tab, maps.tabKeyById.get(normalized.tab) ?? normalized.tab);

    return params;
}
