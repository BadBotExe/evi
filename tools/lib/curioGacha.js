export const CURIO_GACHA_WEIGHTS = [
    { rarity: 'common', weight: 45 },
    { rarity: 'uncommon', weight: 34 },
    { rarity: 'rare', weight: 19 },
    { rarity: 'epic', weight: 1.6 },
    { rarity: 'legendary', weight: 0.4 }
];

export const CURIO_RARITY_RANK = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4
};

export const CURIO_GACHA_DEFINITION_ORDER = [
    '73dfb882-4347-42b2-b118-2bbc3a81e607',
    'c1e13206-b2a9-4d83-8266-6621421beff8',
    '2ec691de-4888-4d3b-ba68-6f08389fd350',
    'e3e5bebd-73b0-4ca3-8372-c2afb08c2384',
    'ee7c4afc-2b5f-4ee6-9965-5f8988799fc1',
    '1ba01e17-307a-48f2-a843-18714536bc16',
    'f7cadf81-f1f4-4dce-b584-eb69a3ea2387',
    'd9b09743-8082-409d-8260-2b98155e73a9',
    'd400737a-2802-4e02-9559-b31e43c1bbd4',
    '428e363e-0d31-472c-9eb0-364ca82650cf',
    'd8dd906f-4afb-40e3-8212-f3621e136fc4',
    '7d61e63c-a7de-47f7-a5f3-76ae44483177',
    '961b2e57-cffb-4969-9efd-a8ecb863086b',
    '01d9ca35-48b6-4a62-bf8a-33785df36275',
    '2c0f298e-ead1-4ecf-aa48-11752f4f36d3',
    '797a05db-85b4-4b6b-9e1a-32c5fe651b62',
    '846cec10-a8dc-4d90-b3b8-dcee62455793',
    'b37a7454-9acb-4833-9b46-1aa6b2ed65af',
    '5e0c5fda-7215-4934-a368-8302316021b6',
    'd055bb8b-d47e-4d01-accf-de9e50f24b28'
];

export function normalizePlayFabId(value) {
    return String(value ?? '').trim();
}

export function isValidPlayFabId(value) {
    return /^[0-9a-f]+$/i.test(normalizePlayFabId(value));
}

export function legacyStringHash(value) {
    const text = String(value ?? '');
    let hash1 = 0x1505 | 0;
    let hash2 = 0x1505 | 0;
    for (let index = 0; index < text.length; index += 2) {
        hash1 = (Math.imul(hash1, 33) ^ text.charCodeAt(index)) | 0;
        if (index + 1 >= text.length) break;
        hash2 = (Math.imul(hash2, 33) ^ text.charCodeAt(index + 1)) | 0;
    }
    return (hash1 + Math.imul(hash2, 0x5D588B65)) | 0;
}

export class DotNetRandom {
    constructor(seed) {
        const max = 2147483647;
        const magic = 161803398;
        this.seedArray = Array(56).fill(0);
        const subtraction = seed === -2147483648 ? max : Math.abs(seed);
        let mj = magic - subtraction;
        if (mj < 0) mj += max;
        this.seedArray[55] = mj;
        let mk = 1;
        for (let index = 1; index < 55; index += 1) {
            const ii = (21 * index) % 55;
            this.seedArray[ii] = mk;
            mk = mj - mk;
            if (mk < 0) mk += max;
            mj = this.seedArray[ii];
        }
        for (let pass = 1; pass < 5; pass += 1) {
            for (let index = 1; index < 56; index += 1) {
                this.seedArray[index] -= this.seedArray[1 + ((index + 30) % 55)];
                if (this.seedArray[index] < 0) this.seedArray[index] += max;
            }
        }
        this.inext = 0;
        this.inextp = 21;
    }

    internalSample() {
        const max = 2147483647;
        let locINext = this.inext + 1;
        if (locINext >= 56) locINext = 1;
        let locINextp = this.inextp + 1;
        if (locINextp >= 56) locINextp = 1;
        let value = this.seedArray[locINext] - this.seedArray[locINextp];
        if (value === max) value -= 1;
        if (value < 0) value += max;
        this.seedArray[locINext] = value;
        this.inext = locINext;
        this.inextp = locINextp;
        return value;
    }

    nextDouble() {
        return this.internalSample() * (1.0 / 2147483647.0);
    }

    next(maxValue) {
        return Math.floor(this.nextDouble() * maxValue);
    }
}

