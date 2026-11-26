import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLocale, translateLabel } from '../../i18n/locale.js';
import { formulaMethods } from '../app/formula.js';
import { PriceBreakdownPopover } from './PriceBreakdownPopover.js';

test('price breakdown labels and rendered formula variables follow the site locale', () => {
    const formula = { ...formulaMethods, $label: translateLabel };
    const expression = '250 * (Tier + 1) + 0.8 * (Total invested Curio Coins)';
    const finite = { $label: translateLabel, totalsRangeMaxLevel: 50, displayConfig: { finiteMaxLevel: 50 } };
    const infinite = { ...finite, totalsRangeMaxLevel: 75, displayConfig: { finiteMaxLevel: null } };
    const { customTotalsSummary } = PriceBreakdownPopover.computed;
    try {
        setLocale('ru');
        assert.match(customTotalsSummary.call(finite), /Максимум — 50/);
        assert.match(customTotalsSummary.call(infinite), /до уровня 75/);
        const localized = formula._formatFormulaExpressionHtml(expression);
        assert.match(localized, />Уровень</);
        assert.match(localized, />Всего потрачено монет диковинок</);
        assert.match(formula._formatFormulaExpressionHtml('round(lvl + Level)'), />уровень</);
        assert.match(localized, /250/);
        assert.match(localized, /&times;/);
        setLocale('en');
        assert.equal(customTotalsSummary.call(finite), 'Upgrade cost for the selected level range up to 50.');
        assert.match(formula._formatFormulaExpressionHtml(expression), /Total invested Curio Coins/);
    } finally {
        setLocale('en');
    }
});
