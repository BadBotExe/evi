import { CAMP } from './campData.js?v=c51ac3dd24';

export const FISH_UNITS_PER_KG = 10;

const DIFFICULTY = { N: 0, H: 1, NM: 2 };

export function campInteger(value, max) {
    return Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
}

export function createCampState(example = false) {
    const buildings = Object.fromEntries(CAMP.buildings.map(({ id, starting_star, workerSlots }) => [id, {
        stars: example ? 3 : starting_star,
        levels: Array(3).fill(example ? 100 : 0),
        workers: Array.from({ length: workerSlots.at(-1) ?? 0 }, () => ({ target: '', tier: 0, level: null, job: '', perk: '' }))
    }]));
    if (example) {
        buildings.mine.workers = buildings.mine.workers.map(() => ({
            target: 'copper_ore', tier: CAMP.maxLevels.length - 1, level: CAMP.maxLevels.at(-1),
            job: 'mine', perk: 'lead'
        }));
    }
    return { buildings, buildingId: 'hall', mobileTab: 'summary', activeBought: 0, slotsBought: 0, storedRP: 0 };
}

export function campStars(state, id) {
    return Math.min(state.buildings.hall.stars, state.buildings[id].stars);
}

export function campTargets(id, stars) {
    return (CAMP.targets[id] ?? []).filter(([, , act]) => CAMP.zones[stars - 1]?.[act - 1]);
}

function levelFactor(tier, level) {
    const max = CAMP.maxLevels[tier];
    const effectiveLevel = level === null || level === '' ? max : Math.max(1, campInteger(level, max));
    return 1 + (CAMP.levelGrowth - 1) * (effectiveLevel - 1) / (max - 1);
}

function perkValue(tier, perk) {
    return (CAMP.perks[perk]?.[tier] ?? 0) / 100;
}

function catPerk(cat, perk) {
    return cat.job === perk || cat.perk === perk ? perkValue(cat.tier, perk) : 0;
}

function upgradeFactor(levels, stars) {
    return 1 + levels.slice(0, stars).reduce((sum, level) => sum + campInteger(level, Number.MAX_SAFE_INTEGER), 0) / 100;
}

export function campResourceMultiplier(fishRank) {
    return fishRank === undefined || fishRank === 3 ? 1 : 2 ** fishRank;
}

function targetNorm(id, stars, target) {
    const [, , act, fishRank] = target;
    const mode = DIFFICULTY[CAMP.zones[stars - 1][act - 1]];
    const [norm, refTier, refLevel] = CAMP.norms[id][act - 1][mode];
    return [norm * campResourceMultiplier(fishRank), refTier, refLevel];
}

export function campWorkerRate(id, stars, target, cat, leadership, upgrades) {
    const [norm, refTier, refLevel] = targetNorm(id, stars, target);
    const job = CAMP.jobPerks[id];
    const ratio = CAMP.tierStep ** (cat.tier - refTier)
        * levelFactor(cat.tier, cat.level) / levelFactor(refTier, refLevel)
        * (1 + catPerk(cat, job) + catPerk(cat, 'jack')) / (1 + perkValue(refTier, job))
        * (1 + leadership);
    return norm * upgrades * 3 * ratio / (2 + ratio);
}

function workersAt(state, id, slots, targets) {
    return state.buildings[id].workers.slice(0, slots).flatMap(cat => {
        const target = targets.find(([key]) => key === cat.target);
        return target && CAMP.maxLevels[cat.tier] ? [{ cat, target }] : [];
    });
}

export function campHiringGuide(building) {
    const job = CAMP.jobPerks[building.id];
    if (!job) return [];

    const tier = CAMP.maxLevels.length - 1;
    const level = CAMP.maxLevels[tier];
    const skills = [[job, 'lead'], [job, 'jack'], ['jack', 'lead']];
    return building.workerSlots.map((slots, index) => {
        const stars = index + 1;
        const targets = campTargets(building.id, stars);
        const crews = Array.from({ length: slots }).reduce(crews =>
            crews.flatMap(crew => skills.map(([job, perk]) => [...crew, { tier, level, job, perk }])), [[]]);
        const best = crews.reduce((best, cats) => {
            const leadership = cats.reduce((sum, cat) => sum + catPerk(cat, 'lead'), 0);
            const rate = cats.reduce((sum, cat) => sum + Math.max(...targets.map(target =>
                campWorkerRate(building.id, stars, target, cat, leadership, 1))), 0);
            return rate > best.rate ? { cats, rate } : best;
        }, { cats: [], rate: 0 });

        const groups = new Map();
        for (const cat of best.cats) {
            const key = cat.job + ':' + cat.perk;
            const group = groups.get(key) ?? { key, job: cat.job, perk: cat.perk, count: 0 };
            group.count++;
            groups.set(key, group);
        }
        return { key: stars, stars, crew: [...groups.values()] };
    });
}

function itemWeight(id, act) {
    if (id === 'pier') return 1 / FISH_UNITS_PER_KG;
    return act === 3 ? 10 : 1;
}

export function calculateCamp(state) {
    const crew = [];
    const resources = new Map();
    const production = CAMP.buildings.filter(({ workerSlots }) => workerSlots.length).map(({ id, workerSlots }) => {
        const stars = campStars(state, id);
        const targets = campTargets(id, stars);
        const workers = workersAt(state, id, workerSlots[stars - 1] ?? 0, targets);
        const upgrades = upgradeFactor(state.buildings[id].levels, stars);
        const leadership = workers.reduce((sum, { cat }) => sum + catPerk(cat, 'lead'), 0);
        let rate = 0;
        for (const { cat, target } of workers) {
            const [key, itemId, act] = target;
            const hourly = campWorkerRate(id, stars, target, cat, leadership, upgrades);
            const resource = resources.get(key) ?? { key, itemId, buildingId: id, hourly: 0, weight: itemWeight(id, act) };
            resource.hourly += hourly;
            resources.set(key, resource);
            crew.push(cat);
            rate += hourly;
        }
        return { id, rate };
    });

    const hall = campStars(state, 'hall');
    const store = campStars(state, 'store');
    const activeCap = 3 + CAMP.housingActive[campStars(state, 'house')] + CAMP.activePurchase.coeff * campInteger(state.activeBought, CAMP.activePurchase.max_tier);
    const valid = crew.length <= activeCap;
    const slots = 4 + CAMP.slotPurchase.coeff * campInteger(state.slotsBought, CAMP.slotPurchase.max_tier);
    const crewFactor = perk => 1 + crew.reduce((sum, cat) => sum + catPerk(cat, perk), 0);
    const capacity = Math.round(CAMP.chestCap[store]
        * upgradeFactor(state.buildings.store.levels, store) * crewFactor('keeper'));
    const weightedRate = [...resources.values()].reduce((sum, row) => sum + row.hourly * row.weight, 0);
    const storageHours = resources.size <= slots && weightedRate ? capacity / weightedRate : null;
    const rpHourly = CAMP.rpRate[hall - 1] * upgradeFactor(state.buildings.hall.levels, hall) * crewFactor('treas');
    const rpCap = CAMP.rpCap[hall - 1];
    const rpRoom = rpCap - campInteger(state.storedRP, rpCap);

    return {
        valid, active: crew.length, activeCap, slots, usedSlots: resources.size, capacity, storageHours,
        rpHourly, rpCap, rpHours: rpRoom / rpHourly,
        production,
        resources: [...resources.values()]
    };
}
