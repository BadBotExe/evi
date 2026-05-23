import assert from 'node:assert/strict';

import {
    buildSmithGridRows,
    buildSmithTabSummaries,
    resolveSelectedSmithActId,
    resolveSelectedSmithItemId
} from './browserModel.js';

const data = {
    tabs: [
        { id: 'act1', label: 'Act 1', items_per_row: 3, item_ids: ['a', 'b', 'c', 'd'] },
        { id: 'inf', label: 'Inf', items_per_row: 2, item_ids: ['x', 'y'] }
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

const rows = buildSmithGridRows(data.tabs[0], data.itemsById, 'c');
assert.equal(rows.length, 2);
assert.deepEqual(rows[0].map(entry => entry.item.id), ['a', 'b', 'c']);
assert.deepEqual(rows[1].map(entry => entry.item.id), ['d']);
assert.equal(rows[0][2].isSelected, true);
assert.equal(rows[1][0].isSelected, false);

assert.deepEqual(
    buildSmithTabSummaries(data, 'inf'),
    [
        { id: 'act1', label: 'Act 1', isActive: false },
        { id: 'inf', label: 'Inf', isActive: true }
    ]
);

console.log('smith/app/browserModel.test.mjs passed');
