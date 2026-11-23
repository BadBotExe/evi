import { CHAINS, GOALS, normalizeHourglassCount } from '../lib/hourglassRebirthCalculator.js?v=dfc6a45030';

const STORAGE_KEY = 'evitania_hourglass_rebirth';
const DEFAULTS = {
    timeline: [3, 2, 2, 1, 0, 3],
    sand: [3, 2, 0, 0, 0, 3],
    goal: 'two'
};

export function restoreHourglassState(storage) {
    let params = new URLSearchParams();
    try {
        params = new URLSearchParams((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? '');
    } catch {
        // Use the example counts when browser storage is unavailable.
    }
    return {
        timeline: DEFAULTS.timeline.map((count, index) => readCount(params, 'timeline', index, count)),
        sand: DEFAULTS.sand.map((count, index) => readCount(params, 'sand', index, count)),
        goal: GOALS.find(({ id }) => id === params.get('goal'))?.id ?? DEFAULTS.goal
    };
}

function readCount(params, chain, index, fallback) {
    const value = params.get(chain + (index + 1));
    return /^\d+$/.test(value ?? '') ? normalizeHourglassCount(value) : fallback;
}

export function persistHourglassState(state, storage) {
    const params = new URLSearchParams({ goal: state.goal });
    for (const { id } of CHAINS) {
        state[id].forEach((count, index) => params.set(id + (index + 1), count));
    }
    try {
        (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, params.toString());
    } catch {
        // Keep the current input usable when browser storage is unavailable.
    }
}
