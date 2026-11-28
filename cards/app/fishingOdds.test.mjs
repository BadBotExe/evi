import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fishingDropRows, fishingLandChance, fishingWeightUnits, guaranteedFishingWeight, minimumFishingPower } from './fishingOdds.js';

const data = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));
const { settings, ponds } = data.fishing;

test('Fishing roll weights account for both species, the card, junk, and extra drops', () => {
    for (const card of data.categories.flatMap(category => category.cards)) {
        const pond = ponds[card.id];
        if (!pond) continue;
        const rows = fishingDropRows(settings, pond, card.item_id, card.modes.normal.drops);
        assert.ok(rows.every(row => row.rollChance > 0));
        assert.ok(Math.abs(1 - rows.reduce((sum, row) => sum + row.rollChance, 0)) < 1e-12);
        assert.equal(rows.find(row => row.item === card.item_id).rollChance, pond.card);
    }
    assert.equal(ponds.river_shallows.extra.recipe_pier_2, 0.00002);
    assert.equal(ponds.sea_shallows.extra.recipe_pier_3, 0.00001);
});

test('AFK landing uses Fishing Power and the fish weight distribution', () => {
    assert.equal(fishingLandChance(settings, 0.3, 0), 0);
    assert.equal(fishingLandChance(settings, 0.3, 30), 1);
    assert.equal(guaranteedFishingWeight(settings, 1490), 14.9);
    assert.equal(fishingLandChance(settings, 0.6, 20), 3 / 16);
    assert.equal(fishingLandChance(settings, 0.6, 30), 12 / 16);
    assert.equal(fishingLandChance(settings, 0.6, 40), 1);
});

test('Fishing weight rounds to the in-game units', () => {
    assert.equal(fishingWeightUnits(0.01), 1);
    assert.equal(fishingWeightUnits(100.6), 1010);
    assert.equal(fishingWeightUnits(1035), 10400);
});

test('Offline forecast accounts for the combined Fish Weight bonus', () => {
    const kg = ponds.sea_pool.fish.bolt_fish;
    assert.equal(fishingLandChance(settings, kg, 7230, 1, 71.6), 0.25);
    assert.equal(minimumFishingPower(settings, kg, 1, 71.6), 12200);
    assert.equal(fishingLandChance(settings, kg, 12199, 1, 71.6), 15 / 16);
    assert.equal(fishingLandChance(settings, kg, 12200, 1, 71.6), 1);
    assert.equal(guaranteedFishingWeight(settings, 7230), 72.3);
});
