import assert from 'node:assert/strict';

import {
    buildCardIndex,
    buildFooterItems,
    countCardsForBonus,
    findFirstCardForMode,
    resolveActiveModeId,
    resolveCardField,
    resolveCardFooter,
    resolveItemReference,
    resolveSelectedCardId
} from './cardDataModel.js';

const data = {
    modes: [
        { id: 'normal' },
        { id: 'hard' }
    ],
    categories: [
        {
            label: 'Forest',
            footer: [{ value: 1 }],
            modes: {
                hard: {
                    footer: [{ value: 2 }]
                }
            },
            cards: [
                {
                    id: 'placeholder',
                    placeholder: true
                },
                {
                    id: 'alpha',
                    bonus_type: 'health',
                    stats: { hp: 5 },
                    modes: {
                        normal: {
                            stars: 2,
                            drops: [{ item: 'leaf', rate: '50%' }]
                        }
                    }
                },
                {
                    id: 'beta',
                    bonus_type: 'attack',
                    footer: [{ value: 3 }],
                    modes: {
                        hard: {
                            stars: 4,
                            gold: 100
                        }
                    }
                }
            ]
        }
    ]
};

const cardIndex = buildCardIndex(data);

assert.deepEqual(Object.keys(cardIndex).sort(), ['alpha', 'beta', 'placeholder']);
assert.equal(countCardsForBonus(data.categories, 'health'), 1);
assert.equal(countCardsForBonus(data.categories, 'mana'), 0);

const alpha = cardIndex.alpha.card;
const category = cardIndex.alpha.cat;
assert.equal(resolveCardField('stars', alpha.modes.normal, alpha, category, 'normal'), 2);
assert.deepEqual(resolveCardField('stats', alpha.modes.normal, alpha, category, 'normal'), { hp: 5 });

const beta = cardIndex.beta.card;
assert.deepEqual(resolveCardFooter(beta.modes.hard, beta, category, 'hard'), [{ value: 3 }]);
assert.deepEqual(resolveCardFooter({}, {}, category, 'hard'), [{ value: 2 }]);

assert.deepEqual(
    resolveItemReference(
        {
            leaf: { name: 'Leaf', image: '/leaf.png' }
        },
        { item: 'leaf', rate: '50%' }
    ),
    { item: 'leaf', name: 'Leaf', image: '/leaf.png', rate: '50%' }
);

assert.equal(findFirstCardForMode(data.categories, 'normal')?.id, 'alpha');
assert.equal(findFirstCardForMode(data.categories, 'hard', card => card.bonus_type === 'attack')?.id, 'beta');
assert.equal(findFirstCardForMode(data.categories, 'legendary'), null);

assert.equal(resolveActiveModeId(data, 'hard'), 'hard');
assert.equal(resolveActiveModeId(data, 'missing'), 'normal');
assert.equal(resolveSelectedCardId(data, cardIndex, 'beta'), 'beta');
assert.equal(resolveSelectedCardId(data, cardIndex, 'missing'), 'alpha');

assert.deepEqual(buildFooterItems({ gold: 100, exp: null }, []), [{ image: null, color: '#c8a020', value: 100 }]);
assert.deepEqual(buildFooterItems({ gold: 100 }, [{ value: 9 }]), [{ value: 9 }]);

console.log('cards/app/cardDataModel.test.mjs passed');
