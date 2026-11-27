import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameTerm, hasDisplayLabel, onLocaleChange, setLocale, translateLabel } from './locale.js';

test('versioned imports use the same active locale', async () => {
    const otherEntry = await import('./locale.js?state-test');
    try {
        otherEntry.setLocale('ru');
        assert.equal(translateLabel('Recipe'), 'Рецепт');
        setLocale('en');
        assert.equal(otherEntry.translateLabel('Recipe'), 'Recipe');
    } finally {
        setLocale('en');
    }
});

test('section labels use the game catalog and preserve application values', () => {
    const changes = [];
    const unsubscribe = onLocaleChange(locale => changes.push(locale));
    try {
        setLocale('ru');
        assert.equal(translateLabel('Recipe'), 'Рецепт');
        assert.equal(translateLabel('Grey Bream'), gameTerm('item', 'grey_bream'));
        assert.equal(translateLabel('Act 1 Zone 2'), 'Акт 1, зона 2');
        assert.equal(translateLabel('Housing - Grey Bream'), `Жильё - ${gameTerm('item', 'grey_bream')}`);
        assert.equal(translateLabel('Tier {0}', [0]), 'Уровень 0');
        assert.equal(translateLabel('Can {0} reach T6?', ['Sand']), 'Можно ли получить Песок T6?');
        assert.equal(translateLabel('RYS'), 'RYS');
        assert.equal(translateLabel(0), 0);
        assert.equal(translateLabel(undefined), undefined);
        assert.equal(translateLabel(''), '');
        assert.equal(translateLabel('\n    '), '\n    ');
        assert.equal(hasDisplayLabel(''), false);
        assert.equal(hasDisplayLabel('\n    '), false);
        assert.ok(hasDisplayLabel('Recipe'));

        setLocale('en');
        assert.equal(translateLabel('Recipe'), 'Recipe');
        assert.equal(translateLabel('Tier {0}', [3]), 'Tier 3');
        assert.deepEqual(changes, ['ru', 'en']);
    } finally {
        unsubscribe();
        setLocale('en');
    }
});
