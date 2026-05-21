import { createRouteSyncBuffer } from './urlState.js?v=a2765f8658';

const SECTION_TEMPLATE_URL = new URL('../section.html?v=78f7723eec', import.meta.url);
let sectionTemplateMarkupPromise = null;

export function resolveInitialViewMode(sectionKind, viewParam) {
    if (sectionKind === 'tools') return 'calc';
    return viewParam === 'i' ? 'item' : 'bonus';
}

export function extractSectionRootMarkup(html) {
    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const root = doc.querySelector('#app');
        if (!root) {
            throw new Error('Bonuses section template does not contain #app');
        }
        root.removeAttribute('v-cloak');
        return root.outerHTML;
    }

    const match = html.match(/<div\s+id="app"[\s\S]*<\/div>/i);
    if (!match) {
        throw new Error('Bonuses section template does not contain #app');
    }
    return match[0].replace(/\s+v-cloak\b/gi, '');
}

export async function getSectionTemplateMarkup() {
    if (!sectionTemplateMarkupPromise) {
        sectionTemplateMarkupPromise = fetch(SECTION_TEMPLATE_URL)
            .then(response => {
                if (!response.ok) throw new Error(`Could not load bonuses section template: ${response.status}`);
                return response.text();
            })
            .then(html => extractSectionRootMarkup(html));
    }
    return sectionTemplateMarkupPromise;
}

export async function mountBonusesSection({
    container,
    sectionKind = 'bonuses',
    createBonusesApp
} = {}) {
    if (!container) {
        throw new Error('mountBonusesSection requires a container');
    }
    if (typeof createBonusesApp !== 'function') {
        throw new TypeError('mountBonusesSection requires createBonusesApp');
    }

    container.innerHTML = await getSectionTemplateMarkup();
    const mountTarget = container.querySelector('#app');
    const app = createBonusesApp({ sectionKind, hostContainer: container, useShellChrome: true });
    const vm = app.mount(mountTarget);
    const routeSyncBuffer = createRouteSyncBuffer((search) => vm._applyUrlState(search));
    routeSyncBuffer.markReady(window.location.search);
    mountTarget?.removeAttribute('v-cloak');
    return {
        vm,
        syncRouteState(search = window.location.search) {
            routeSyncBuffer.sync(search);
        },
        async activateShellRoute(routeKey) {
            const nextMode = routeKey === 'item'
                ? 'item'
                : routeKey === 'tools'
                    ? 'calc'
                    : 'bonus';
            if (vm.viewMode === nextMode) {
                vm.syncUrl();
                return;
            }
            await vm.setViewMode(nextMode);
        },
        openMobileSettings() {
            vm.openMobileSettings();
        }
    };
}
