import { createToolsApp } from '../module.js?v=4f5b5f10d4';
import { buildToolsRouteQuery, resolveToolsRouteState } from './urlState.js?v=255de4019c';

const SECTION_TEMPLATE_URL = new URL('../section.html?v=5fd9729c80', import.meta.url);
let sectionTemplateMarkupPromise = null;

function extractSectionRootMarkup(html) {
    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const root = doc.querySelector('#app');
        if (!root) {
            throw new Error('Tools section template does not contain #app');
        }
        root.removeAttribute('v-cloak');
        return root.outerHTML;
    }

    const match = html.match(/<div\s+id="app"[\s\S]*<\/div>/i);
    if (!match) {
        throw new Error('Tools section template does not contain #app');
    }
    return match[0].replace(/\s+v-cloak\b/gi, '');
}

async function getSectionTemplateMarkup() {
    if (!sectionTemplateMarkupPromise) {
        sectionTemplateMarkupPromise = fetch(SECTION_TEMPLATE_URL)
            .then(response => {
                if (!response.ok) throw new Error(`Could not load tools section template: ${response.status}`);
                return response.text();
            })
            .then(html => extractSectionRootMarkup(html));
    }
    return sectionTemplateMarkupPromise;
}

export { resolveToolsRouteState };

export function createToolsRouteMemory(initialSearch = '') {
    let lastSearch = typeof initialSearch === 'string' ? initialSearch : '';

    return {
        current() {
            return lastSearch;
        },
        sync(search = '') {
            lastSearch = typeof search === 'string' ? search : '';
            return lastSearch;
        },
        restore(fallbackSearch = '') {
            if (lastSearch) return lastSearch;
            return typeof fallbackSearch === 'string' ? fallbackSearch : '';
        }
    };
}

function buildCurrentToolsUrl(search = '') {
    return `${window.location.pathname}${search}${window.location.hash}`;
}

export async function mountToolsSection({ container, initialRouteState } = {}) {
    if (!container) {
        throw new Error('mountToolsSection requires a container');
    }

    container.innerHTML = await getSectionTemplateMarkup();
    const mountTarget = container.querySelector('#app');
    const routeMemory = createToolsRouteMemory(
        typeof initialRouteState === 'string' ? initialRouteState : window.location.search
    );
    const app = createToolsApp({
        hostContainer: container,
        useShellChrome: true,
        onRouteStateChange(search) {
            routeMemory.sync(search);
        }
    });
    const vm = app.mount(mountTarget);
    vm.applyRouteState(routeMemory.current());
    mountTarget?.removeAttribute('v-cloak');
    return {
        syncRouteState(search = window.location.search) {
            vm.applyRouteState(routeMemory.sync(search));
        },
        restoreRoute() {
            const restoredSearch = routeMemory.restore(window.location.search);
            vm.applyRouteState(restoredSearch);
            if (window.location.search !== restoredSearch) {
                history.replaceState(null, '', buildCurrentToolsUrl(restoredSearch));
            }
        },
        updateRouteState(state) {
            vm.applyResolvedRouteState(state);
            routeMemory.sync((() => {
                const query = buildToolsRouteQuery(vm).toString();
                return query ? `?${query}` : '';
            })());
        },
        refresh() {
            vm.refreshView?.();
        },
        syncShellMobileActions() {
            vm.syncShellMobileActions?.();
        }
    };
}
