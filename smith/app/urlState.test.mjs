import assert from 'node:assert/strict';

import {
    normalizeSmithRouteState,
    resolveSmithRouteState,
    serializeSmithRouteState
} from './urlState.js';

assert.deepEqual(resolveSmithRouteState('?a=inf&i=infinite_boots_2'), {
    act: 'inf',
    item: 'infinite_boots_2',
    tab: ''
});

assert.deepEqual(resolveSmithRouteState('?act=act2&item=thorium_boots'), {
    act: 'act2',
    item: 'thorium_boots',
    tab: ''
});

assert.deepEqual(resolveSmithRouteState('?a=act1&act=act3&i=bronze_boots&item=sunstone_boots&t=browse&tab=item'), {
    act: 'act1',
    item: 'bronze_boots',
    tab: 'browse'
});

assert.deepEqual(normalizeSmithRouteState({
    a: 'inf',
    act: 'act1',
    i: 'infinite_boots_2',
    item: 'bronze_boots',
    t: 'item',
    tab: 'browse'
}), {
    act: 'inf',
    item: 'infinite_boots_2',
    tab: 'item'
});

assert.equal(
    serializeSmithRouteState({ act: 'act3', item: 'sunstone_boots', tab: 'browse' }).toString(),
    'a=act3&i=sunstone_boots&t=browse'
);

assert.equal(
    serializeSmithRouteState({ act: '', item: '' }).toString(),
    ''
);

console.log('smith/app/urlState.test.mjs passed');
