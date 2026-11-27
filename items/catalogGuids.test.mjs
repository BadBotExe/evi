import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const items = JSON.parse(readFileSync(new URL('./items.json', import.meta.url), 'utf8'));

test('catalog item IDs and recorded game GUIDs are unique', () => {
    const ids = new Set();
    const guids = new Set();
    for (const { id, guid } of items) {
        assert.ok(!ids.has(id), 'Duplicate item ID: ' + id);
        ids.add(id);
        if (!guid) continue;
        assert.match(guid, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
        const normalized = guid.toLowerCase();
        assert.ok(!guids.has(normalized), 'Duplicate game GUID for ' + id);
        guids.add(normalized);
    }
});
