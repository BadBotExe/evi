// Merge-board solver: can a generator reach tier 6?
// State = counts of generators at tiers 1..5. Board capacity is fixed.
// Moves: spawn a tier-1 generator (cost 1, needs a free cell),
//        merge 3 of tier t into 1 of t+1 (free), merge 5 of tier t into 2 of t+1 (free).
// Search minimises the number of spawns (bucketed Dijkstra, merges cost 0).

const TOP = 6;
const BASE = 64;

function encode(c) {
    let k = 0;
    for (let i = 0; i < TOP - 1; i++) k = k * BASE + c[i];
    return k;
}

function decode(k) {
    const c = new Array(TOP - 1);
    for (let i = TOP - 2; i >= 0; i--) {
        c[i] = k % BASE;
        k = Math.floor(k / BASE);
    }
    return c;
}

// gens: array of 5 counts (tiers 1..5). fixed: cells blocked by other items.
// cap: total cells on the board. spawn: whether new tier-1 items may be created.
// finalOnly: 5 forces the last merge to be 5 x tier 5 -> 2 x tier 6, 3 forces 3 x tier 5 -> 1 x tier 6.
function solve({ gens, fixed, cap, spawn, finalOnly }) {
    const start = gens.slice(0, TOP - 1);
    const startKey = encode(start);
    const dist = new Map([[startKey, 0]]);
    const parent = new Map();
    const buckets = [[startKey]];
    let goal = null;

    for (let cost = 0; cost < buckets.length && !goal; cost++) {
        const queue = buckets[cost];
        for (let qi = 0; qi < queue.length && !goal; qi++) {
            const key = queue[qi];
            if (dist.get(key) !== cost) continue;
            const c = decode(key);

            for (let t = 0; t < TOP - 1 && !goal; t++) {
                for (const [take, give, op] of [[3, 1, 'm3'], [5, 2, 'm5']]) {
                    if (c[t] < take) continue;
                    if (t === TOP - 2 && ((finalOnly === 5 && op === 'm3') || (finalOnly === 3 && op === 'm5'))) continue;
                    if (t === TOP - 2) {
                        goal = { prev: key, op: { t: op, tier: t + 1 }, cost };
                        break;
                    }
                    const n = c.slice();
                    n[t] -= take;
                    n[t + 1] += give;
                    const nk = encode(n);
                    const old = dist.get(nk);
                    if (old === undefined || old > cost) {
                        dist.set(nk, cost);
                        parent.set(nk, { prev: key, op: { t: op, tier: t + 1 } });
                        queue.push(nk);
                    }
                }
            }

            if (!goal && spawn) {
                const used = fixed + c.reduce((a, b) => a + b, 0);
                if (used < cap) {
                    const n = c.slice();
                    n[0] += 1;
                    const nk = encode(n);
                    const old = dist.get(nk);
                    if (old === undefined || old > cost + 1) {
                        dist.set(nk, cost + 1);
                        parent.set(nk, { prev: key, op: { t: 'spawn', tier: 1 } });
                        while (buckets.length <= cost + 1) buckets.push([]);
                        buckets[cost + 1].push(nk);
                    }
                }
            }
        }
    }

    if (!goal) return { ok: false };

    const ops = [goal.op];
    let k = goal.prev;
    while (k !== startKey) {
        const p = parent.get(k);
        ops.push(p.op);
        k = p.prev;
    }
    ops.reverse();

    // Replay to get peak occupancy and to verify.
    const c = start.slice();
    let peak = fixed + c.reduce((a, b) => a + b, 0);
    for (const o of ops) {
        if (o.t === 'spawn') c[0] += 1;
        else if (o.t === 'm3') { c[o.tier - 1] -= 3; if (o.tier < TOP - 1) c[o.tier] += 1; }
        else { c[o.tier - 1] -= 5; if (o.tier < TOP - 1) c[o.tier] += 2; }
        peak = Math.max(peak, fixed + c.reduce((a, b) => a + b, 0));
    }
    return { ok: true, spawns: goal.cost, ops, peak };
}

