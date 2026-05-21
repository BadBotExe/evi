import assert from 'node:assert/strict';

import {
    createShellLoaderController,
    resolveShellLoaderFrameUrls
} from './shellLoader.js';

function createClassList() {
    const values = new Set();
    return {
        add(name) {
            values.add(name);
        },
        remove(name) {
            values.delete(name);
        },
        toggle(name, force) {
            if (force === undefined) {
                if (values.has(name)) {
                    values.delete(name);
                    return false;
                }
                values.add(name);
                return true;
            }
            if (force) {
                values.add(name);
                return true;
            }
            values.delete(name);
            return false;
        },
        contains(name) {
            return values.has(name);
        }
    };
}

function createLoaderElement() {
    return {
        classList: createClassList(),
        attributes: new Map(),
        children: [],
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        },
        getAttribute(name) {
            return this.attributes.get(name);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren() {
            this.children = [];
        }
    };
}

const overlay = createLoaderElement();
const frameHost = createLoaderElement();
const root = {
    classList: createClassList()
};
function createMockImageElement() {
    return {
        classList: createClassList(),
        attributes: new Map(),
        className: '',
        alt: '',
        decoding: '',
        loading: '',
        draggable: true,
        complete: false,
        onload: null,
        onerror: null,
        _src: '',
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        },
        set src(value) {
            this._src = value;
        },
        get src() {
            return this._src;
        },
        triggerLoad() {
            this.complete = true;
            this.onload?.();
        }
    };
}
const createdImages = [];
const documentMock = {
    getElementById(id) {
        if (id === 'shell-root') return root;
        if (id === 'shell-loader') return overlay;
        if (id === 'shell-loader-frame-host') return frameHost;
        return null;
    },
    createElement(tagName) {
        assert.equal(tagName, 'img');
        const image = createMockImageElement();
        createdImages.push(image);
        return image;
    }
};

let timeoutIdSequence = 0;
let intervalIdSequence = 0;
const timeouts = new Map();
const intervals = new Map();
const timers = {
    setTimeout(callback) {
        const id = ++timeoutIdSequence;
        timeouts.set(id, callback);
        return id;
    },
    clearTimeout(id) {
        timeouts.delete(id);
    },
    setInterval(callback) {
        const id = ++intervalIdSequence;
        intervals.set(id, callback);
        return id;
    },
    clearInterval(id) {
        intervals.delete(id);
    }
};

const frameUrls = resolveShellLoaderFrameUrls('https://example.com/shell/loading/shellLoader.js');
assert.equal(frameUrls.length, 8);
assert.equal(frameUrls[0], 'https://example.com/images/loading/flying_1.png');
assert.equal(frameUrls.at(-1), 'https://example.com/images/loading/flying_8.png');

const controller = createShellLoaderController({
    document: documentMock,
    timers,
    frameUrls,
    revealDelayMs: 10,
    frameDurationMs: 5
});

assert.equal(controller.isVisible(), false);
assert.equal(overlay.getAttribute('aria-hidden'), 'true');
assert.equal(frameHost.children.length, frameUrls.length);
assert.equal(controller.getPreloadedFrameCount(), frameUrls.length);
assert.deepEqual(
    createdImages.map((entry) => entry.src),
    frameUrls
);

createdImages[0].triggerLoad();
assert.equal(createdImages[0].classList.contains('shell-loader-frame-active'), true);

controller.show();
controller.show();
assert.equal(controller.getActiveCount(), 2);
assert.equal(controller.isVisible(), false);
assert.equal(timeouts.size, 1);

timeouts.values().next().value();
assert.equal(controller.isVisible(), true);
assert.equal(overlay.classList.contains('shell-loader-visible'), true);
assert.equal(overlay.getAttribute('aria-hidden'), 'false');
assert.equal(root.classList.contains('shell-loading-active'), true);
assert.equal(intervals.size, 1);

intervals.values().next().value();
assert.equal(
    createdImages[0].classList.contains('shell-loader-frame-active'),
    true,
    'animation should not advance to an unloaded frame'
);

createdImages[1].triggerLoad();
intervals.values().next().value();
assert.equal(createdImages[0].classList.contains('shell-loader-frame-active'), false);
assert.equal(createdImages[1].classList.contains('shell-loader-frame-active'), true);

controller.hide();
assert.equal(controller.getActiveCount(), 1);
assert.equal(controller.isVisible(), true);

controller.hide();
assert.equal(controller.getActiveCount(), 0);
assert.equal(controller.isVisible(), false);
assert.equal(overlay.classList.contains('shell-loader-visible'), false);
assert.equal(overlay.getAttribute('aria-hidden'), 'true');
assert.equal(root.classList.contains('shell-loading-active'), false);
assert.equal(intervals.size, 0);
assert.equal(createdImages[0].classList.contains('shell-loader-frame-active'), true);
assert.equal(createdImages[1].classList.contains('shell-loader-frame-active'), false);

controller.show({ immediate: true });
assert.equal(controller.isVisible(), true);
assert.equal(overlay.classList.contains('shell-loader-visible'), true);
assert.equal(root.classList.contains('shell-loading-active'), true);
assert.equal(intervals.size, 1);
controller.hide();
assert.equal(controller.isVisible(), false);
assert.equal(intervals.size, 0);
assert.equal(createdImages[0].classList.contains('shell-loader-frame-active'), true);

let runCompleted = false;
await controller.run(async () => {
    runCompleted = true;
}, { immediate: true });
assert.equal(runCompleted, true);
assert.equal(controller.getActiveCount(), 0);

console.log('shell/loading/shellLoader.test.mjs passed');
