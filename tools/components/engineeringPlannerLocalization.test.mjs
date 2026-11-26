import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLocale, translateLabel } from '../../i18n/locale.js';
import { EngineeringPlannerPanel } from './EngineeringPlannerPanel.js';

test('engineering help translates its notes and fields in every planner mode', () => {
    const { helpNotes, helpRows, ratioText } = EngineeringPlannerPanel.computed;
    const context = {
        app: {
            engineeringPlannerDefaultAnchorSlot: () => 'scroll',
            engineeringPlannerWeights: () => ({ idea: 1420, scroll: 1 })
        },
        config: { slots: [{ id: 'idea', label: 'Idea' }, { id: 'scroll', label: 'Sun Scroll' }] },
        $label: translateLabel
    };
    try {
        for (const mode of ['requirements', 'throughput_game', 'throughput_calc']) {
            context.isThroughputMode = mode !== 'requirements';
            context.isCalculatorThroughputMode = mode === 'throughput_calc';
            for (const isItemsInputMode of [false, true]) {
                context.isItemsInputMode = isItemsInputMode;
                setLocale('ru');
                context.ratioText = ratioText.call(context);
                assert.equal(context.ratioText, 'Идея 1420 : Солнечный свиток 1');
                for (const note of helpNotes.call(context)) assert.doesNotMatch(note, /[a-z]/i);
                for (const { field, description } of helpRows.call(context)) {
                    assert.notEqual(translateLabel(field), field);
                    assert.notEqual(translateLabel(description), description);
                }

                setLocale('en');
                context.ratioText = ratioText.call(context);
                const [ratio, note] = helpNotes.call(context);
                assert.equal(ratio, 'Stable dependency ratio: Idea 1420 : Sun Scroll 1.');
                assert.ok(note.includes(isItemsInputMode ? 'items per hour' : 'current speed'));
            }
        }
    } finally {
        setLocale('en');
    }
});
