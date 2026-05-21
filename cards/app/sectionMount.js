import { mountCardsApp } from '../module.js?v=b6c644e802';

export function resolveCardsRouteState(search = '') {
    const params = new URLSearchParams(search);
    return {
        card: params.get('card') ?? '',
        mode: params.get('mode') ?? '',
        stars: params.get('stars') ?? '',
        filter: params.get('filter') ?? '',
        tab: params.get('tab') ?? ''
    };
}

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
