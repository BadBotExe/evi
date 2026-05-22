import assert from 'node:assert/strict';

import {
    decodeCardsRouteState,
    normalizeCardsRouteState,
    resolveCardsRouteState,
    serializeCardsRouteState
} from './urlState.js';

const data = {
    modes: [
        { id: 'normal', key: 'n' },
        { id: 'hard', key: 'h' },
        { id: 'nightmare', key: 'nm' }
    ],
    bonus_types: [
        { id: 'attack', key: 'a', label: 'Attack' },
        { id: 'defense', key: 'd', label: 'Defense' },
        { id: 'hp', key: 'hp', label: 'HP' }
    ]
};

const cardIndex = {
    wolf: { card: { id: 'wolf', key: 'wo' } },
    ghost: { card: { id: 'ghost', key: 'gh' } }
};

assert.deepEqual(
    resolveCardsRouteState('?c=wo&m=h&s=2&f=a-d&t=d'),
    {
        card: 'wo',
        mode: 'h',
        stars: '2',
        filter: 'a-d',
        tab: 'd'
    }
);

assert.deepEqual(
    resolveCardsRouteState('?card=ghost&mode=normal&stars=1&filter=hp&tab=card'),
    {
        card: 'ghost',
        mode: 'normal',
        stars: '1',
        filter: 'hp',
        tab: 'card'
    }
);

assert.deepEqual(
    resolveCardsRouteState('?c=wo&card=ghost&m=h&mode=normal&s=2&stars=1&f=a&filter=hp&t=b&tab=card'),
    {
        card: 'wo',
        mode: 'h',
        stars: '2',
        filter: 'a',
        tab: 'b'
    }
);

assert.deepEqual(
    normalizeCardsRouteState({
        c: 'wo',
        card: 'ghost',
        m: 'h',
        mode: 'normal',
        s: 2,
        stars: 1,
        f: 'a',
        filter: 'hp',
        t: 'd',
        tab: 'browse'
    }),
    {
        card: 'wo',
        mode: 'h',
        stars: '2',
        filter: 'a',
        tab: 'd'
    }
);

assert.equal(
    JSON.stringify(
        decodeCardsRouteState(
            { card: 'wo', mode: 'h', stars: '2', filter: 'a-d', tab: 'd' },
            { data, cardIndex }
        )
    ),
    JSON.stringify({
        card: 'wolf',
        mode: 'hard',
        stars: '2',
        filter: 'attack,defense',
        tab: 'drops'
    })
);

assert.equal(
    JSON.stringify(
        decodeCardsRouteState(
            { card: 'ghost', mode: 'hard', stars: '3', filter: 'hp,attack', tab: 'card' },
            { data, cardIndex }
        )
    ),
    JSON.stringify({
        card: 'ghost',
        mode: 'hard',
        stars: '3',
        filter: 'hp,attack',
        tab: 'card'
    })
);

assert.equal(
    serializeCardsRouteState({
        card: 'wolf',
        mode: 'hard',
        stars: '2',
        filter: 'attack,defense',
        tab: 'drops'
    }, { data, cardIndex }).toString(),
    'c=wo&m=h&s=2&f=a-d&t=d'
);

assert.equal(
    serializeCardsRouteState({
        card: '',
        mode: '',
        stars: '',
        filter: '',
        tab: ''
    }, { data, cardIndex }).toString(),
    ''
);

console.log('cards/app/urlState.test.mjs passed');
