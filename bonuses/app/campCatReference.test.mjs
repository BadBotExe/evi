import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { viewStateComputed } from './viewState.js';

const { bonuses: sources } = JSON.parse(readFileSync(new URL('../sources/camp_production.json', import.meta.url), 'utf8'));
const tavern = sources.find(source => source.id === 'camp_tavern_building');
const panelsFor = filteredItemSources => viewStateComputed.itemSectionPanels.call({
    activeItemType: 'camp_production',
    filteredItemSources
});

test('Camp Production exposes Tavern hire prices and rarity weights', () => {
    const [panel] = panelsFor(sources);
    const rows = panel.actions[0].tables[0].rows;
    assert.deepEqual(rows.map(row => row.price), ['200', '2,000', '10,000', '50,000']);
    assert.equal(rows[3][2], '10%');
    assert.deepEqual(rows.map(row => row.rarity), ['Common', 'Uncommon', 'Rare', 'Epic']);
    assert.deepEqual(panelsFor(sources.filter(source => source !== tavern)), []);
});

test('Camp Cats shows rarity-specific perks and full level progressions', () => {
    const [panel] = panelsFor([tavern]);
    const perks = panel.actions[1].tables[0].rows;
    assert.deepEqual(panel.actions[1].tables[0].columns.map(column => column.label), ['Effect', 'Common', 'Uncommon', 'Rare', 'Epic']);
    assert.equal(perks.find(row => row.perk === 'Pier Power').Epic, '+40%');
    const levels = panel.actions[2].tables;
    assert.deepEqual(levels.map(table => table.rows.length), [20, 30, 40, 50]);
    assert.deepEqual(levels[0].rows.at(-1), { level: 20, power: '300', next: '—', total: '2,160' });
    assert.equal(levels[3].rows[0].total, '0');
    assert.equal(levels[3].rows.at(-1).total, '110,880');
});
