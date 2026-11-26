import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installSiteLanguage, resolveSiteLocale } from './siteLanguage.js';

const available = { en: 'English', ru: 'Russian', 'pt-BR': 'Portuguese', zh: 'Chinese', 'zh-Hant': 'Traditional Chinese' };

test('stored locale takes priority over browser preferences', () => {
    assert.equal(resolveSiteLocale('ru', ['en-US'], available), 'ru');
    assert.equal(resolveSiteLocale('fr', ['fr-FR', 'RU-RU'], available), 'ru');
});

test('matches browser language variants and falls back to English', () => {
    assert.equal(resolveSiteLocale('', ['pt-PT'], available), 'pt-BR');
    assert.equal(resolveSiteLocale('', ['zh-Hant-TW'], available), 'zh-Hant');
    assert.equal(resolveSiteLocale('', ['ar', 'he'], available), 'en');
});

test('desktop and mobile share one persisted preference with a browser setting', () => {
    const controls = Array.from({ length: 2 }, () => ({
        addEventListener(event, listener) {
            assert.equal(event, 'change');
            this.change = listener;
        }
    }));
    const doc = { querySelectorAll: () => controls, documentElement: {} };
    const browser = { languages: ['ru-RU'] };
    const values = new Map();
    const storage = () => ({
        getItem: key => values.get(key),
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    });

    installSiteLanguage(doc, browser, storage);
    assert.equal(doc.documentElement.lang, 'en');
    assert.deepEqual(controls.map(control => control.value), ['', '']);
    controls[0].value = 'en';
    controls[0].change();
    assert.deepEqual(controls.map(control => control.value), ['en', 'en']);
    assert.deepEqual([...values.values()], ['en']);

    controls[1].value = '';
    controls[1].change();
    assert.deepEqual(controls.map(control => control.value), ['', '']);
    assert.equal(values.size, 0);
});
