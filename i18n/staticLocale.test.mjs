import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLocale } from './locale.js';
import { bindStaticLabels } from './staticLocale.js';

test('static label translation leaves layout whitespace intact', () => {
    const nodes = [{ data: '\n        ' }, { data: 'Recipe' }, { data: '\n    ' }];
    const root = {
        ownerDocument: {
            createTreeWalker() {
                const iterator = nodes.values();
                return { nextNode: () => iterator.next().value };
            }
        },
        querySelectorAll: () => []
    };

    try {
        setLocale('ru');
        const refresh = bindStaticLabels(root);
        refresh();
        assert.deepEqual(nodes.map(node => node.data), ['\n        ', 'Рецепт', '\n    ']);
        setLocale('en');
        refresh();
        assert.deepEqual(nodes.map(node => node.data), ['\n        ', 'Recipe', '\n    ']);
    } finally {
        setLocale('en');
    }
});
