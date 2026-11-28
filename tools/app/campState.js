import { CAMP } from '../lib/campData.js?v=c51ac3dd24';
import { campInteger, createCampState } from '../lib/campCalculator.js?v=43fb503695';

const STORAGE_KEY = 'evitania_tools_camp';

function updateFields(state, update) {
    state.buildingId = update('building', state.buildingId, value =>
        Object.hasOwn(state.buildings, value) ? value : state.buildingId);
    state.mobileTab = update('mobileTab', state.mobileTab, value =>
        value === 'summary' || value === 'parameters' || Object.hasOwn(state.buildings, value)
            ? value
            : state.mobileTab);
    state.storedRP = update('rp', state.storedRP, value => campInteger(value, CAMP.rpCap.at(-1)));
    state.activeBought = update('active', state.activeBought, value => campInteger(value, CAMP.activePurchase.max_tier));
    state.slotsBought = update('slots', state.slotsBought, value => campInteger(value, CAMP.slotPurchase.max_tier));

    for (const { id, starting_star: minimum } of CAMP.buildings) {
        const building = state.buildings[id];
        building.stars = update(id, building.stars, value => Math.max(minimum, campInteger(value, 3)));
        building.levels = building.levels.map((level, index) =>
            update(id + '.branch.' + index, level, value => campInteger(value, Number.MAX_SAFE_INTEGER)));
        if (!CAMP.targets[id]) continue;
        for (const [index, cat] of building.workers.entries()) {
            const prefix = id + '.worker.' + index + '.';
            cat.target = update(prefix + 'target', cat.target, value =>
                CAMP.targets[id].some(([key]) => key === value) ? value : '');
            cat.tier = update(prefix + 'tier', cat.tier, value => campInteger(value, CAMP.rarities.length - 1));
            cat.level = update(prefix + 'level', cat.level, value =>
                Math.max(1, campInteger(value, CAMP.maxLevels[cat.tier])));
            for (const slot of ['job', 'perk']) {
                cat[slot] = update(prefix + slot, cat[slot], value => Object.hasOwn(CAMP.perks, value) ? value : '');
            }
        }
    }
}

export function restoreCampState(storage) {
    const state = createCampState();
    try {
        const params = new URLSearchParams((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? '');
        updateFields(state, (key, fallback, normalize) => {
            if (!params.has(key)) return fallback;
            const value = params.get(key);
            if (typeof fallback === 'string') return normalize(value);
            if (value === '' && key.endsWith('.level')) return null;
            if (value === '' && (key === 'rp' || key.includes('.branch.'))) return '';
            const numeric = Number(value);
            return Number.isFinite(numeric) ? normalize(numeric) : fallback;
        });
    } catch {
        // Use the default state when browser storage is unavailable.
    }
    return state;
}

export function persistCampState(state, storage) {
    const params = new URLSearchParams();
    // Traverse a detached copy so recording inputs never changes reactive state.
    updateFields(structuredCampState(state), (key, value) => {
        params.set(key, value ?? '');
        return value;
    });
    try {
        (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, params.toString());
    } catch {
        // Keep the current input usable when browser storage is unavailable.
    }
}

function structuredCampState(state) {
    return {
        ...state,
        buildings: Object.fromEntries(Object.entries(state.buildings).map(([id, building]) => [id, {
            ...building,
            workers: building.workers.map(cat => ({ ...cat }))
        }]))
    };
}
