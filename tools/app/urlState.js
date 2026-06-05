function readNumber(value, fallback = null) {
    if (value == null || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function resolveToolsRouteState(search = '') {
    const params = new URLSearchParams(search);
    return {
        calc: params.get('x') ?? '',
        engineeringMode: params.get('em') === 'c'
            ? 'throughput_calc'
            : params.get('em') === 't'
                ? 'throughput_game'
                : 'requirements',
        engineeringInputMode: params.get('ei') === 'p' ? 'percent' : 'items',
        engineeringAnchor: params.get('ea') ?? '',
        engineeringAnchorSpeed: readNumber(params.get('ev'), 0),
        engineeringAnchorItemsPerHour: readNumber(params.get('evi'), null),
        engineeringSlotUpgradeLevel: readNumber(params.get('eu'), null)
    };
}

export function buildToolsRouteQuery(app) {
    const params = new URLSearchParams();
    const calc = app.activeCalc;
    if (calc) {
        const entry = app.calcEntries.find(value => value.id === calc);
        params.set('x', entry?.key ?? calc);
    }

    if (app.activeCalc === 'engineering-planner') {
        if (app.engineeringPlannerMode() === 'throughput_game') {
            params.set('em', 't');
        } else if (app.engineeringPlannerMode() === 'throughput_calc') {
            params.set('em', 'c');
        }
        if (app.engineeringPlannerInputMode() === 'percent') {
            params.set('ei', 'p');
        }
        const plannerAnchor = app.engineeringPlannerSlotById(app.engineeringPlannerState.anchorSlot);
        if (plannerAnchor?.key && app.engineeringPlannerState.anchorSlot !== app.engineeringPlannerDefaultAnchorSlot()) {
            params.set('ea', plannerAnchor.key);
        }
        if (app.engineeringPlannerState.anchorSpeed) {
            params.set('ev', app.normalizeValue(app.engineeringPlannerState.anchorSpeed, 3));
        }
        if (app.engineeringPlannerState.anchorItemsPerHour) {
            params.set('evi', app.normalizeValue(app.engineeringPlannerState.anchorItemsPerHour, 3));
        }
        const plannerSlotUpgrade = app.engineeringPlannerSlotUpgrade();
        if (app.engineeringPlannerState.slotUpgradeLevel !== (plannerSlotUpgrade?.defaultLevel ?? 0)) {
            params.set('eu', app.engineeringPlannerState.slotUpgradeLevel);
        }
        for (const slot of app.engineeringPlannerConfig()?.slots ?? []) {
            const speedKey = app.engineeringPlannerSpeedParamKey(slot);
            const speedValue = app.engineeringPlannerState.throughputSpeeds?.[slot.id];
            if (speedKey && speedValue) {
                params.set(speedKey, app.normalizeValue(speedValue, 3));
            }
            const itemsKey = app.engineeringPlannerItemsParamKey(slot);
            const itemsValue = app.engineeringPlannerState.throughputItemsPerHour?.[slot.id];
            if (itemsKey && itemsValue) {
                params.set(itemsKey, app.normalizeValue(itemsValue, 3));
            }
        }
    }

    return params;
}