export function buildCurioGachaData({ curioSources = [], items = new Map(), guidBySourceId = {} } = {}) {
    const byDefinitionId = new Map();
    for (const source of curioSources ?? []) {
        if (!source?.id) continue;
        const definitionId = guidBySourceId[source.id];
        const itemId = String(source.$ref ?? '').replace(/^item:/, '');
        const item = items instanceof Map ? items.get(itemId) : items?.[itemId];
        const rarity = String(item?.category ?? '').replace(/^curio_/, '');
        if (!definitionId || !rarity) continue;
        byDefinitionId.set(definitionId, {
            id: source.id,
            item_id: itemId,
            definition_id: definitionId,
            name: item?.name ?? source.name ?? source.id,
            image: item?.image ?? item?.icon ?? source.image ?? null,
            rarity,
            max_tier: maxCurioTier(source),
            required_copies: maxCurioTier(source) + 1
        });
    }

    const ordered = CURIO_GACHA_DEFINITION_ORDER
        .map(definitionId => byDefinitionId.get(definitionId))
        .filter(Boolean);
    const byRarity = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
    for (const curio of ordered) {
        if (byRarity[curio.rarity]) byRarity[curio.rarity].push(curio);
    }
    return { curios: ordered, byRarity };
}

export function maxCurioTier(source) {
    const tiers = (source?.ascension_bonuses ?? [])
        .map(entry => Number(entry?.tiers_formula?.max_tier))
        .filter(Number.isFinite);
    return Math.max(0, ...tiers);
}

export function rollCurioRarity(random, weights = CURIO_GACHA_WEIGHTS) {
    const totalWeight = weights.reduce((total, entry) => total + Number(entry.weight ?? 0), 0);
    const threshold = random.nextDouble() * totalWeight;
    let cumulative = 0;
    for (const entry of weights) {
        cumulative += Number(entry.weight ?? 0);
        if (cumulative >= threshold) return entry.rarity;
    }
    return weights[weights.length - 1]?.rarity ?? 'common';
}

export function createCurioChoice(random, gachaData, forcedRarity = null) {
    const rarity = forcedRarity ?? rollCurioRarity(random);
    const pool = gachaData?.byRarity?.[rarity] ?? [];
    if (!pool.length) return null;
    const poolIndex = random.next(pool.length);
    const curio = pool[poolIndex];
    return {
        ...curio,
        rarity,
        pool_index: poolIndex
    };
}

export function createSeededRandom(playFabId, seedCounter) {
    const seed_string = `${normalizePlayFabId(playFabId)}_${seedCounter}`;
    const hash = legacyStringHash(seed_string);
    return {
        seed_string,
        hash,
        random: new DotNetRandom(hash)
    };
}

export function rollCurioPull(playFabId, seedCounter, gachaData) {
    const seeded = createSeededRandom(playFabId, seedCounter);
    return {
        seed_counter: seedCounter,
        seed: seeded.seed_string,
        hash: seeded.hash,
        choices: [1, 2, 3].map(slot => ({
            slot,
            ...createCurioChoice(seeded.random, gachaData)
        }))
    };
}

export function rollCurioPity(playFabId, seedCounter, gachaData) {
    const seeded = createSeededRandom(playFabId, seedCounter);
    return {
        seed_counter: seedCounter,
        seed: seeded.seed_string,
        hash: seeded.hash,
        reward: createCurioChoice(seeded.random, gachaData, 'legendary')
    };
}

export function buildCurioSeedCache(playFabId, gachaData, maxSeed = 5000) {
    const normalizedId = normalizePlayFabId(playFabId);
    const seedCount = Math.max(0, Math.floor(Number(maxSeed) || 0));
    return Array.from({ length: seedCount }, (_, seedCounter) => ({
        seed_counter: seedCounter,
        pull: rollCurioPull(normalizedId, seedCounter, gachaData),
        pity: rollCurioPity(normalizedId, seedCounter, gachaData)
    }));
}

