import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BonusSourceResolver } from '../bonuses/app/sourceResolver.js';
import { setLocale, translateLabel } from './locale.js';

function readJson(path) {
    return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

test('all catalog item source labels are translated in Russian and preserved in English', () => {
    const { sources } = readJson('../items/item-sources.json');
    const resolver = new BonusSourceResolver({
        data: { item_sources: new Map(sources.map(source => [source.id, source])) }
    });
    const labels = new Set();
    for (const item of readJson('../items/items.json')) {
        const sources = (item.source_refs ?? []).map(ref => resolver.resolveItemSourceEntry(ref));
        for (const { label } of resolver.itemSourceDisplayEntries({ sources })) labels.add(label);
    }

    assert.ok(labels.size > 0);
    setLocale('ru');
    try {
        for (const label of labels) {
            assert.doesNotMatch(translateLabel(label).replaceAll('Steam', ''), /[a-z]{3,}/i, label);
        }
    } finally {
        setLocale('en');
    }
    for (const label of labels) assert.equal(translateLabel(label), label);
});
