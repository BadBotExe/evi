import assert from 'node:assert/strict';
import { BonusUrlState, createRouteSyncBuffer, resolveSelectedClassId } from './urlState.js';

{
    const classes = [
        { id: 'warrior', key: 'w', label: 'Warrior' },
        { id: 'mage', key: 'm', label: 'Mage' }
    ];

    assert.equal(
        resolveSelectedClassId(classes, null),
        'warrior',
        'first class is selected by default'
    );

    assert.equal(
        resolveSelectedClassId(classes, 'm'),
        'mage',
        'URL key resolves to matching class id'
    );

    assert.equal(
        resolveSelectedClassId(classes, 'unknown'),
        'warrior',
        'unknown class falls back to the first class'
    );

    assert.equal(
        resolveSelectedClassId([], null),
        null,
        'empty class list resolves to null'
    );
}

{
    const calls = [];
    const buffer = createRouteSyncBuffer((search) => calls.push(search));
    buffer.sync('?v=i');
    assert.deepEqual(calls, []);
    buffer.markReady('?fallback=1');
    assert.deepEqual(calls, ['?v=i']);
}

{
    const calls = [];
    const buffer = createRouteSyncBuffer((search) => calls.push(search));
    buffer.markReady('?fallback=1');
    assert.deepEqual(calls, ['?fallback=1']);
    buffer.sync('?v=i');
    assert.deepEqual(calls, ['?fallback=1', '?v=i']);
}

assert.throws(() => createRouteSyncBuffer(null), /applyRouteState function/);

{
    const app = {
        data: {
            bonus_types: [],
            classes: [],
            types: {},
            categories: [],
            conditions: []
        },
        sectionKind: 'bonuses',
        calcEntries: [],
        parameters: [],
        engineeringPlannerState: {},
        itemTypeEntries: [],
        itemSubfilterEntries: [],
        itemSubfilterMode: null,
        hiddenItemSections: new Set(),
        itemSectionAllMode: true,
        activeConditions: new Set(),
        collapsedSections: new Set(),
        selectedCalc: null,
        selectedBonus: null,
        selectedClass: null,
        itemSearch: '',
        viewMode: 'bonus',
        mobileTab: 'sources',
        calcEntries: [],
        normalizeHiddenItemSections(set) {
            return set;
        },
        engineeringPlannerSlotUpgrade() {
            return null;
        },
        _bindMobileScroll() {},
        resourceBreakdownModifierDefinitionsByKey() {
            return new Map([
                ['cb', { id: 'hunter_cost_breakdown', key: 'cb', min: 0, max: 99, default: 0 }],
                ['cr', { id: 'hunter_cost_reduction', key: 'cr', min: 0, max: null, default: 0 }]
            ]);
        }
    };
    const state = new BonusUrlState(app);
    state.apply('?cb=20&cr=50&unknown=7');

    assert.deepEqual(
        app.resourceBreakdownModifierValues,
        {
            hunter_cost_breakdown: 20,
            hunter_cost_reduction: 50
        },
        'URL state restores persisted resource breakdown modifiers by id'
    );
}

console.log('bonuses/app/urlState.test.mjs passed');
