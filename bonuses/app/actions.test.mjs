import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionsMethods } from './actions.js';

test('the cached Items view leaves another section’s mobile header alone', () => {
    const originalDocument = globalThis.document;
    let reads = 0;
    globalThis.document = {
        getElementById() {
            reads += 1;
            return null;
        }
    };
    try {
        const classes = new Set(['shell-hidden']);
        const view = {
            useShellChrome: true,
            viewMode: 'item',
            hostContainer: { classList: { contains: name => classes.has(name) } }
        };
        actionsMethods.syncShellMobileActions.call(view);
        assert.equal(reads, 0);
        classes.delete('shell-hidden');
        actionsMethods.syncShellMobileActions.call(view);
        assert.ok(reads > 0);
    } finally {
        globalThis.document = originalDocument;
    }
});
