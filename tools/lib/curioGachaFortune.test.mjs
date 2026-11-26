import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CURIO_GUIDS } from '../../bonuses/app/saveMappings.js';
import {
    buildCurioGachaData,
    createCurioChoice,
    rollCurioPity,
    simulateCurioGacha
} from './curioGacha.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const items = readJson('../../items/items.json');
const { bonuses: curioSources } = readJson('../../bonuses/sources/curios.json');
const data = buildCurioGachaData({
    curioSources,
    items: new Map(items.map(item => [item.id, item])),
    guidBySourceId: CURIO_GUIDS
});
const target = data.byRarity.legendary.at(-1);
const playFabId = '506769617668B19A';

test('the current game catalog supplies all three new curios at the end of their rarity pools', () => {
    assert.equal(data.curios.length, 23);
    assert.deepEqual(Object.values(data.byRarity).map(pool => pool.length), [2, 3, 5, 6, 7]);
    assert.deepEqual(['rare', 'epic', 'legendary'].map(rarity => {
        const curio = data.byRarity[rarity].at(-1);
        return [curio.name, curio.required_copies];
    }), [['Opulent Spyglass', 7], ['Numbers Map', 10], ['Wish Finder', 10]]);
});

test('Fortune excludes the missed target, then grants it without an RNG draw', () => {
    const fortune = { targetDefinitionId: data.byRarity.legendary[1].definition_id, guaranteed: false };
    const draws = [];
    const random = {
        nextDouble() {
            draws.push('probability');
            return 0.5;
        },
        next(size) {
            draws.push(size);
            return 1;
        }
    };
    const choose = () => createCurioChoice(random, data, 'legendary', fortune);
    const miss = choose();
    assert.equal(miss.pool_index, 2);
    assert.equal(fortune.guaranteed, true);
    assert.equal(choose().definition_id, fortune.targetDefinitionId);
    assert.equal(fortune.guaranteed, false);
    assert.deepEqual(draws, ['probability', 6]);
});

test('pity uses the shared Fortune guarantee once the seed count reaches ten', () => {
    const fortune = { targetDefinitionId: target.definition_id, guaranteed: true };
    assert.deepEqual(rollCurioPity(playFabId, 8, data, fortune), rollCurioPity(playFabId, 8, data));
    assert.equal(fortune.guaranteed, true);
    assert.equal(rollCurioPity(playFabId, 9, data, fortune).reward.definition_id, target.definition_id);
    assert.equal(fortune.guaranteed, false);
});

test('the simulator uses the current pool for both unassisted rolls and Fortune', () => {
    const base = simulateCurioGacha({ playFabId, gachaData: data, ordinaryPulls: 500 });
    const targeted = simulateCurioGacha({
        playFabId,
        gachaData: data,
        ordinaryPulls: 500,
        targetDefinitionId: target.definition_id
    });
    assert.deepEqual(targeted.events.slice(0, 9), base.events.slice(0, 9));
    assert.equal(targeted.summary.TotalPulls, 505);
    assert.equal(targeted.summary.total_curios, 23);
    assert.ok(targeted.events.some((event, index) => event.reward?.definition_id !== base.events[index].reward?.definition_id));
});

test('Fortune starts from the configured TotalPulls, including when that event is pity', () => {
    const options = { playFabId, gachaData: data, ordinaryPulls: 101 };
    const baseline = simulateCurioGacha(options);
    const targeted = simulateCurioGacha({
        ...options,
        targetDefinitionId: target.definition_id,
        targetFromSeedCounter: 100,
        startingTargetGuaranteed: true
    });
    assert.deepEqual(targeted.events.slice(0, 100), baseline.events.slice(0, 100));
    assert.equal(targeted.events[100].type, 'pity');
    assert.equal(targeted.events[100].seed_counter, 100);
    assert.equal(targeted.events[100].reward.definition_id, target.definition_id);
});
