// Screen & modal state router + mobile landscape orientation lock helper

export function createScreenManager() {
  const screens = {
    menu: document.getElementById('screen-menu'),
    settings: document.getElementById('screen-settings'),
    records: document.getElementById('screen-records'),
    match: document.getElementById('screen-match'),
  };
  const modals = {
    pause: document.getElementById('modal-pause'),
    result: document.getElementById('modal-result'),
  };

  let currentScreen = 'menu';

  function showScreen(name) {
    currentScreen = name;
    Object.entries(screens).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.hidden = !active;
      el.classList.toggle('is-active', active);
    });
    hideAllModals();

    if (name === 'menu') document.body.dataset.state = 'title';
    else if (name === 'settings') document.body.dataset.state = 'settings';
    else if (name === 'records') document.body.dataset.state = 'records';
    else if (name === 'match') document.body.dataset.state = 'playing';
  }

  function showModal(modalName) {
    Object.entries(modals).forEach(([key, el]) => {
      if (!el) return;
      el.hidden = key !== modalName;
    });
    if (modalName === 'pause') document.body.dataset.state = 'paused';
    else if (modalName === 'result') document.body.dataset.state = 'gameover';
  }

  function hideAllModals() {
    Object.values(modals).forEach((el) => {
      if (el) el.hidden = true;
    });
    if (currentScreen === 'match') {
      document.body.dataset.state = 'playing';
    }
  }

  function tryLockLandscape() {
    try {
      const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      if (!isTouch) return;
      const root = document.documentElement;
      const lockOrientation = () => {
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      };
      if (root.requestFullscreen && !document.fullscreenElement) {
        Promise.resolve(root.requestFullscreen())
          .then(lockOrientation)
          .catch(lockOrientation);
      } else {
        lockOrientation();
      }
    } catch {
      // Portrait CSS fallback overlay remains active if lock is unsupported
    }
  }

  return {
    getCurrentScreen: () => currentScreen,
    showScreen,
    showModal,
    hideAllModals,
    tryLockLandscape,
  };
}
