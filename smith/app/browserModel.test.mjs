import assert from 'node:assert/strict';

import {
    buildSmithGridEntries,
    buildSmithMobileBrowseSections,
    buildSmithTabSummaries,
    resolveSelectedSmithActId,
    resolveSelectedSmithItemId
} from './browserModel.js';

const data = {
    tabs: [
        { id: 'act1', label: 'Act 1', item_ids: ['a', 'b', 'c', 'd'] },
        { id: 'inf', label: 'Inf', item_ids: ['x', 'y'] }
    ],
    itemsById: {
        a: { id: 'a', name: 'Alpha' },
        b: { id: 'b', name: 'Beta' },
        c: { id: 'c', name: 'Gamma' },
        d: { id: 'd', name: 'Delta' },
        x: { id: 'x', name: 'Xeno' },
        y: { id: 'y', name: 'Yotta' }
    }
};

assert.equal(resolveSelectedSmithActId(data, 'inf'), 'inf');
assert.equal(resolveSelectedSmithActId(data, 'missing'), 'act1');

assert.equal(resolveSelectedSmithItemId(data, 'c', 'act1'), 'c');
assert.equal(resolveSelectedSmithItemId(data, 'c', 'inf'), 'c');
assert.equal(resolveSelectedSmithItemId(data, 'missing', 'act1'), 'a');
assert.equal(resolveSelectedSmithItemId(data, '', 'inf'), 'x');

const entries = buildSmithGridEntries(data.tabs[0], data.itemsById, 'c');
assert.deepEqual(entries.map(entry => entry.item.id), ['a', 'b', 'c', 'd']);
assert.equal(entries[2].isSelected, true);
assert.equal(entries[3].isSelected, false);

assert.deepEqual(
    buildSmithTabSummaries(data, 'inf'),
    [
        { id: 'act1', label: 'Act 1', isActive: false },
        { id: 'inf', label: 'Inf', isActive: true }
    ]
);

const mobileSections = buildSmithMobileBrowseSections(data, 'y');
assert.deepEqual(mobileSections.map(section => section.label), ['Act 1', 'Inf']);
assert.deepEqual(mobileSections[1].entries.map(entry => entry.item.id), ['x', 'y']);
assert.equal(mobileSections[1].entries[1].isSelected, true);

console.log('smith/app/browserModel.test.mjs passed');
