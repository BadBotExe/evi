import { mountSmithApp } from '../module.js?v=4359ad5d29';
import { resolveSmithRouteState } from './urlState.js?v=83b7b7f436';

export { resolveSmithRouteState };

export async function mountSmithSection({ container, initialRouteState, onRouteChange } = {}) {
    return mountSmithApp({
        container,
        initialRouteState: initialRouteState ?? {},
        onRouteChange
    });
}
