import assert from 'node:assert/strict';
import { createRouteSyncBuffer, resolveSelectedClassId } from './urlState.js';

{
    const classes = [
        { id: 'warrior', key: 'w', label: 'Warrior' },
        { id: 'mage', key: 'm', label: 'Mage' }
    ];

    assert.equal(
        resolveSelectedClassId(classes, null),
        'warrior',
        'first class is selected by default'
    );

    assert.equal(
        resolveSelectedClassId(classes, 'm'),
        'mage',
        'URL key resolves to matching class id'
    );

    assert.equal(
        resolveSelectedClassId(classes, 'unknown'),
        'warrior',
        'unknown class falls back to the first class'
    );

    assert.equal(
        resolveSelectedClassId([], null),
        null,
        'empty class list resolves to null'
    );
}

{
    const calls = [];
    const buffer = createRouteSyncBuffer((search) => calls.push(search));
    buffer.sync('?v=i');
    assert.deepEqual(calls, []);
    buffer.markReady('?fallback=1');
    assert.deepEqual(calls, ['?v=i']);
}

{
    const calls = [];
    const buffer = createRouteSyncBuffer((search) => calls.push(search));
    buffer.markReady('?fallback=1');
    assert.deepEqual(calls, ['?fallback=1']);
    buffer.sync('?v=i');
    assert.deepEqual(calls, ['?fallback=1', '?v=i']);
}

assert.throws(() => createRouteSyncBuffer(null), /applyRouteState function/);

console.log('bonuses/app/urlState.test.mjs passed');
