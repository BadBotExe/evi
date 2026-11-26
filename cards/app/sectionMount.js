import { mountCardsApp } from '../module.js?v=48618cbfb6';
import { resolveCardsRouteState } from './urlState.js?v=f4fe60aea6';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
