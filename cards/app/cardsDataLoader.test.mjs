import assert from 'node:assert/strict';

import {
    buildCardsData,
    resolveCardsBonusDataUrl,
    resolveBonusesCatalogUrl,
    resolveCardsDataUrl,
    resolveItemsDataUrl
} from './cardsDataLoader.js';

const rawCardsData = {
    modes: [
        { id: 'normal', key: 'n', label: 'Normal' },
        { id: 'hard', key: 'h', label: 'Hard' },
        { id: 'nightmare', key: 'nm', label: 'Nightmare' }
    ],
    starColors: { 0: { border: '#fff', glow: '' } },
    statDefs: [{ key: 'hp', label: 'Health', icon: 'images/heart.png?v=1' }],
    drop_items: {
        boar_meat: { rate: '1 in 4' },
        boar_card: { rate: '1 in 10,000' },
        pet_beeb: { rate: '1 in 5,000,000' }
    },
    categories: [
        {
            id: 'act1',
            label: 'Act 1',
            cards: [
                {
                    id: 'boar',
                    key: 'bo',
                    item_id: 'boar_card',
                    image_card: 'images/boar.png?v=1',
                    modes: {
                        normal: {
                            stats: { hp: '3' },
                            drops: [
                                { item: 'boar_meat' },
                                { item: 'boar_card' },
                                { item: 'pet_beeb' }
                            ],
                            footer: [
                                { item: 'gold', value: '1' },
                                { item: 'exp', value: '2' }
                            ]
                        }
                    }
                },
                {
                    id: 'placeholder',
                    name: '???',
                    placeholder: true
                }
            ]
        }
    ]
};

const rawCardsDataWithExpDropOverride = {
    ...rawCardsData,
    drop_items: {
        ...rawCardsData.drop_items,
        exp: {}
    }
};

const rawBonusData = {
    tiers_ref: {
        act1: [1, 8, 24]
    },
    bonuses: [
        {
            $ref: 'item:boar_card',
            tier: { $ref: '#/tiers_ref/act1' },
            bonuses: [
                { bonus: 'hp', unit_type: 'flat', tiers_formula: { coeff: 10 } }
            ]
        }
    ]
};

const rawBonusesCatalog = {
    bonus_types: [
        { id: 'hp', key: 'hp', label: 'HP' },
        { id: 'attack', label: 'ATK' }
    ]
};

const rawItems = [
    { id: 'gold', name: 'Gold', icon: 'images/gold.png?v=1' },
    { id: 'boar_meat', name: 'Boar Meat', icon: '../cards/images/items/boar_meat.png?v=2' },
    { id: 'boar_card', name: 'Boar Card', image: 'images/cards/act1/boar_card.png?v=3' },
    { id: 'pet_beeb', name: 'Beeb', icon: 'images/pets/beeb.png?v=4' }
];

const data = buildCardsData(rawCardsData, rawBonusData, rawBonusesCatalog, rawItems);
const dataWithExpDropOverride = buildCardsData(
    rawCardsDataWithExpDropOverride,
    rawBonusData,
    rawBonusesCatalog,
    rawItems
);

assert.deepEqual(data.bonus_types, [{ id: 'hp', key: 'hp', label: 'HP' }]);
assert.deepEqual(data.modes, rawCardsData.modes);
assert.equal(data.items.gold.image, '../items/images/gold.png?v=1');
assert.equal(data.items.boar_meat.image, '../cards/images/items/boar_meat.png?v=2');
assert.equal(data.items.boar_meat.rate, '1 in 4');
assert.equal(data.items.boar_card.image, '../items/images/cards/act1/boar_card.png?v=3');
assert.equal(data.items.boar_card.rate, '1 in 10,000');
assert.equal(data.items.pet_beeb.rate, '1 in 5,000,000');
assert.equal(data.items.exp.image, '../cards/images/items/exp.png?v=17d6d6d2a9');
assert.equal(dataWithExpDropOverride.items.exp.image, '../cards/images/items/exp.png?v=17d6d6d2a9');

