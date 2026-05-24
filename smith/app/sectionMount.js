import { mountSmithApp } from '../module.js?v=f0f4160597';
import { resolveSmithRouteState } from './urlState.js?v=4241cadb7c';

export { resolveSmithRouteState };

export async function mountSmithSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountSmithApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
