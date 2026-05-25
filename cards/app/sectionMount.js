import { mountCardsApp } from '../module.js?v=4f44bb48bc';
import { resolveCardsRouteState } from './urlState.js?v=e3f74fc3ab';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
