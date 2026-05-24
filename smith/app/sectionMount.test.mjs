import assert from 'node:assert/strict';

import { resolveSmithRouteState } from './sectionMount.js';

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

assert.deepEqual(resolveSmithRouteState(''), {
    act: '',
    item: '',
    tab: '',
    speed: '',
    gemshop: ''
});

console.log('smith/app/sectionMount.test.mjs passed');
