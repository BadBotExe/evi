import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCatalog, catalogSourceGroups } from './catalog.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('Crimson Sap lists each Nightmare tree once and retains the card drop links', () => {
    const items = buildCatalog(read('./items.json'), read('./item-sources.json'), read('../cards/cards.json'));
    const sap = items.find(item => item.id === 'crimson_sap');
    const groups = catalogSourceGroups(sap);
    assert.deepEqual([...groups.keys()], ['tree']);
    const sources = groups.get('tree');
    assert.deepEqual(sources.map(entry => entry.source.id), ['ash_tree', 'goak_tree', 'pyrewood_tree']);
    assert.ok(sources.every(entry => entry.drop && entry.modes.length === 1 && entry.modes[0] === 'nightmare'));
});
