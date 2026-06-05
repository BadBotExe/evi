import { mountCardsApp } from '../module.js?v=5a3836a892';
import { resolveCardsRouteState } from './urlState.js?v=e3f74fc3ab';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
