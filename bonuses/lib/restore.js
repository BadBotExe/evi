const RESTORE_RELOAD_KEY = 'evitania_bonuses_restore_reload';

function shellVisible() {
    const root = document.getElementById('app');
    return !!root && getComputedStyle(root).display !== 'none' && root.childElementCount > 0;
}

export function installTabRestoreRecovery({ rehydrate }) {
    function recover() {
        if (document.visibilityState === 'hidden') return;

        requestAnimationFrame(() => {
            if (shellVisible()) {
                sessionStorage.removeItem(RESTORE_RELOAD_KEY);
                return;
            }

            if (rehydrate?.() && shellVisible()) {
                sessionStorage.removeItem(RESTORE_RELOAD_KEY);
                return;
            }

            if (sessionStorage.getItem(RESTORE_RELOAD_KEY) === '1') return;
            sessionStorage.setItem(RESTORE_RELOAD_KEY, '1');
            window.location.reload();
        });
    }

    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') recover();
    });
}
