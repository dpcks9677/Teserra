import landingHtml from './views/landing.html?raw';
import loginHtml from './views/login.html?raw';
import gameHtml from './views/game.html?raw';
import modalsHtml from './views/modals.html?raw';

class UIManager {
  constructor() {
    this.appRoot = document.getElementById('app-root');
  }

  mountAllViews() {
    // Inject all HTML components into the root
    this.appRoot.innerHTML = landingHtml + loginHtml + gameHtml + modalsHtml;
  }
}

export const uiManager = new UIManager();
