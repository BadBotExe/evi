window.EvitaniaCardsRestore = (() => {
  const RESTORE_RELOAD_KEY = 'evitania_cards_restore_reload';

  function shellVisible() {
    const selectors = ['.global-bar', '.app', '.mobile-root'];
    return selectors.some(selector => {
      const el = document.querySelector(selector);
      return el && getComputedStyle(el).display !== 'none';
    });
  }

  function install({ rehydrate }) {
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

  return { install };
})();
