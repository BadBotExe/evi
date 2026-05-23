import assert from 'node:assert/strict';

import {
    normalizeSmithRouteState,
    resolveSmithRouteState,
    serializeSmithRouteState
} from './urlState.js';

assert.deepEqual(resolveSmithRouteState('?a=inf&i=infinite_boots_2'), {
    act: 'inf',
    item: 'infinite_boots_2'
});

assert.deepEqual(resolveSmithRouteState('?act=act2&item=thorium_boots'), {
    act: 'act2',
    item: 'thorium_boots'
});

assert.deepEqual(resolveSmithRouteState('?a=act1&act=act3&i=bronze_boots&item=sunstone_boots'), {
    act: 'act1',
    item: 'bronze_boots'
});

assert.deepEqual(normalizeSmithRouteState({
    a: 'inf',
    act: 'act1',
    i: 'infinite_boots_2',
    item: 'bronze_boots'
}), {
    act: 'inf',
    item: 'infinite_boots_2'
});

assert.equal(
    serializeSmithRouteState({ act: 'act3', item: 'sunstone_boots' }).toString(),
    'a=act3&i=sunstone_boots'
);

assert.equal(
    serializeSmithRouteState({ act: '', item: '' }).toString(),
    ''
);

console.log('smith/app/urlState.test.mjs passed');
