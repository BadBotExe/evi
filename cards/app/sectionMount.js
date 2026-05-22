import { mountCardsApp } from '../module.js?v=a7f2f2196c';
import { resolveCardsRouteState } from './urlState.js?v=4d3c8a91f2';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
