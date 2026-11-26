import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { gameTerm, setLocale, t } from '../../i18n/locale.js';
import { matchesCardSearchQuery } from './browserModel.js';
import { loadCardsData } from './cardsDataLoader.js';
import { createLocalizedCardsData } from './localizedCardsData.js';

test('the same game IDs render in both locales and remain searchable', async () => {
    const initial = await loadCardsData({
        moduleUrl: new URL('../module.js', import.meta.url),
        fetchImpl: async url => ({ json: async () => JSON.parse(await readFile(new URL(url), 'utf8')) })
    });
    const build = createLocalizedCardsData(initial);
    const boar = data => data.categories.flatMap(category => category.cards).find(card => card.id === 'boar');

    try {
        setLocale('ru');
        const russian = build();
        assert.equal(boar(russian).name, 'Кабан');
        assert.equal(russian.items.boar_card.name, 'Карточка: Кабан');
        assert.equal(russian.modes[0].label, gameTerm('difficulty', 'normal'));
        assert.ok(matchesCardSearchQuery(boar(russian), 'кабан'));
        assert.ok(matchesCardSearchQuery(boar(russian), 'boar'));
        assert.equal(t('cards.odds', { count: 1, total: 30 }), '1 из 30');

        setLocale('en');
        const english = build();
        assert.equal(boar(english).name, 'Boar');
        assert.equal(boar(english).item_id, boar(russian).item_id);
        assert.deepEqual(boar(english).modes, boar(russian).modes);
    } finally {
        setLocale('en');
    }
});
