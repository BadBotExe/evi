import { mountSmithApp } from '../module.js?v=131cce10bb';
import { resolveSmithRouteState } from './urlState.js?v=83b7b7f436';

export { resolveSmithRouteState };

export async function mountSmithSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountSmithApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
