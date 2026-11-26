import { mountCardsApp } from '../module.js?v=a4202fcc37';
import { resolveCardsRouteState } from './urlState.js?v=f4fe60aea6';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