export function buildCurioEventsFromSeedCache({
    playFabId,
    gachaData,
    seedCache = null,
    ordinaryPulls = 1000,
    immediatePity = true,
    pityClaimPulls = null,
    startingSeedCounter = 0,
    startingPityCounter = 0
} = {}) {
    const normalizedId = normalizePlayFabId(playFabId);
    if (!isValidPlayFabId(normalizedId)) {
        return emptySimulation(normalizedId, 'Enter a valid PlayFabId.');
    }
    if (!gachaData?.curios?.length) {
        return emptySimulation(normalizedId, 'Curio gacha data is not available.');
    }

    let seedCounter = Math.max(0, Math.floor(Number(startingSeedCounter) || 0));
    let pityCounter = Math.max(0, Math.floor(Number(startingPityCounter) || 0));
    let pullNumber = 0;
    let pityClaimNumber = 0;
    const targetPulls = Math.max(0, Math.floor(Number(ordinaryPulls) || 0));
    const pitySchedule = normalizePityClaimPulls(pityClaimPulls, targetPulls, immediatePity);
    const collection = createCurioCollection(gachaData.curios);
    const events = [];
    const cache = Array.isArray(seedCache) ? seedCache : buildCurioSeedCache(normalizedId, gachaData, targetPulls + pitySchedule.length);

    while (pullNumber < targetPulls) {
        const pityBefore = pityCounter;
        const pull = cache[seedCounter]?.pull ?? rollCurioPull(normalizedId, seedCounter, gachaData);
        pityCounter += 1;
        pullNumber += 1;
        const selected = applyCurioSelection(collection, pull.choices, false);
        events.push({
            type: 'pull',
            seed_counter: seedCounter,
            pull_number: pullNumber,
            seed: pull.seed,
            hash: pull.hash,
            pity_before: pityBefore,
            pity_after: pityCounter,
            choices: pull.choices.map(choice => ({
                ...choice,
                selected: choice.definition_id === selected.choice?.definition_id && choice.slot === selected.choice?.slot,
                useful: collection.requiredCopiesById.get(choice.definition_id) > collection.beforeCounts.get(choice.definition_id)
            }))
        });
        seedCounter += 1;

        while (pitySchedule[pityClaimNumber] === pullNumber && pityCounter >= 100) {
            const pityBeforeClaim = pityCounter;
            const pity = cache[seedCounter]?.pity ?? rollCurioPity(normalizedId, seedCounter, gachaData);
            pityCounter -= 100;
            pityClaimNumber += 1;
            const pitySelected = applyCurioSelection(collection, [pity.reward], true);
            events.push({
                type: 'pity',
                seed_counter: seedCounter,
                pity_claim_number: pityClaimNumber,
                after_pull_number: pullNumber,
                seed: pity.seed,
                hash: pity.hash,
                pity_before: pityBeforeClaim,
                pity_after: pityCounter,
                reward: { ...pity.reward, selected: true, useful: pitySelected.useful }
            });
            seedCounter += 1;
        }
    }

    return {
        playFabId: normalizedId,
        events,
        summary: buildCurioSimulationSummary(collection, {
            seedCounter,
            pityCounter,
            pullNumber,
            pityClaimNumber
        })
    };
}

export function simulateCurioGacha({
    playFabId,
    gachaData,
    seedCache = null,
    ordinaryPulls = 1000,
    immediatePity = true,
    pityClaimPulls = null,
    startingSeedCounter = 0,
    startingPityCounter = 0
} = {}) {
    return buildCurioEventsFromSeedCache({
        playFabId,
        gachaData,
        seedCache,
        ordinaryPulls,
        immediatePity,
        pityClaimPulls,
        startingSeedCounter,
        startingPityCounter
    });
}

export function defaultPityClaimPulls(ordinaryPulls = 0) {
    const count = Math.floor(Math.max(0, Math.floor(Number(ordinaryPulls) || 0)) / 100);
    return Array.from({ length: count }, (_, index) => (index + 1) * 100);
}

export function normalizePityClaimPulls(pityClaimPulls, ordinaryPulls = 0, immediatePity = true) {
    const maxPull = Math.max(0, Math.floor(Number(ordinaryPulls) || 0));
    const maxClaims = Math.floor(maxPull / 100);
    if (!maxClaims) return [];
    const source = Array.isArray(pityClaimPulls) ? pityClaimPulls : [];
    if (!source.length && immediatePity) return defaultPityClaimPulls(maxPull);

    const result = [];
    let previous = 100;
    for (let index = 0; index < maxClaims; index += 1) {
        const fallback = source[index - 1] ?? (index + 1) * 100;
        const raw = Math.floor(Number(source[index]) || Number(fallback) || ((index + 1) * 100));
        const minPull = Math.max(previous, (index + 1) * 100);
        const next = Math.max(minPull, Math.min(maxPull, raw));
        result.push(next);
        previous = next;
    }
    return result;
}

