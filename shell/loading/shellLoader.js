const SHELL_LOADER_FRAME_COUNT = 8;
const SHELL_LOADER_FRAME_PREFIX = '../../images/loading/flying_';
const GLOBAL_SHELL_LOADER_KEY = '__evitaniaShellLoader';

export function resolveShellLoaderFrameUrls(moduleUrl = import.meta.url) {
    return Array.from({ length: SHELL_LOADER_FRAME_COUNT }, (_, index) =>
        new URL(`${SHELL_LOADER_FRAME_PREFIX}${index + 1}.png`, moduleUrl).toString()
    );
}

function defaultTimerApi() {
    return {
        setTimeout: globalThis.setTimeout?.bind(globalThis),
        clearTimeout: globalThis.clearTimeout?.bind(globalThis),
        setInterval: globalThis.setInterval?.bind(globalThis),
        clearInterval: globalThis.clearInterval?.bind(globalThis)
    };
}

function resolveLoaderNodes(doc) {
    return {
        root: doc?.getElementById?.('shell-root') ?? null,
        overlay: doc?.getElementById?.('shell-loader') ?? null,
        frameHost: doc?.getElementById?.('shell-loader-frame-host') ?? null
    };
}

function findFirstLoadedFrameIndex(state) {
    return state.frames.findIndex((frame) => frame.loaded);
}

function findNextLoadedFrameIndex(state, currentIndex) {
    const frameCount = state.frames.length;
    if (!frameCount) return -1;
    for (let step = 1; step <= frameCount; step += 1) {
        const candidateIndex = (currentIndex + step + frameCount) % frameCount;
        if (state.frames[candidateIndex]?.loaded) {
            return candidateIndex;
        }
    }
    return -1;
}

function resolveRenderableFrameIndex(state, preferredIndex = state.frameIndex) {
    if (state.frames[preferredIndex]?.loaded) return preferredIndex;
    if (state.lastRenderedFrameIndex >= 0 && state.frames[state.lastRenderedFrameIndex]?.loaded) {
        return state.lastRenderedFrameIndex;
    }
    return findFirstLoadedFrameIndex(state);
}

function updateFrame(state) {
    if (!state.frames.length) return;
    const nextFrameIndex = resolveRenderableFrameIndex(state);
    state.frames.forEach((frame, frameIndex) => {
        frame.element?.classList.toggle('shell-loader-frame-active', frameIndex === nextFrameIndex && nextFrameIndex >= 0);
    });
    if (nextFrameIndex >= 0) {
        state.frameIndex = nextFrameIndex;
        state.lastRenderedFrameIndex = nextFrameIndex;
        return;
    }
    state.lastRenderedFrameIndex = -1;
}

function markFrameLoaded(state, frameIndex) {
    const frame = state.frames[frameIndex];
    if (!frame || frame.loaded) return;
    frame.loaded = true;
    frame.failed = false;
    if (state.visible || state.lastRenderedFrameIndex < 0) {
        updateFrame(state);
    }
}

function initializeFrameNodes(state) {
    const { frameHost } = resolveLoaderNodes(state.document);
    if (!frameHost || typeof state.document?.createElement !== 'function') return;
    frameHost.replaceChildren?.();
    state.frames.forEach((frame, frameIndex) => {
        const image = state.document.createElement('img');
        image.className = 'shell-loader-frame';
        image.alt = '';
        image.decoding = 'async';
        image.loading = 'eager';
        image.draggable = false;
        image.setAttribute?.('aria-hidden', 'true');
        image.onload = () => markFrameLoaded(state, frameIndex);
        image.onerror = () => {
            if (state.frames[frameIndex]) {
                state.frames[frameIndex].failed = true;
            }
        };
        frame.element = image;
        frameHost.appendChild?.(image);
        image.src = frame.url;
        if (image.complete) {
            markFrameLoaded(state, frameIndex);
        }
    });
}

function showOverlay(state) {
    const { root, overlay } = resolveLoaderNodes(state.document);
    root?.classList.add('shell-loading-active');
    if (!overlay) return;
    overlay.classList.add('shell-loader-visible');
    overlay.setAttribute('aria-hidden', 'false');
    state.visible = true;
}

