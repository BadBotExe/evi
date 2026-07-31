import assert from 'node:assert/strict';
import {
    bestCurioChoice,
    buildCurioGachaData,
    CURIO_GACHA_DEFINITION_ORDER,
    defaultPityClaimPulls,
    filterCurioEventsByPullRange,
    filterCurioEvents,
    legacyStringHash,
    normalizePityClaimPulls,
    paginateCurioEventRows,
    simulateCurioGacha,
    validatePityClaimPulls
} from './curioGacha.js';

function makeCurio(definitionId, rarity, index = 0, maxTier = 3) {
    return {
        id: `curios_${rarity}_${index}`,
        item_id: `curio_${rarity}_${index}`,
        definition_id: definitionId,
        name: `${rarity} ${index}`,
        image: `../items/images/curio/${rarity}_${index}.png`,
        rarity,
        max_tier: maxTier,
        required_copies: maxTier + 1
    };
}

function makeGachaData() {
    const rarities = ['common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'legendary', 'rare', 'rare', 'epic', 'epic', 'epic', 'rare', 'legendary', 'legendary', 'epic', 'legendary', 'legendary', 'legendary'];
    const curios = CURIO_GACHA_DEFINITION_ORDER.map((definitionId, index) => makeCurio(definitionId, rarities[index], index));
    return {
        curios,
        byRarity: curios.reduce((acc, curio) => {
            acc[curio.rarity].push(curio);
            return acc;
        }, { common: [], uncommon: [], rare: [], epic: [], legendary: [] })
    };
}

{
    assert.equal(legacyStringHash('506769617668B19A_608'), -1639554155);
}

{
    const gachaData = makeGachaData();
    const result = simulateCurioGacha({
        playFabId: '506769617668B19A',
        gachaData,
        ordinaryPulls: 100,
        immediatePity: true
    });

    assert.equal(result.summary.ordinary_pulls, 100);
    assert.equal(result.summary.pity_claims, 1);
    assert.equal(result.summary.seed_events, 101);
    assert.equal(result.summary.PityCounter, 0);
    assert.equal(result.events[0].type, 'pull');
    assert.equal(result.events[0].choices.length, 3);
    assert.equal(result.events[100].type, 'pity');
    assert.equal(result.events[100].after_pull_number, 100);
    assert.equal(result.events[100].reward.rarity, 'legendary');
}

{
    const gachaData = makeGachaData();
    const result = simulateCurioGacha({
        playFabId: '506769617668B19A',
        gachaData,
        ordinaryPulls: 200,
        pityClaimPulls: [150, 200]
    });
    const pityEvents = result.events.filter(event => event.type === 'pity');

    assert.deepEqual(
        pityEvents.map(event => [event.pity_claim_number, event.after_pull_number, event.seed_counter]),
        [[1, 150, 150], [2, 200, 201]],
        'custom pity schedule should claim after configured ordinary pulls and consume deterministic seed events'
    );
    assert.equal(result.summary.pity_claims, 2);
    assert.equal(result.summary.seed_events, 202);
}

{
    assert.deepEqual(defaultPityClaimPulls(350), [100, 200, 300]);
    assert.deepEqual(
        normalizePityClaimPulls([10, 150, 1000], 300, true),
        [100, 200, 300],
        'pity schedule normalization should enforce minimum claim pull and non-decreasing order'
    );
    assert.equal(validatePityClaimPulls([100, 200, 300], 300).valid, true);
    assert.equal(validatePityClaimPulls([100, 100], 200).valid, true);
}

{
    const curioSources = [
        {
            id: 'curios_elden_monolith',
            $ref: 'item:curio_elden_monolith',
            ascension_bonuses: [
                { tiers_formula: { max_tier: 3 } }
            ]
        },
        {
            id: 'curios_fifth_stab',
            $ref: 'item:curio_fifth_stab',
            ascension_bonuses: [
                { tiers_formula: { max_tier: 5 } }
            ]
        }
    ];
    const items = new Map([
        ['curio_elden_monolith', { id: 'curio_elden_monolith', name: 'Elden Monolith', category: 'curio_common', image: '../items/images/curio/elden_monolith.png' }],
        ['curio_fifth_stab', { id: 'curio_fifth_stab', name: 'Fifth Stab', category: 'curio_common', image: '../items/images/curio/fifth_stab.png' }]
    ]);
    const data = buildCurioGachaData({
        curioSources,
        items,
        guidBySourceId: {
            curios_elden_monolith: CURIO_GACHA_DEFINITION_ORDER[0],
            curios_fifth_stab: CURIO_GACHA_DEFINITION_ORDER[1]
        }
    });

    assert.equal(data.curios[0].name, 'Elden Monolith');
    assert.equal(data.curios[0].required_copies, 4);
    assert.equal(data.curios[1].required_copies, 6);
    assert.deepEqual(data.byRarity.common.map(curio => curio.name), ['Elden Monolith', 'Fifth Stab']);
}

{
    const usefulCommon = makeCurio(CURIO_GACHA_DEFINITION_ORDER[0], 'common', 0);
    const completedLegendary = makeCurio(CURIO_GACHA_DEFINITION_ORDER[14], 'legendary', 14);
    const collection = {
        counts: new Map([
            [usefulCommon.definition_id, 0],
            [completedLegendary.definition_id, completedLegendary.required_copies]
        ]),
        requiredCopiesById: new Map([
            [usefulCommon.definition_id, usefulCommon.required_copies],
            [completedLegendary.definition_id, completedLegendary.required_copies]
        ])
    };

    assert.equal(
        bestCurioChoice([{ slot: 1, ...completedLegendary }, { slot: 2, ...usefulCommon }], collection).definition_id,
        usefulCommon.definition_id,
        'best choice should prefer a useful lower rarity curio over a completed legendary'
    );
}

{
    const common = makeCurio(CURIO_GACHA_DEFINITION_ORDER[0], 'common', 0);
    const legendary = makeCurio(CURIO_GACHA_DEFINITION_ORDER[14], 'legendary', 14);
    const events = [
        { type: 'pull', pull_number: 1, choices: [{ slot: 1, ...common }] },
        { type: 'pull', pull_number: 100, choices: [{ slot: 1, ...common }] },
        { type: 'pull', pull_number: 500, choices: [{ slot: 1, ...legendary }] },
        { type: 'pity', pity_claim_number: 1, reward: legendary }
    ];

    assert.deepEqual(
        filterCurioEvents(events, { rarities: ['legendary'] }).map(event => event.type === 'pull' ? event.pull_number : 'pity'),
        [500, 'pity'],
        'rarity filter should match pull choices and pity rewards'
    );
    assert.deepEqual(
        filterCurioEvents(events, { rarities: ['common'], definitionId: legendary.definition_id }).map(event => event.type === 'pull' ? event.pull_number : 'pity'),
        [500, 'pity'],
        'selected curio filter should override rarity filters'
    );
    assert.deepEqual(
        paginateCurioEventRows(filterCurioEvents(events, { rarities: ['legendary'] }), 1, 101),
        [events[2], events[3]],
        'filtered pagination should page already-filtered rows instead of original pull ranges'
    );
    assert.deepEqual(
        filterCurioEventsByPullRange(events, 100, 100).map(event => event.type === 'pull' ? event.pull_number : 'pity'),
        [100, 'pity'],
        'pull range should include the pity reward attached to its 100th ordinary pull'
    );
}
