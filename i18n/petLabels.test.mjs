import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gameTerm, setLocale, translateLabel } from './locale.js';
import { BonusSourceResolver } from '../bonuses/app/sourceResolver.js';
import { ItemPopoverContent } from '../bonuses/components/ItemPopoverContent.js';

function readJson(path) {
    return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

test('Russian pet labels distinguish pets from their unlock items and translate their sources', () => {
    const items = readJson('../items/items.json');
    const sourceFile = readJson('../items/item-sources.json');
    const sourceMap = new Map(Object.values(sourceFile).flat()
        .filter(source => source?.id)
        .map(source => [source.id, source]));
    const resolver = new BonusSourceResolver({ data: { item_sources: sourceMap } });
    const chestershire = items.find(item => item.id === 'pet_chestershire');
    const sources = chestershire.source_refs.map(ref => resolver.resolveItemSourceEntry(ref));
    const labels = resolver.itemSourceDisplayEntries({ sources }).map(entry => entry.label);

    setLocale('ru');
    try {
        assert.equal(translateLabel('Mony'), 'Mony');
        assert.equal(gameTerm('item', 'pet_mony'), 'Разблокировка: Mony');
        assert.equal(translateLabel('Chestershire'), 'Chestershire');
        assert.equal(translateLabel('Screek'), 'Скрик');
        assert.equal(translateLabel('Pump Kin'), 'Тыквоголовый');
        assert.equal(labels.length, 3);
        for (const label of labels) assert.doesNotMatch(translateLabel(label), /[A-Za-z]/);
        assert.ok(ItemPopoverContent.template.includes('sourceEntries.map(entry => $label(entry.label))'));
    } finally {
        setLocale('en');
    }
    assert.equal(translateLabel('Mony'), 'Mony');
    assert.equal(translateLabel('Chestershire'), 'Chestershire');
    assert.equal(gameTerm('item', 'pet_mony'), 'Mony Unlock');
    for (const label of labels) assert.equal(translateLabel(label), label);
});
