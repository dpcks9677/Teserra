if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) window.location.reload();
    }, { once: true });
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('[ServiceWorker] Registration failed:', error);
    });
  }, { once: true });
}