export function validatePityClaimPulls(pityClaimPulls, ordinaryPulls = 0) {
    const schedule = normalizePityClaimPulls(pityClaimPulls, ordinaryPulls, false);
    let pityCounter = 0;
    let claimIndex = 0;
    for (let pull = 1; pull <= Math.max(0, Math.floor(Number(ordinaryPulls) || 0)); pull += 1) {
        pityCounter += 1;
        while (schedule[claimIndex] === pull) {
            if (pityCounter < 100) {
                return {
                    valid: false,
                    message: `Pity #${claimIndex + 1} cannot be claimed after pull ${pull}. It needs 100 available pity points.`
                };
            }
            pityCounter -= 100;
            claimIndex += 1;
        }
    }
    return { valid: true, message: '' };
}

export function findCurioPullSequenceMatches({
    playFabId,
    gachaData,
    observedPulls = [],
    pityClaimPulls = null,
    seedCache = null,
    maxPull = 5000,
    limit = 10
} = {}) {
    const rows = (observedPulls ?? [])
        .map(row => ({
            type: row?.type === 'pity' ? 'pity' : 'pull',
            choices: (row?.choices ?? row ?? []).map(value => String(value ?? '')).filter(Boolean)
        }))
        .filter(row => row.type === 'pity' ? row.choices.length === 1 : row.choices.length === 3);
    if (!rows.length) return [];

    const simulation = buildCurioEventsFromSeedCache({
        playFabId,
        gachaData,
        seedCache,
        ordinaryPulls: maxPull,
        pityClaimPulls: pityClaimPulls ?? defaultPityClaimPulls(maxPull)
    });
    if (simulation.summary.error) return [];

    const matches = [];
    for (let index = 0; index <= simulation.events.length - rows.length; index += 1) {
        const candidate = simulation.events.slice(index, index + rows.length);
        const matched = rows.every((row, rowIndex) => {
            const event = candidate[rowIndex];
            if (row.type !== event?.type) return false;
            if (row.type === 'pity') return event.reward?.definition_id === row.choices[0];
            return row.choices.every((definitionId, slotIndex) => (
                event.choices?.[slotIndex]?.definition_id === definitionId
            ));
        });
        if (!matched) continue;
        matches.push({
            start_pull: candidate[0].type === 'pull' ? candidate[0].pull_number : candidate[0].after_pull_number,
            end_pull: candidate[candidate.length - 1].type === 'pull'
                ? candidate[candidate.length - 1].pull_number
                : candidate[candidate.length - 1].after_pull_number,
            rows: candidate
        });
        if (matches.length >= limit) break;
    }
    return matches;
}

function emptySimulation(playFabId, error) {
    return {
        playFabId,
        events: [],
        summary: {
            error,
            seed_events: 0,
            ordinary_pulls: 0,
            pity_claims: 0,
            TotalPulls: 0,
            PityCounter: 0,
            completed_curios: 0,
            total_curios: 0,
            useful_picks: 0,
            salvage_picks: 0,
            selected: []
        }
    };
}

function createCurioCollection(curios) {
    return {
        counts: new Map(curios.map(curio => [curio.definition_id, 0])),
        beforeCounts: new Map(curios.map(curio => [curio.definition_id, 0])),
        requiredCopiesById: new Map(curios.map(curio => [curio.definition_id, curio.required_copies])),
        selected: [],
        usefulPicks: 0,
        salvagePicks: 0
    };
}

function applyCurioSelection(collection, choices, forced) {
    collection.beforeCounts = new Map(collection.counts);
    const choice = forced ? choices[0] : bestCurioChoice(choices, collection);
    if (!choice) return { choice: null, useful: false };
    const current = collection.counts.get(choice.definition_id) ?? 0;
    const required = collection.requiredCopiesById.get(choice.definition_id) ?? 0;
    const useful = current < required;
    if (useful) {
        collection.counts.set(choice.definition_id, current + 1);
        collection.usefulPicks += 1;
    } else {
        collection.salvagePicks += 1;
    }
    collection.selected.push({ ...choice, useful });
    return { choice, useful };
}

