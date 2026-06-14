import assert from 'node:assert/strict';
import { viewStateComputed } from './viewState.js';

function attachComputed(context, names) {
    for (const name of names) {
        Object.defineProperty(context, name, {
            configurable: true,
            get() {
                return viewStateComputed[name].call(this);
            }
        });
    }
    return context;
}

{
    const context = attachComputed({
        data: {
            sources: [
                { id: 'p1', type: 'pet', category: 'combat', name: 'Wolf' },
                { id: 'p2', type: 'pet', name: 'Cat' }
            ],
            categories: [
                { id: 'combat', label: 'Combat', color: '#f00' }
            ],
            types: {
                pet: { label: 'Pets', tag_style: { color: '#0f0' } }
            }
        },
        itemType: 'pet',
        itemSearch: '',
        itemTypeLabel(id) {
            return id === 'pet' ? 'Pets' : id;
        },
        typeColor() {
            return '#0f0';
        },
        sourceSearchText(src) {
            return src.name.toLowerCase();
        }
    }, [
        'visibleSourceTypes',
        'itemTypeEntries',
        'activeItemType',
        'filteredItemSources',
        'itemSubfilterMode',
        'itemSubfilterEntries',
        'itemSections'
    ]);

    assert.equal(context.itemSubfilterMode, 'category');
    assert.deepEqual(
        context.itemSubfilterEntries.map(entry => entry.id),
        ['combat', '__default__'],
        'default category bucket is created for uncategorized items'
    );
    assert.deepEqual(
        context.itemSections.map(section => ({
            id: section.id,
            count: section.items.length
        })),
        [
            { id: 'combat', count: 1 },
            { id: '__default__', count: 1 }
        ],
        'category item sections split sources by category and default bucket'
    );
}

{
    const context = attachComputed({
        data: {
            sources: [
                { id: 's1', type: 'pet', name: 'Wolf Pup' },
                { id: 's2', type: 'pet', name: 'Cat Spirit' },
                { id: 's3', type: 'gear', name: 'Wolf Blade' }
            ],
            types: {
                pet: { label: 'Pets', tag_style: { color: '#0f0' } },
                gear: { label: 'Gear', tag_style: { color: '#999' } }
            }
        },
        selectedBonus: 'attack',
        bonusSourceSearch: 'wolf',
        _resolveBonusIds() {
            return ['attack'];
        },
        _bonusEntriesForBonusView(src) {
            return [{ src, bonus: 'attack' }];
        },
        sourceSearchText(src) {
            return src.name.toLowerCase();
        }
    }, [
        'groupedSources',
        'filteredGroupedSources',
        'visibleTypes'
    ]);

    assert.deepEqual(
        Object.fromEntries(Object.entries(context.filteredGroupedSources).map(([type, entries]) => [type, entries.map(entry => entry.src.id)])),
        {
            pet: ['s1'],
            gear: ['s3']
        },
        'bonus source search filters grouped source entries by source text'
    );
    assert.deepEqual(
        context.visibleTypes.map(([type]) => type),
        ['pet', 'gear'],
        'visible bonus source types are derived from filtered bonus source groups'
    );
}

{
    const itemContext = attachComputed({
        viewMode: 'item',
        itemSearch: 'wolf',
        itemSectionAllMode: false,
        bonusSourceSearch: ''
    }, [
        'mobileSearchFilterCount',
        'hasActiveMobileSearchFilters',
        'mobileSearchFilterIndicator'
    ]);

    assert.equal(itemContext.mobileSearchFilterCount, 2, 'item mobile filter indicator counts search and section filters');
    assert.equal(itemContext.hasActiveMobileSearchFilters, true);
    assert.equal(itemContext.mobileSearchFilterIndicator, '2');

    const bonusContext = attachComputed({
        viewMode: 'bonus',
        itemSearch: '',
        itemSectionAllMode: true,
        bonusSourceSearch: 'pet'
    }, [
        'mobileSearchFilterCount',
        'hasActiveMobileSearchFilters',
        'mobileSearchFilterIndicator'
    ]);

    assert.equal(bonusContext.mobileSearchFilterCount, 1, 'bonus mobile filter indicator counts active source search');
    assert.equal(bonusContext.mobileSearchFilterIndicator, '1');
}

