import assert from 'node:assert/strict';

import {
    normalizeSmithRouteState,
    resolveSmithRouteState,
    serializeSmithRouteState
} from './urlState.js';

assert.deepEqual(resolveSmithRouteState('?a=inf&i=infinite_boots_2'), {
    act: 'inf',
    item: 'infinite_boots_2',
    tab: '',
    speed: '',
    gemshop: ''
});

assert.deepEqual(resolveSmithRouteState('?act=act2&item=thorium_boots'), {
    act: 'act2',
    item: 'thorium_boots',
    tab: '',
    speed: '',
    gemshop: ''
});

assert.deepEqual(resolveSmithRouteState('?a=act1&act=act3&i=bronze_boots&item=sunstone_boots&t=browse&tab=item&s=125&speed=50&gs=4&gemshop=2'), {
    act: 'act1',
    item: 'bronze_boots',
    tab: 'browse',
    speed: '125',
    gemshop: '4'
});

assert.deepEqual(normalizeSmithRouteState({
    a: 'inf',
    act: 'act1',
    i: 'infinite_boots_2',
    item: 'bronze_boots',
    t: 'item',
    tab: 'browse',
    s: '75',
    speed: '50',
    gs: '3',
    gemshop: '1'
}), {
    act: 'inf',
    item: 'infinite_boots_2',
    tab: 'item',
    speed: '75',
    gemshop: '3'
});

assert.equal(
    serializeSmithRouteState({ act: 'act3', item: 'sunstone_boots', tab: 'browse', speed: '120', gemshop: '4' }).toString(),
    'a=act3&i=sunstone_boots&t=browse&s=120&gs=4'
);

assert.equal(
    serializeSmithRouteState({ act: '', item: '' }).toString(),
    ''
);

assert.equal(
    serializeSmithRouteState({ act: 'act1', item: 'steel_boots', speed: '90', gemshop: '2' }).toString(),
    'a=act1&i=steel_boots&s=90&gs=2'
);

console.log('smith/app/urlState.test.mjs passed');