export function bestCurioChoice(choices, collection) {
    return [...(choices ?? [])].sort((left, right) => {
        const leftDeficit = curioDeficit(left, collection);
        const rightDeficit = curioDeficit(right, collection);
        const leftUseful = leftDeficit > 0 ? 1 : 0;
        const rightUseful = rightDeficit > 0 ? 1 : 0;
        if (leftUseful !== rightUseful) return rightUseful - leftUseful;
        const rarityDiff = (CURIO_RARITY_RANK[right?.rarity] ?? 0) - (CURIO_RARITY_RANK[left?.rarity] ?? 0);
        if (rarityDiff) return rarityDiff;
        if (leftDeficit !== rightDeficit) return leftDeficit - rightDeficit;
        return Number(left?.slot ?? 0) - Number(right?.slot ?? 0);
    })[0] ?? null;
}

function curioDeficit(choice, collection) {
    const required = collection.requiredCopiesById.get(choice?.definition_id) ?? 0;
    const current = collection.counts.get(choice?.definition_id) ?? 0;
    return Math.max(0, required - current);
}

function buildCurioSimulationSummary(collection, counters) {
    const selected = collection.selected.reduce((acc, choice) => {
        const existing = acc.get(choice.definition_id) ?? {
            id: choice.id,
            definition_id: choice.definition_id,
            name: choice.name,
            rarity: choice.rarity,
            image: choice.image,
            count: 0,
            required_copies: choice.required_copies,
            useful: 0,
            salvage: 0
        };
        existing.count += 1;
        if (choice.useful) existing.useful += 1;
        else existing.salvage += 1;
        acc.set(choice.definition_id, existing);
        return acc;
    }, new Map());
    const totalCurios = collection.requiredCopiesById.size;
    let completedCurios = 0;
    for (const [definitionId, required] of collection.requiredCopiesById.entries()) {
        if ((collection.counts.get(definitionId) ?? 0) >= required) completedCurios += 1;
    }
    return {
        seed_events: counters.seedCounter,
        ordinary_pulls: counters.pullNumber,
        pity_claims: counters.pityClaimNumber,
        TotalPulls: counters.seedCounter,
        PityCounter: counters.pityCounter,
        completed_curios: completedCurios,
        total_curios: totalCurios,
        useful_picks: collection.usefulPicks,
        salvage_picks: collection.salvagePicks,
        selected: [...selected.values()].sort((left, right) => {
            const rarityDiff = (CURIO_RARITY_RANK[right.rarity] ?? 0) - (CURIO_RARITY_RANK[left.rarity] ?? 0);
            if (rarityDiff) return rarityDiff;
            return left.name.localeCompare(right.name);
        })
    };
}

export function paginateCurioEvents(events, page, pullsPerPage = 100) {
    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    const fromPull = ((pageNumber - 1) * pullsPerPage) + 1;
    const toPull = pageNumber * pullsPerPage;
    return (events ?? []).filter(event => {
        if (event.type === 'pull') return event.pull_number >= fromPull && event.pull_number <= toPull;
        return event.seed_counter >= fromPull && event.seed_counter <= toPull + pageNumber;
    });
}

export function filterCurioEvents(events, { rarities = [], definitionId = '' } = {}) {
    const raritySet = new Set((rarities ?? []).filter(Boolean));
    const hasRarityFilter = raritySet.size > 0;
    const selectedDefinitionId = String(definitionId ?? '');
    const hasDefinitionFilter = selectedDefinitionId.length > 0;
    if (!hasRarityFilter && !hasDefinitionFilter) return events ?? [];
    return (events ?? []).filter(event => {
        const entries = event.type === 'pull'
            ? event.choices ?? []
            : event.reward ? [event.reward] : [];
        return entries.some(entry => (
            hasDefinitionFilter
                ? entry?.definition_id === selectedDefinitionId
                : raritySet.has(entry?.rarity)
        ));
    });
}

export function filterCurioEventsByPullRange(events, fromPull = 1, toPull = 100) {
    const from = Math.max(1, Math.floor(Number(fromPull) || 1));
    const to = Math.max(from, Math.floor(Number(toPull) || from));
    return (events ?? []).filter(event => {
        const pullNumber = event.type === 'pull'
            ? event.pull_number
            : event.after_pull_number ?? (Number(event.pity_claim_number ?? 0) * 100);
        return pullNumber >= from && pullNumber <= to;
    });
}

export function paginateCurioEventRows(events, page, rowsPerPage = 101) {
    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    const start = (pageNumber - 1) * rowsPerPage;
    return (events ?? []).slice(start, start + rowsPerPage);
}