// Smallest number of free cells (on top of the current layout) that makes the goal reachable.
function minFreeCells({ gens, fixed, spawn, finalOnly, maxExtra = 14 }) {
    const gensSum = gens.reduce((a, b) => a + b, 0);
    const used = fixed + gensSum;
    // Keep the searched state space small: at most 30 generators alive at once.
    let lo = 0, hi = Math.max(0, Math.min(maxExtra, 30 - gensSum));
    if (!solve({ gens, fixed, cap: used + hi, spawn, finalOnly }).ok) return null;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (solve({ gens, fixed, cap: used + mid, spawn, finalOnly }).ok) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

// Sand never helps the generator goal, it only occupies cells. Merging it early only frees cells,
// so the best plan merges sand first and as far as it compacts.
// DP bottom-up over tiers: at each tier choose a merges of 3 and b merges of 5.
// sand: counts at tiers 1..5. Returns the fewest cells the sand chain can occupy
// (including tier-6 sand produced by merging) and the merge ops that get there.
function compactChain(sand) {
    const memo = new Map();
    function f(t, n) {
        const key = t * 1000 + n;
        if (memo.has(key)) return memo.get(key);
        let best = null;
        for (let b = Math.floor(n / 5); b >= 0; b--) {
            for (let a = 0; 3 * a + 5 * b <= n; a++) {
                const left = n - 3 * a - 5 * b;
                const made = a + 2 * b;
                const rest = t === TOP - 2 ? made : f(t + 1, sand[t + 1] + made).cells;
                const cells = left + rest;
                if (best === null || cells < best.cells) best = { cells, a, b };
            }
        }
        memo.set(key, best);
        return best;
    }
    const total = f(0, sand[0]).cells;
    const ops = [];
    let n = sand[0];
    for (let t = 0; t < TOP - 1; t++) {
        const { a, b } = f(t, n);
        for (let i = 0; i < a; i++) ops.push({ t: 'm3', tier: t + 1 });
        for (let i = 0; i < b; i++) ops.push({ t: 'm5', tier: t + 1 });
        if (t < TOP - 2) n = sand[t + 1] + a + 2 * b;
    }
    return { cells: total, ops };
}

// Binary min-heap of [cost, key] pairs.
function MinHeap() { this.a = []; }
MinHeap.prototype.push = function (cost, key) {
    const a = this.a;
    a.push([cost, key]);
    let i = a.length - 1;
    while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        const t = a[p]; a[p] = a[i]; a[i] = t;
        i = p;
    }
};
MinHeap.prototype.pop = function () {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let m = i;
            if (l < a.length && a[l][0] < a[m][0]) m = l;
            if (r < a.length && a[r][0] < a[m][0]) m = r;
            if (m === i) break;
            const t = a[m]; a[m] = a[i]; a[i] = t;
            i = m;
        }
    }
    return top;
};

// Refined search, run after solve() has found the minimum number of spawns.
// Cost is lexicographic: spawns first (never more than maxSpawns), then, in keepMerging mode,
// the number of cells the leftovers occupy after they are merged as tightly as possible,
// then the number of merges. In greedy mode the leftovers are ignored, so the plan is the one
// with the fewest spawns and then the fewest merges.
// Returns the plan, the leftover counts for tiers 1..5 and any extra tier-6 items made by
// compacting the leftovers. Compacting steps are tagged phase: 'compact'.
// prefer5: the number of 3 -> 1 merges is minimised first, even if that takes more spawns than the minimum.
function solveRefined({ gens, fixed, cap, spawn, finalOnly, maxSpawns, keepMerging, prefer5 }) {
    const B_SPAWN = 1e7, B_LEFT = 1e4, B_M3 = 1e12;
    const start = gens.slice(0, TOP - 1);
    const startKey = encode(start);
    const dist = new Map([[startKey, 0]]);
    const parent = new Map();
    const heap = new MinHeap();
    heap.push(0, startKey);
    const leftCache = new Map();
    let best = null;

    while (heap.a.length) {
        const [cost, key] = heap.pop();
        if (cost !== dist.get(key)) continue;
        if (best && cost >= best.cost) break;
        const c = decode(key);

        for (const [take, , op] of [[5, 2, 'm5'], [3, 1, 'm3']]) {
            if (c[TOP - 2] < take) continue;
            if ((finalOnly === 5 && op === 'm3') || (finalOnly === 3 && op === 'm5')) continue;
            let cells = 0;
            if (keepMerging) {
                const left = c.slice();
                left[TOP - 2] -= take;
                const lk = encode(left);
                cells = leftCache.get(lk);
                if (cells === undefined) { cells = compactChain(left).cells; leftCache.set(lk, cells); }
            }
            const tcost = cost + 1 + cells * B_LEFT;
            if (!best || tcost < best.cost) best = { cost: tcost, key, op, take };
        }

        for (let t = 0; t < TOP - 2; t++) {
            for (const [take, give, op] of [[3, 1, 'm3'], [5, 2, 'm5']]) {
                if (c[t] < take) continue;
                const n = c.slice();
                n[t] -= take;
                n[t + 1] += give;
                const nk = encode(n), nc = cost + (prefer5 && op === 'm3' ? B_M3 : 1);
                const old = dist.get(nk);
                if (old === undefined || nc < old) {
                    dist.set(nk, nc);
                    parent.set(nk, { prev: key, op: { t: op, tier: t + 1 } });
                    heap.push(nc, nk);
                }
            }
        }

        if (spawn && Math.floor(cost / B_SPAWN) < maxSpawns) {
            const used = fixed + c.reduce((x, y) => x + y, 0);
            if (used < cap) {
                const n = c.slice();
                n[0] += 1;
                const nk = encode(n), nc = cost + B_SPAWN;
                const old = dist.get(nk);
                if (old === undefined || nc < old) {
                    dist.set(nk, nc);
                    parent.set(nk, { prev: key, op: { t: 'spawn', tier: 1 } });
                    heap.push(nc, nk);
                }
            }
        }
    }

    if (!best) return { ok: false };

    const ops = [{ t: best.op, tier: TOP - 1 }];
    let k = best.key;
    while (k !== startKey) {
        const p = parent.get(k);
        ops.push(p.op);
        k = p.prev;
    }
    ops.reverse();

    // Replay: peak occupancy, then the leftovers after the goal merge.
    const c = start.slice();
    let peak = fixed + c.reduce((x, y) => x + y, 0);
    let spawns = 0;
    for (const o of ops) {
        if (o.t === 'spawn') { c[0] += 1; spawns++; }
        else {
            const take = o.t === 'm3' ? 3 : 5, give = o.t === 'm3' ? 1 : 2;
            c[o.tier - 1] -= take;
            if (o.tier < TOP - 1) c[o.tier] += give; // the goal merge itself makes the target tier-6 items
        }
        peak = Math.max(peak, fixed + c.reduce((x, y) => x + y, 0));
    }

    let extraT6 = 0;
    if (keepMerging) {
        const comp = compactChain(c);
        for (const o of comp.ops) {
            const take = o.t === 'm3' ? 3 : 5, give = o.t === 'm3' ? 1 : 2;
            c[o.tier - 1] -= take;
            if (o.tier < TOP - 1) c[o.tier] += give; else extraT6 += give;
            ops.push({ t: o.t, tier: o.tier, phase: 'compact' });
        }
    }
    return {
        ok: true, spawns, ops, peak,
        left: c, extraT6, leftCells: c.reduce((x, y) => x + y, 0) + extraT6
    };
}


