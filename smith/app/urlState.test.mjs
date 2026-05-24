import assert from 'node:assert/strict';

import {
    decodeSmithRouteState,
    normalizeSmithRouteState,
    resolveSmithRouteState,
    serializeSmithRouteState
} from './urlState.js';

const data = {
    tabs: [
        { id: 'act1', key: 'a1' },
        { id: 'act2', key: 'a2' },
        { id: 'act3', key: 'a3' },
        { id: 'inf', key: 'if' },
        { id: 'smeltery', key: 'sm' }
    ],
    itemsById: {
        bronze_boots: { id: 'bronze_boots', key: 'bbt' },
        steel_boots: { id: 'steel_boots', key: 'sbt' },
        thorium_boots: { id: 'thorium_boots', key: 'tbt' },
        sunstone_boots: { id: 'sunstone_boots', key: 'ubt' },
        infinite_boots_2: { id: 'infinite_boots_2', key: 'i2b' }
    }
};

assert.deepEqual(resolveSmithRouteState('?a=if&i=i2b'), {
    act: 'if',
    item: 'i2b',
    tab: '',
    speed: '',
    gemshop: '',
    multicraft: ''
});

assert.deepEqual(resolveSmithRouteState('?a=a1&i=bbt&t=b&s=125&gs=4&mc=2'), {
    act: 'a1',
    item: 'bbt',
    tab: 'b',
    speed: '125',
    gemshop: '4',
    multicraft: '2'
});

assert.deepEqual(normalizeSmithRouteState({
    a: 'inf',
    act: 'act1',
    i: 'i2b',
    item: 'bronze_boots',
    t: 'i',
    tab: 'browse',
    s: '75',
    speed: '50',
    gs: '3',
    gemshop: '1',
    mc: '2',
    multicraft: '4'
}), {
    act: 'inf',
    item: 'i2b',
    tab: 'i',
    speed: '75',
    gemshop: '3',
    multicraft: '2'
});

assert.deepEqual(
    decodeSmithRouteState({ act: 'a3', item: 'ubt', tab: 'b', speed: '120', gemshop: '4', multicraft: '2' }, { data }),
    {
        act: 'act3',
        item: 'sunstone_boots',
        tab: 'browse',
        speed: '120',
        gemshop: '4',
        multicraft: '2'
    }
);

assert.equal(
    serializeSmithRouteState({ act: 'act3', item: 'sunstone_boots', tab: 'browse', speed: '120', gemshop: '4', multicraft: '2' }, { data }).toString(),
    'a=a3&i=ubt&t=b&s=120&gs=4&mc=2'
);

assert.equal(
    serializeSmithRouteState({ act: '', item: '' }, { data }).toString(),
    ''
);

assert.equal(
    serializeSmithRouteState({ act: 'act1', item: 'steel_boots', speed: '90', gemshop: '2', multicraft: '1' }, { data }).toString(),
    'a=a1&i=sbt&s=90&gs=2&mc=1'
);

console.log('smith/app/urlState.test.mjs passed');
