import { mountSmithApp } from '../module.js?v=0e23165318';
import { resolveSmithRouteState } from './urlState.js?v=37d2bf766f';

export { resolveSmithRouteState };

export async function mountSmithSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountSmithApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
