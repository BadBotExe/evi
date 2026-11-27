import assert from 'node:assert/strict';
import test from 'node:test';
import { BonusAppLifecycle } from './lifecycle.js';

test('Escape closes a detail popover before the top registered floating popover', t => {
    const disconnected = [];
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
        observe(element) { this.element = element; }
        disconnect() { disconnected.push(this.element); }
    };
    t.after(() => { globalThis.ResizeObserver = originalResizeObserver; });
    const closed = [];
    const app = {
        tierPopoverEntry: {},
        closeTierPopover() {
            closed.push('tier');
            this.tierPopoverEntry = null;
        }
    };
    const lifecycle = new BonusAppLifecycle(app);
    const lower = { isConnected: true, style: { zIndex: '601' } };
    const upper = { isConnected: true, style: { zIndex: '602' } };
    const releaseUpper = lifecycle.registerFloatingPopover(upper, () => {
        closed.push('upper');
        releaseUpper();
    });
    const releaseLower = lifecycle.registerFloatingPopover(lower, () => {
        closed.push('lower');
        releaseLower();
    });

    const escape = { key: 'Escape', preventDefault() {} };
    lifecycle.handleKeydown(escape);
    lifecycle.handleKeydown(escape);
    lifecycle.handleKeydown(escape);
    lifecycle.handleKeydown(escape);
    assert.deepEqual(closed, ['tier', 'upper', 'lower']);
    assert.deepEqual(disconnected, [upper, lower]);
});
