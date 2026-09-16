import { mountCardsApp } from '../module.js?v=aa05d3fc96';
import { resolveCardsRouteState } from './urlState.js?v=e3f74fc3ab';

export { resolveCardsRouteState };

export async function mountCardsSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountCardsApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
