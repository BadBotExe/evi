import { buildMaxPanelBreakdownRows, maxPanelItemBaseKey, maxPanelItemHasNodeEdits, maxPanelItemKey } from './maxPanelHelpers.js';

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
        const item = {
            src: { id: 'sword_1' },
            unit_type: 'flat',
            bonus: { unit_type: 'flat', _tierBadgeLabel: null },
            tierBadge: null
        };
        assertEqual(maxPanelItemBaseKey(item), 'sword_1:', 'base key ignores unit type so dual-bonus items stay one row');
    }

    {
        const first = {
            src: { id: 'sword_1' },
            bonus: { unit_type: 'flat', _tierBadgeLabel: null },
            unit_type: 'flat',
            tierBadge: null
        };
        const second = {
            src: { id: 'sword_1' },
            bonus: { unit_type: 'percent', _tierBadgeLabel: null },
            unit_type: 'percent',
            tierBadge: null
        };
        assertEqual(maxPanelItemKey(first), maxPanelItemKey(second), 'dual-bonus item variants collapse into one display row');
    }

    {
        const app = {
            selectedBonus: 'attack',
            formatCompoundBreakdownRows() { return []; },
            formatBonusValue(value, bonusId, unitType) {
                return `${bonusId}:${unitType}:${value}`;
            }
        };
        const item = { unit_type: 'flat', bonus: { unit_type: 'flat' }, flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
        assertDeepEqual(
            buildMaxPanelBreakdownRows(item, app, 1),
            [{ text: 'attack:flat:0' }],
            'zeroed flat row keeps visible zero fallback'
        );
    }

    {
        const app = {
            selectedBonus: 'attack',
            formatCompoundBreakdownRows() { return []; },
            formatBonusValue(value, bonusId, unitType) {
                return `${bonusId}:${unitType}:${value}`;
            }
        };
        const item = { unit_type: 'multiplier', bonus: { unit_type: 'multiplier' }, flat: 0, percent: 0, percentStages: {}, multiplier: 1 };
        assertDeepEqual(
            buildMaxPanelBreakdownRows(item, app, 1),
            [{ text: 'attack:multiplier:1' }],
            'zeroed multiplier row keeps neutral multiplier visible'
        );
    }

    {
        const item = {
            bonus: {
                _groupBonuses: [{ bonus: 'attack' }, { bonus: 'attack' }]
            },
            selectedTierBadges: []
        };
        assertEqual(maxPanelItemHasNodeEdits(item, true), true, 'disabled node marks multi-node row as custom');
    }

    {
        const item = {
            bonus: {
                _groupBonuses: [{ bonus: 'attack' }]
            },
            selectedTierBadges: []
        };
        assertEqual(maxPanelItemHasNodeEdits(item, true), false, 'single-node row is not marked custom by helper');
    }

    console.log('maxPanelHelpers tests passed');
}

run();
