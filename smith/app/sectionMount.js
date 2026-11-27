import { mountSmithApp } from '../module.js?v=228312fc0a';
import { resolveSmithRouteState } from './urlState.js?v=83b7b7f436';

export { resolveSmithRouteState };

export async function mountSmithSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountSmithApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
