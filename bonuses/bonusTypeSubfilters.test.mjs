import {
    BONUS_TYPE_ALL_SUBFILTER,
    BONUS_TYPE_SLOT_SUBFILTER_PREFIX,
    buildBonusTypeSubfilterEntries,
    filterBonusTypeEntries,
    resolveActiveBonusTypeSubfilter,
    shouldShowBonusTypeSubfilters
} from './app/bonusTypeSubfilters.js';

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected "${expected}", got "${actual}"`);
    }
}

function assertDeepEqual(actual, expected, label) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
    }
}

function run() {
    {
        const entries = [
            { src: { id: 'a', category: 'card_act1' } },
            { src: { id: 'b', category: 'card_act2' } },
            { src: { id: 'c', category: 'card_act1' } },
            { src: { id: 'd' } }
        ];
        const result = buildBonusTypeSubfilterEntries({
            entries,
            dataCategories: [
                { id: 'card_act1', label: 'Act 1', color: '#111' },
                { id: 'card_act2', label: 'Act 2', color: '#222' }
            ],
            defaultCategoryId: '__default__',
            type: 'card',
            categoryLabel: id => `category:${id}`,
            categoryColor: id => `color:${id}`,
            itemTypeLabel: id => `type:${id}`,
            typeColor: id => `type-color:${id}`,
            slotLabel: id => `slot:${id}`,
            slotColor: id => `slot-color:${id}`
        });
        assertDeepEqual(result, [
            { id: 'card_act1', label: 'Act 1', color: '#111', count: 2 },
            { id: 'card_act2', label: 'Act 2', color: '#222', count: 1 },
            { id: '__default__', label: 'type:card', color: 'type-color:card', count: 1 }
        ], 'category subfilters include known categories and uncategorized fallback');
    }

    {
        const entries = [
            { src: { id: 'sword', slot: 'weapon' } },
            { src: { id: 'helm', slot: 'helmet' } },
            { src: { id: 'ring1', slot: 'ring' } },
            { src: { id: 'ring2', slot: 'ring' } }
        ];
        const result = buildBonusTypeSubfilterEntries({
            entries,
            dataCategories: [],
            defaultCategoryId: '__default__',
            type: 'gear',
            categoryLabel: id => `category:${id}`,
            categoryColor: id => `color:${id}`,
            itemTypeLabel: id => `type:${id}`,
            typeColor: id => `type-color:${id}`,
            slotLabel: id => `slot:${id}`,
            slotColor: id => `slot-color:${id}`
        });
        assertDeepEqual(result, [
            { id: `${BONUS_TYPE_SLOT_SUBFILTER_PREFIX}weapon`, label: 'slot:weapon', color: 'slot-color:weapon', count: 1 },
            { id: `${BONUS_TYPE_SLOT_SUBFILTER_PREFIX}helmet`, label: 'slot:helmet', color: 'slot-color:helmet', count: 1 },
            { id: `${BONUS_TYPE_SLOT_SUBFILTER_PREFIX}ring`, label: 'slot:ring', color: 'slot-color:ring', count: 2 }
        ], 'slot fallback builds per-slot groups when categories are absent');
    }

    {
        const entries = [
            { src: { id: 'weapon_1', slot: 'weapon' } },
            { src: { id: 'helmet_1', slot: 'helmet' } },
            { src: { id: 'weapon_2', slot: 'weapon' } }
        ];
        assertDeepEqual(
            filterBonusTypeEntries(entries, BONUS_TYPE_ALL_SUBFILTER, '__default__').map(entry => entry.src.id),
            ['weapon_1', 'helmet_1', 'weapon_2'],
            'all subfilter keeps every entry'
        );
        assertDeepEqual(
            filterBonusTypeEntries(entries, `${BONUS_TYPE_SLOT_SUBFILTER_PREFIX}weapon`, '__default__').map(entry => entry.src.id),
            ['weapon_1', 'weapon_2'],
            'slot subfilter keeps only matching slot entries'
        );
    }

    {
        assertEqual(
            resolveActiveBonusTypeSubfilter('missing', [{ id: 'a' }, { id: 'b' }]),
            BONUS_TYPE_ALL_SUBFILTER,
            'invalid selected tab falls back to all'
        );
        assertEqual(
            shouldShowBonusTypeSubfilters(false, [{ id: 'a' }, { id: 'b' }]),
            true,
            'tabs show only when more than one group exists and panel is expanded'
        );
        assertEqual(
            shouldShowBonusTypeSubfilters(true, [{ id: 'a' }, { id: 'b' }]),
            false,
            'collapsed panel hides tabs'
        );
        assertEqual(
            shouldShowBonusTypeSubfilters(false, [{ id: 'a' }]),
            false,
            'single group does not render tabs'
        );
    }

    console.log('bonusTypeSubfilters tests passed');
}

run();