{
    const context = attachComputed({
        data: {
            sources: [
                { id: 'g1', type: 'gear', slot: 'weapon', name: 'Sword' },
                { id: 'g2', type: 'gear', slot: 'helmet', name: 'Helm' }
            ],
            types: {
                gear: { label: 'Gear', tag_style: { color: '#999' } }
            }
        },
        itemType: 'gear',
        itemSearch: '',
        slotLabel(id) {
            return id.toUpperCase();
        },
        slotColor() {
            return '#999';
        },
        sourceSearchText(src) {
            return src.name.toLowerCase();
        }
    }, [
        'visibleSourceTypes',
        'itemTypeEntries',
        'activeItemType',
        'filteredItemSources',
        'itemSubfilterMode',
        'itemSubfilterEntries',
        'itemSections'
    ]);

    assert.equal(context.itemSubfilterMode, 'slot');
    assert.deepEqual(
        context.itemSubfilterEntries.map(entry => entry.id),
        ['weapon', 'helmet'],
        'slot mode exposes slot filters'
    );
    assert.deepEqual(
        context.itemSections.map(section => section.id),
        ['weapon', 'helmet'],
        'slot mode groups item sections by slot'
    );
}

{
    const context = attachComputed({
        data: {
            _base_sources: [{ id: 'base-a' }],
            sources: [{ id: 'actual-a' }]
        },
        selectedBonus: 'attack',
        maxTab: 'all',
        _calcItems(availableOnly, sourceList, scope) {
            return [{ availableOnly, sourceList, scope }];
        },
        _applyMaxPanelEdits(items, tab, scope) {
            return items.map(item => ({ ...item, tab, appliedScope: scope }));
        }
    }, [
        'maxItemsAvail',
        'maxItemsActual',
        'maxItems'
    ]);

    assert.equal(context.maxItemsAvail[0].availableOnly, true);
    assert.equal(context.maxItemsActual[0].scope, 'actual');
    assert.equal(context.maxItems[0].tab, 'avail', 'removed all max tab falls back to available items');
}

{
    const context = attachComputed({
        data: {
            _base_sources: [{ id: 'base-a' }],
            sources: [{ id: 'actual-a' }]
        },
        saveContext: { heroes: [] },
        selectedBonus: 'attack',
        maxTab: 'actual',
        _calcItems(availableOnly, sourceList, scope) {
            return [{ availableOnly, sourceList, scope }];
        },
        _applyMaxPanelEdits(items, tab, scope) {
            return items.map(item => ({ ...item, tab, appliedScope: scope }));
        }
    }, [
        'maxItemsAvail',
        'maxItemsActual',
        'maxItems'
    ]);

    assert.equal(context.maxItems[0].tab, 'actual', 'actual max tab remains available after save load');
}

{
    const context = attachComputed({
        data: {
            conditions: [
                { id: 'night', label: 'Night' },
                { id: 'day', label: 'Day' }
            ]
        },
        selectedBonus: 'attack',
        _resolveBonusIds() {
            return ['attack'];
        },
        _bonusEntriesForBonusView(src) {
            return src.bonuses;
        }
    }, [
        'groupedSources',
        'relevantConditions'
    ]);

    context.data.sources = [
        {
            id: 'src-1',
            type: 'pet',
            bonuses: [
                { bonus: 'attack', condition: 'night' }
            ]
        },
        {
            id: 'src-2',
            type: 'gear',
            bonuses: [
                { bonus: 'health', condition: 'day' }
            ]
        }
    ];

    assert.deepEqual(
        context.relevantConditions.map(condition => ({
            id: condition.id,
            disabled: condition.disabled
        })),
        [
            { id: 'night', disabled: false },
            { id: 'day', disabled: true }
        ],
        'only conditions referenced by the selected bonus stay enabled'
    );
}

console.log('bonuses/app/viewState.test.mjs passed');
