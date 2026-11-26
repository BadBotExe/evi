import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { adjustedDropRate, formatDropRate } from './dropRates.js';
import { fishingDropRows } from './fishingOdds.js';

const data = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));

test('All ordinary card drops have numeric rates and MF only scales eligible rows', () => {
    const rows = data.categories.filter(category => category.id !== 'fishing')
        .flatMap(category => category.cards.flatMap(card => Object.values(card.modes ?? {})
            .flatMap(mode => mode.drops ?? [])));
    assert.ok(rows.length > 900);
    assert.ok(rows.every(row => Number.isFinite(row.baseRate) && row.baseRate > 0 && row.rate === undefined));

    const boar = data.categories[0].cards.find(card => card.id === 'boar');
    const [meat, card] = boar.modes.normal.drops;
    assert.equal(formatDropRate(adjustedDropRate(meat, 100)), '1 in 4');
    assert.equal(formatDropRate(adjustedDropRate(card, 100)), '1 in 5\u00a0000');
    assert.equal(formatDropRate(1 / 1082251.082), '1 in 1\u00a0082\u00a0251');
    assert.equal(formatDropRate(16), '16 in 1');
    assert.equal(formatDropRate(0.18), '1 in 5.556');
    assert.equal(formatDropRate(1 / 26.549), '1 in 26.549');
    assert.equal(formatDropRate(1 / 636.597), '1 in 637');
});

test('Fishing DR normalizes the boosted catch pool', () => {
    const { settings, ponds } = data.fishing;
    const card = data.categories.find(category => category.id === 'fishing').cards[0];
    const rows = fishingDropRows(settings, ponds[card.id], card.item_id, card.modes.normal.drops, 100);
    const total = rows.reduce((sum, row) => sum + row.rollChance, 0);
    assert.ok(Math.abs(total - 1) < 1e-12);
    const cardDrop = rows.find(row => row.item === card.item_id);
    assert.ok(cardDrop.rollChance > ponds[card.id].card);
    assert.ok(cardDrop.rollChance < 2 * ponds[card.id].card);
});
