import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setLocale, translateLabel } from './locale.js';

test('all hourly rift identifiers and visible labels agree in Russian', () => {
    const { bonuses } = JSON.parse(readFileSync(new URL('../bonuses/sources/hourglass.json', import.meta.url), 'utf8'));
    const rifts = bonuses.filter(source => source.category === 'hourglass_rift');
    assert.ok(rifts.length > 0);
    try {
        for (const rift of rifts) {
            setLocale('ru');
            for (const { bonus, label } of rift.bonuses) {
                const translated = translateLabel(bonus);
                assert.doesNotMatch(translated, /[a-z]{2,}/i, bonus);
                if (bonus.endsWith(' (per hour)')) {
                    assert.equal(translated, translateLabel(label));
                    assert.match(translated, /в час$/);
                }
            }
            setLocale('en');
            for (const { bonus, label } of rift.bonuses) {
                assert.equal(translateLabel(bonus), bonus);
                assert.equal(translateLabel(label), label);
            }
        }
    } finally {
        setLocale('en');
    }
});