function hideOverlay(state) {
    const { root, overlay } = resolveLoaderNodes(state.document);
    root?.classList.remove('shell-loading-active');
    if (!overlay) return;
    overlay.classList.remove('shell-loader-visible');
    overlay.setAttribute('aria-hidden', 'true');
    state.visible = false;
}

function clearRevealTimer(state) {
    if (state.revealTimer == null) return;
    state.timers.clearTimeout?.(state.revealTimer);
    state.revealTimer = null;
}

function clearAnimationTimer(state) {
    if (state.animationTimer == null) return;
    state.timers.clearInterval?.(state.animationTimer);
    state.animationTimer = null;
}

function startAnimation(state) {
    if (state.animationTimer != null || !state.frames.length) return;
    const initialFrameIndex = resolveRenderableFrameIndex(state, state.frameIndex);
    if (initialFrameIndex >= 0) {
        state.frameIndex = initialFrameIndex;
    }
    updateFrame(state);
    state.animationTimer = state.timers.setInterval?.(() => {
        const nextFrameIndex = findNextLoadedFrameIndex(state, state.frameIndex);
        if (nextFrameIndex < 0) return;
        state.frameIndex = nextFrameIndex;
        updateFrame(state);
    }, state.frameDurationMs) ?? null;
}

function stopAnimation(state) {
    clearAnimationTimer(state);
    state.frameIndex = 0;
    state.lastRenderedFrameIndex = -1;
    updateFrame(state);
}

function scheduleReveal(state) {
    if (state.visible || state.revealTimer != null) return;
    state.revealTimer = state.timers.setTimeout?.(() => {
        state.revealTimer = null;
        if (state.activeCount <= 0) return;
        showOverlay(state);
        startAnimation(state);
    }, state.revealDelayMs) ?? null;
}

export function createShellLoaderController({
    document = globalThis.document,
    timers = defaultTimerApi(),
    frameUrls = resolveShellLoaderFrameUrls(),
    revealDelayMs = 120,
    frameDurationMs = 110
} = {}) {
    const state = {
        document,
        timers,
        frameUrls: Array.isArray(frameUrls) ? [...frameUrls] : [],
        revealDelayMs,
        frameDurationMs,
        activeCount: 0,
        frameIndex: 0,
        lastRenderedFrameIndex: -1,
        revealTimer: null,
        animationTimer: null,
        visible: false,
        frames: Array.isArray(frameUrls)
            ? frameUrls.map((url) => ({ url, loaded: false, failed: false, element: null }))
            : []
    };

    initializeFrameNodes(state);
    updateFrame(state);
    hideOverlay(state);

    return {
        show(options = {}) {
            const immediate = options?.immediate === true;
            state.activeCount += 1;
            if (immediate) {
                clearRevealTimer(state);
                showOverlay(state);
                startAnimation(state);
                return state.activeCount;
            }
            scheduleReveal(state);
            return state.activeCount;
        },
        hide() {
            if (state.activeCount > 0) {
                state.activeCount -= 1;
            }
            if (state.activeCount > 0) return state.activeCount;

            clearRevealTimer(state);
            stopAnimation(state);
            hideOverlay(state);
            return state.activeCount;
        },
        async run(task, options = {}) {
            this.show(options);
            try {
                return await task();
            } finally {
                this.hide();
            }
        },
        isVisible() {
            return state.visible;
        },
        getActiveCount() {
            return state.activeCount;
        },
        getFrameUrls() {
            return [...state.frameUrls];
        },
        getPreloadedFrameCount() {
            return state.frames.filter((frame) => frame.element != null).length;
        }
    };
}

export function installGlobalShellLoader(loader) {
    if (loader) {
        globalThis[GLOBAL_SHELL_LOADER_KEY] = loader;
    }
    return globalThis[GLOBAL_SHELL_LOADER_KEY] ?? null;
}

export function getGlobalShellLoader() {
    return globalThis[GLOBAL_SHELL_LOADER_KEY] ?? null;
}

export async function runWithGlobalShellLoader(task, options = {}) {
    const loader = getGlobalShellLoader();
    if (!loader) return task();
    return loader.run(task, options);
}