export const BOARD_SIZE = 25;
export const CHAINS = [
    { id: 'timeline', label: 'Timeline', prefix: 'TL' },
    { id: 'sand', label: 'Sand', prefix: 'S' }
];
export const GOALS = [
    { id: 'one', label: 'One T6, fewest T1' },
    { id: 'two', label: 'Two T6, fewest T1' },
    { id: 'five', label: 'Two T6, merge by 5' }
];

export function normalizeHourglassCount(value) {
    return Math.min(BOARD_SIZE, Math.max(0, Number.parseInt(value, 10) || 0));
}

export function buildHourglassBoard({ timeline, sand }) {
    const cells = Array(BOARD_SIZE).fill(null);
    let occupied = 0;
    for (const { id, prefix, label } of CHAINS) {
        let index = id === 'timeline' ? 0 : BOARD_SIZE - 1;
        const counts = id === 'timeline' ? timeline : sand;
        for (let tier = TOP; tier >= 1; tier--) {
            occupied += counts[tier - 1];
            for (let item = 0; item < counts[tier - 1]; item++) {
                if (index >= 0 && index < BOARD_SIZE && !cells[index]) {
                    cells[index] = { id, tier, label: prefix + tier, name: label + ' T' + tier };
                }
                index += id === 'timeline' ? 1 : -1;
            }
        }
    }
    return { cells, occupied, overflow: occupied > BOARD_SIZE };
}

export function calculateHourglassChain(state, chain) {
    const otherChain = CHAINS.find(entry => entry.id !== chain).id;
    const gens = state[chain].slice(0, TOP - 1);
    const other = state[otherChain].slice(0, TOP - 1);
    const compact = compactChain(other);
    const fixed = state[chain][TOP - 1] + state[otherChain][TOP - 1] + compact.cells;
    const options = { gens, fixed, cap: BOARD_SIZE, spawn: true };
    const free = BOARD_SIZE - fixed - gens.reduce((sum, count) => sum + count, 0);
    const prep = compact.ops.map(op => ({ ...op, chain: otherChain }));
    const wanted = state.goal === 'one' ? 3 : 5;
    let finalOnly = wanted;
    let result = solve({ ...options, finalOnly });
    if (!result.ok && finalOnly === 5) {
        finalOnly = 3;
        result = solve({ ...options, finalOnly });
    }
    const needed = minFreeCells({ ...options, finalOnly: result.ok || wanted === 3 ? finalOnly : undefined });
    const preparation = prep.length ? { before: other.reduce((sum, count) => sum + count, 0), after: compact.cells } : null;
    if (!result.ok) return { yield: 0, free, needed, preparation, ops: needed === null ? [] : prep };

    const prefer5 = state.goal === 'five' && finalOnly === 5;
    const refined = solveRefined({ ...options, finalOnly, prefer5, maxSpawns: prefer5 ? Infinity : result.spawns });
    const best = refined.ok ? refined : result;
    return {
        yield: finalOnly === 5 ? 2 : 1,
        fallback: finalOnly !== wanted,
        free,
        needed,
        preparation,
        spawns: best.spawns,
        minimumSpawns: result.spawns,
        peak: best.peak,
        leftovers: refined.ok ? refined.left : null,
        ops: prep.concat(best.ops.map(op => ({ ...op, chain })))
    };
}

