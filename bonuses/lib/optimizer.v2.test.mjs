import { readFileSync } from 'node:fs';
import { optimize } from './optimizer.v2.js';

function assignmentSignature(result) {
    return result.assignment.map(container => `${container.id}:${container.items.map(item => item.id).join(',')}`).join('|');
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected "${expected}", got "${actual}"`);
    }
}

function assert(condition, label) {
    if (!condition) throw new Error(label);
}

function assertLessOrEqual(actual, expected, label) {
    if (actual > expected) {
        throw new Error(`${label}: expected <= ${expected}, got ${actual}`);
    }
}

function run() {
    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'mammoth_ring', slot: 'ring', bonuses: [{ bonus: 'attack', value: 10, unit_type: 'flat' }] },
                { id: 'ashen_ring', slot: 'ring', max: 1, bonuses: [{ bonus: 'attack', value: 9, unit_type: 'flat' }] }
            ],
            [],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:mammoth_ring|ring_2:mammoth_ring', 'unlimited ring can duplicate');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'flat_ring', slot: 'ring', bonuses: [{ bonus: 'attack', value: 100, unit_type: 'flat' }] },
                { id: 'percent_ring', slot: 'ring', max: 1, bonuses: [{ bonus: 'attack', value: 100, unit_type: 'percent' }] }
            ],
            [],
            'attack',
            { flat: 100, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:flat_ring|ring_2:percent_ring', 'compound objective chooses mixed best');
    }

    {
        const result = optimize(
            [
                { id: 'c1', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 },
                { id: 'c2', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 }
            ],
            [
                {
                    id: 'rw_pre',
                    slot: 'rune_socket',
                    size: 6,
                    exclusive: true,
                    max: 1,
                    bonuses: [{ bonus: 'attack', value: 200, unit_type: 'flat' }],
                    constraint: { excludes: ['pre'] }
                }
            ],
            [
                {
                    id: 'pre',
                    slot: 'rune_socket',
                    max: 6,
                    bonuses: [{ bonus: 'attack', value: 30, unit_type: 'flat' }],
                    constraint: { excludes: ['rw_pre'] }
                },
                { id: 'rys', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 15, unit_type: 'flat' }] },
                { id: 'lum', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 27, unit_type: 'flat' }] },
                { id: 'ort', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 36, unit_type: 'flat' }] },
                { id: 'vex', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 45, unit_type: 'flat' }] }
            ],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(result.total, 540, 'rune exact search total');
        assert(!assignmentSignature(result).includes('pre'), 'pre excluded by stronger solution');
        assert(!assignmentSignature(result).includes('rys'), 'dominated weaker rune ignored');
        assert(!assignmentSignature(result).includes('lum'), 'mid rune ignored when stronger exists');
        assert(!assignmentSignature(result).includes('ort'), 'higher mid rune ignored when vex exists');
    }

    {
        const result = optimize(
            [
                { id: 'c1', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 }
            ],
            [],
            [
                { id: 'rys', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 15, unit_type: 'flat' }] },
                { id: 'lum', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 27, unit_type: 'flat' }] },
                { id: 'ort', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 36, unit_type: 'flat' }] },
                { id: 'vex', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 45, unit_type: 'flat' }] }
            ],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(result.total, 270, 'dominated stackable runes prune to strongest rune');
        assertEqual(assignmentSignature(result), 'c1:vex,vex,vex,vex,vex,vex', 'single-circle runes fill with strongest rune only');
    }

    {
        const result = optimize(
            [
                { id: 'c1', slot_type: 'rune_socket', slots: 6, maxExclusive: 1 }
            ],
            [],
            [
                { id: 'limited_vex', slot: 'rune_socket', max: 1, bonuses: [{ bonus: 'attack', value: 45, unit_type: 'flat' }] },
                { id: 'ort', slot: 'rune_socket', bonuses: [{ bonus: 'attack', value: 36, unit_type: 'flat' }] }
            ],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(result.total, 225, 'max-limited stronger rune does not prune reusable weaker rune');
        assertEqual(assignmentSignature(result), 'c1:limited_vex,ort,ort,ort,ort,ort', 'limited rune is mixed with reusable fallback');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'a', slot: 'ring', bonuses: [{ bonus: 'respawn_time', value: -2, unit_type: 'percent' }] },
                { id: 'b', slot: 'ring', bonuses: [{ bonus: 'respawn_time', value: -1, unit_type: 'percent' }] }
            ],
            [],
            'respawn_time',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:|ring_2:', 'raw optimizer expects pre-signed minimize inputs');
    }

    {
        const result = optimize(
            [
                { id: 'ring_1', slot_type: 'ring', slots: 1, maxExclusive: 1 },
                { id: 'ring_2', slot_type: 'ring', slots: 1, maxExclusive: 1 }
            ],
            [
                { id: 'a', slot: 'ring', bonuses: [{ bonus: 'attack', value: 10, unit_type: 'flat' }], constraint: { excludes: ['b'] } },
                { id: 'b', slot: 'ring', bonuses: [{ bonus: 'attack', value: 100, unit_type: 'flat' }] }
            ],
            [],
            'attack',
            { flat: 0, percent: 0, percentStages: {}, multiplier: 1 }
        );
        assertEqual(assignmentSignature(result), 'ring_1:b|ring_2:b', 'reverse excludes respected');
    }

    runRealDataAttackPerfTest();
    console.log('optimizer.v2 tests passed');
}

function runRealDataAttackPerfTest() {
    const { containers, exclusiveItems, stackableItems, currentTotals } = buildRealAttackOptimizerInput();
    const restoreConsole = silenceConsoleLogs();
    try {
        for (let i = 0; i < 20; i += 1) {
            optimize(containers, exclusiveItems, stackableItems, 'attack', currentTotals);
        }

        const samples = [];
        for (let i = 0; i < 20; i += 1) {
            const t0 = performance.now();
            optimize(containers, exclusiveItems, stackableItems, 'attack', currentTotals);
            samples.push(performance.now() - t0);
        }

        const worst = Math.max(...samples);
        assertLessOrEqual(worst, 10, `real-data attack perf budget exceeded (${samples.map(value => value.toFixed(2)).join(', ')} ms)`);
    } finally {
        restoreConsole();
    }
}

let cachedRealAttackOptimizerInput = null;

function buildRealAttackOptimizerInput() {
    if (cachedRealAttackOptimizerInput) return cachedRealAttackOptimizerInput;

    const bonusesData = readJson('../bonuses.json');
    const gearData = readJson('../sources/gear.json');
    const runesData = readJson('../sources/runes.json');
    const baseStatsData = readJson('../sources/base_stats.json');

    const containers = [];
    for (const circle of bonusesData.rune_circles ?? []) {
        containers.push({ id: circle.id, slot_type: 'rune_socket', slots: circle.slots, maxExclusive: 1 });
    }
    for (const slotDef of bonusesData.slot_types ?? []) {
        if (!slotDef.max || slotDef.id === 'rune_socket') continue;
        for (let index = 0; index < slotDef.max; index += 1) {
            containers.push({ id: `${slotDef.id}_${index}`, slot_type: slotDef.id, slots: 1, maxExclusive: 1 });
        }
    }

    const exclusiveItems = [];
    const stackableItems = [];
    const sourceFiles = [gearData, runesData];
    for (const file of sourceFiles) {
        for (const source of file.bonuses ?? []) {
            if (!source?.slot) continue;
            const attackBonuses = resolveAttackBonuses(source, file, bonusesData);
            if (!attackBonuses.length) continue;

            const item = {
                id: source.id,
                slot: source.slot,
                size: source.size,
                max: source.max,
                exclusive: source.exclusive,
                constraint: source.constraint,
                bonuses: attackBonuses
            };
            if ((source.size ?? 1) > 1 || (source.max ?? Infinity) === 1 || source.exclusive) {
                exclusiveItems.push(item);
            } else {
                stackableItems.push(item);
            }
        }
    }

    const currentTotals = {
        flat: sumNonSlottedAttack(baseStatsData, bonusesData),
        percent: 0,
        percentStages: {},
        multiplier: 1,
        compoundRule: bonusesData.compound_rules?.attack ?? null
    };

    cachedRealAttackOptimizerInput = { containers, exclusiveItems, stackableItems, currentTotals };
    return cachedRealAttackOptimizerInput;
}

function resolveAttackBonuses(source, file, bonusesData) {
    const resolved = [];
    for (const bonusEntry of source.bonuses ?? []) {
        if (bonusEntry.bonus === 'attack') {
            const value = resolveBonusValue(file, source, bonusEntry);
            if (Number(value ?? 0) !== 0) {
                resolved.push({ bonus: 'attack', unit_type: bonusEntry.unit_type ?? 'flat', value });
            }
        }

        const derived = bonusesData.derived_bonus_maps?.[bonusEntry.bonus] ?? [];
        for (const derivedEntry of derived) {
            if (derivedEntry.bonus !== 'attack') continue;
            if (derivedEntry.classes?.length && !derivedEntry.classes.includes('warrior')) continue;
            const baseValue = resolveBonusValue(file, source, bonusEntry);
            const value = baseValue * Number(derivedEntry.multiplier ?? 1);
            if (Number(value ?? 0) !== 0) {
                resolved.push({ bonus: 'attack', unit_type: derivedEntry.unit_type ?? 'flat', value, derived_from: bonusEntry.bonus });
            }
        }
    }
    return resolved;
}

function sumNonSlottedAttack(file, bonusesData) {
    let total = 0;
    for (const source of file.bonuses ?? []) {
        if (source?.slot) continue;
        for (const bonusEntry of resolveAttackBonuses(source, file, bonusesData)) {
            if ((bonusEntry.unit_type ?? 'flat') === 'flat') total += Number(bonusEntry.value ?? 0);
        }
    }
    return total;
}

function resolveBonusValue(file, source, bonusEntry) {
    const formula = resolveFormula(file, source, bonusEntry);
    if (!formula) return Number(bonusEntry.value ?? 0);
    const startTier = bonusEntry.unlock_at_tier ?? 1;
    return applyFormula(formula, startTier);
}

function resolveFormula(file, source, bonusEntry) {
    if (source.tiers_formula === false || bonusEntry?.tiers_formula === false) return null;
    if (bonusEntry?.value !== undefined && !bonusEntry?.tiers_formula) return null;
    const fileFormula = typeof file?.tiers_formula === 'object' ? file.tiers_formula : null;
    const sourceFormula = typeof source?.tiers_formula === 'object' ? source.tiers_formula : null;
    const bonusFormula = typeof bonusEntry?.tiers_formula === 'object' ? bonusEntry.tiers_formula : null;
    if (!fileFormula && !sourceFormula && !bonusFormula) return null;
    return { ...(fileFormula ?? {}), ...(sourceFormula ?? {}), ...(bonusFormula ?? {}) };
}

function applyFormula(formula, tierOffset = 1) {
    const step = formula.step ?? 1;
    const startOffset = formula.init_at_unlock_tier ? 0 : 1;
    const steps = Math.max(0, Math.floor((Number(formula.max_tier ?? tierOffset) - tierOffset + startOffset) / step));
    if (formula.type === 'base_percent') {
        const init = Number(formula.init ?? 0);
        const percent = Number(formula.percent ?? formula.coeff ?? 0);
        const growthPerStep = init * (percent / 100);
        return roundFormulaValue(init + (steps * growthPerStep), formula.rounding ?? 'none');
    }
    return roundFormulaValue((Number(formula.init ?? 0) + (steps * Number(formula.coeff ?? 0))), formula.rounding ?? 'none');
}

function roundFormulaValue(value, mode = 'none') {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    if (mode === 'floor') return Math.floor(numeric);
    if (mode === 'ceil') return Math.ceil(numeric);
    if (mode === 'none') return numeric;
    return Math.round(numeric);
}

function readJson(relativePath) {
    const url = new URL(relativePath, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8'));
}

function silenceConsoleLogs() {
    const originalLog = console.log;
    console.log = () => {};
    return () => {
        console.log = originalLog;
    };
}

run();
