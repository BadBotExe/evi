import assert from 'node:assert/strict';

import { buildCardsData } from './cardsDataLoader.js';

const rawCardsData = {
    modes: [
        { id: 'normal', key: 'n', label: 'Normal' }
    ],
    categories: [
        {
            id: 'act1',
            label: 'Act 1',
            stars: 4,
            tiers: [1, 8, 24, 60, 360],
            cards: [
                {
                    id: 'boar',
                    key: 'bo',
                    item_id: 'boar_card',
                    modes: {}
                }
            ]
        }
    ]
};

const rawBonusData = {
    bonuses: [
        {
            $ref: 'item:boar_card',
            tier: [1, 8, 24, 60, 360],
            bonuses: [
                { bonus: 'hp', unit_type: 'flat', tiers_formula: { coeff: 10 } }
            ]
        }
    ]
};

const rawBonusesCatalog = {
    bonus_types: [
        { id: 'hp', label: 'HP' }
    ]
};

const rawItems = [
    { id: 'boar_card', name: 'Boar Card', image: 'images/cards/act1/boar_card.png?v=3' }
];

const data = buildCardsData(rawCardsData, rawBonusData, rawBonusesCatalog, rawItems);
const category = data.categories[0];
const card = category.cards[0];

assert.equal('stars' in category, false);
assert.equal('tiers' in category, false);
assert.equal(card.stars, 4);
assert.deepEqual(card.tiers, [1, 8, 24, 60, 360]);

console.log('cards/app/cardsDataLoader.categoryMetadata.test.mjs passed');
