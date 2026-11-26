import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPopoverOnResize } from './lifecycle.js';

test('popover growth clamps its position and unmount disconnects the observer', () => {
    const originalWindow = globalThis.window;
    const originalObserver = globalThis.ResizeObserver;
    let notify;
    let disconnected = false;
    const el = { offsetWidth: 420, offsetHeight: 180, style: { left: '700px', top: '480px' } };
    globalThis.window = { innerWidth: 1200, innerHeight: 700 };
    globalThis.ResizeObserver = class {
        constructor(callback) { notify = callback; }
        observe(target, options) {
            assert.equal(target, el);
            assert.equal(options.box, 'border-box');
        }
        disconnect() { disconnected = true; }
    };
    try {
        clampPopoverOnResize.mounted(el);
        notify();
        assert.deepEqual(el.style, { left: '700px', top: '480px' });
        el.offsetHeight = 460;
        el.offsetWidth = 600;
        notify();
        assert.deepEqual(el.style, { left: '600px', top: '240px' });
        clampPopoverOnResize.unmounted(el);
        assert.equal(disconnected, true);
    } finally {
        globalThis.window = originalWindow;
        globalThis.ResizeObserver = originalObserver;
    }
});