const card = data.categories[0].cards[0];
assert.equal(card.name, 'Boar');
assert.equal(card.key, 'bo');
assert.equal(card.bonus_type, 'hp');
assert.equal(card.stars, 2);
assert.deepEqual(card.tiers, [1, 8, 24]);
assert.deepEqual(card.bonuses, {
    0: '+10 HP',
    1: '+20 HP',
    2: '+30 HP'
});

const nothingData = buildCardsData(
    {
        categories: [
            {
                cards: [
                    {
                        id: 'void',
                        key: 'vd',
                        item_id: 'void_card',
                        modes: {}
                    }
                ]
            }
        ]
    },
    {
        bonuses: [
            {
                $ref: 'item:void_card',
                tier: [1, 2],
                bonuses: [{ bonus: 'Nothing', unit_type: 'multiplier', tiers_formula: { init: 1, coeff: 0.02 } }]
            }
        ]
    },
    rawBonusesCatalog,
    [...rawItems, { id: 'void_card', name: 'Void Card', image: 'images/cards/void_card.png?v=4' }]
);

assert.deepEqual(nothingData.categories[0].cards[0].bonuses, {
    0: 'x1.02 Nothing',
    1: 'x1.04 Nothing'
});

assert.throws(
    () => buildCardsData(
        {
            modes: rawCardsData.modes,
            categories: [{ cards: [{ id: 'broken', key: 'br', item_id: 'missing_item', modes: {} }] }]
        },
        rawBonusData,
        rawBonusesCatalog,
        rawItems
    ),
    /Missing card bonus definition/
);

assert.throws(
    () => buildCardsData(
        {
            modes: rawCardsData.modes,
            categories: [{ cards: [{ id: 'broken', key: 'br', item_id: 'missing_card_item', modes: {} }] }]
        },
        {
            bonuses: [
                {
                    $ref: 'item:missing_card_item',
                    tier: [1],
                    bonuses: [{ bonus: 'hp', unit_type: 'flat', tiers_formula: { coeff: 10 } }]
                }
            ]
        },
        rawBonusesCatalog,
        rawItems
    ),
    /Missing card item metadata/
);

assert.throws(
    () => buildCardsData(
        {
            modes: rawCardsData.modes,
            categories: [{ cards: [{ id: 'missing_key', item_id: 'boar_card', modes: {} }] }]
        },
        rawBonusData,
        rawBonusesCatalog,
        rawItems
    ),
    /Missing card key/
);

assert.throws(
    () => buildCardsData(
        {
            modes: rawCardsData.modes,
            categories: [{
                cards: [
                    { id: 'alpha', key: 'dup', item_id: 'boar_card', modes: {} },
                    { id: 'beta', key: 'dup', item_id: 'boar_card', modes: {} }
                ]
            }]
        },
        {
            bonuses: [
                {
                    $ref: 'item:boar_card',
                    tier: [1],
                    bonuses: [{ bonus: 'hp', unit_type: 'flat', tiers_formula: { coeff: 10 } }]
                }
            ]
        },
        rawBonusesCatalog,
        rawItems
    ),
    /Duplicate card key/
);

assert.throws(
    () => buildCardsData(
        {
            modes: [{ id: 'normal', label: 'Normal' }],
            categories: [{ cards: [{ id: 'boar', key: 'bo', item_id: 'boar_card', modes: {} }] }]
        },
        rawBonusData,
        rawBonusesCatalog,
        rawItems
    ),
    /Missing mode key/
);

assert.match(resolveCardsDataUrl('https://example.com/cards/module.js'), /\/cards\/cards\.json\?v=/);
assert.match(resolveCardsBonusDataUrl('https://example.com/cards/module.js'), /\/bonuses\/sources\/cards\.json\?v=/);
assert.match(resolveBonusesCatalogUrl('https://example.com/cards/module.js'), /\/bonuses\/bonuses\.json\?v=/);
assert.match(resolveItemsDataUrl('https://example.com/cards/module.js'), /\/items\/items\.json\?v=/);

console.log('cards/app/cardsDataLoader.test.mjs passed');
