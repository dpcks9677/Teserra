import { soundEngine } from './SoundEngine.js';
import { uiManager } from './UIManager.js';

uiManager.mountAllViews();

const byId = (id) => document.getElementById(id);

export const els = Object.fromEntries(Object.entries({
  landingView: 'landing-view', btnGetStarted: 'btn-get-started', loginView: 'login-view',
  btnDummyLogin: 'btn-dummy-login', btnGoogleLogin: 'btn-google-login', nicknameSetupView: 'nickname-setup-view',
  nicknameInput: 'nickname-input', btnSubmitNickname: 'btn-submit-nickname', appContainer: 'app-container',
  profileSection: 'profile-section', profileNickname: 'profile-nickname', profileStatusMsg: 'profile-status-msg',
  augmentSection: 'augment-section', matchInfoSection: 'match-info-section', tabAugmentView: 'tab-augment-view',
  tabMatchInfoViewFromAug: 'tab-match-info-view-from-aug', tabAugmentViewFromMatch: 'tab-augment-view-from-match',
  tabMatchInfoView: 'tab-match-info-view', matchP1Avatar: 'match-p1-avatar', matchP2Avatar: 'match-p2-avatar',
  matchP1Name: 'match-p1-name', matchP2Name: 'match-p2-name', matchP1Box: 'match-p1-box', matchP2Box: 'match-p2-box',
  matchP1Disconnect: 'match-p1-disconnect', matchP1DisconnectTimer: 'match-p1-disconnect-timer',
  matchP2Disconnect: 'match-p2-disconnect', matchP2DisconnectTimer: 'match-p2-disconnect-timer',
  turnTimer: 'turn-timer', turnTimerText: 'turn-timer-text', reconnectModal: 'reconnect-modal',
  btnReconnectJoin: 'btn-reconnect-join', btnReconnectCancel: 'btn-reconnect-cancel', gameLogContainer: 'game-log-container',
  playMenuSection: 'play-menu-section', btnPlayNormal: 'btn-norm-hotseat', btnPlayNormalLobby: 'btn-norm-lobby',
  btnNormOnline: 'btn-norm-online', btnAugOnline: 'btn-aug-online', btnAugLobby: 'btn-aug-lobby',
  btnAugHotseat: 'btn-aug-hotseat', matchmakingSection: 'matchmaking-section', matchmakingTitle: 'matchmaking-title',
  matchmakingSettings: 'matchmaking-settings', matchmakingWaiting: 'matchmaking-waiting',
  matchmakingConfirm: 'matchmaking-confirm', matchmakingLower: 'matchmaking-lower', matchmakingUpper: 'matchmaking-upper',
  matchmakingMyRating: 'matchmaking-my-rating', matchmakingMyNickname: 'matchmaking-my-nickname',
  matchmakingMyAvatar: 'matchmaking-my-avatar', matchmakingOpponentName: 'matchmaking-opponent-name',
  matchmakingOpponentAvatar: 'matchmaking-opponent-avatar', matchmakingCountdown: 'matchmaking-countdown',
  matchmakingElapsed: 'matchmaking-elapsed', matchmakingError: 'matchmaking-error', btnMatchmakingBack: 'btn-matchmaking-back',
  btnMatchmakingStart: 'btn-matchmaking-start', btnMatchmakingCancelQueue: 'btn-matchmaking-cancel-queue',
  btnMatchmakingCancelMatch: 'btn-matchmaking-cancel-match', lobbySelectSection: 'lobby-select-section',
  lobbySelectModeTitle: 'lobby-select-mode-title', btnLobbySelectBack: 'btn-lobby-select-back',
  btnLobbyCreate: 'btn-lobby-create', btnLobbyJoin: 'btn-lobby-join', inputLobbyJoinCode: 'input-lobby-join-code',
  lobbyJoinError: 'lobby-join-error', lobbySection: 'lobby-section', lobbyModeText: 'lobby-mode-text',
  lobbyCodeDisplay: 'lobby-code-display', btnLobbyBack: 'btn-lobby-back', btnLobbyStart: 'btn-lobby-start',
  myNickname: 'my-nickname',
  scoreTbody: 'score-tbody', diceBoardArea: 'dice-board-area', btnRoll: 'btn-roll', rollsLeft: 'rolls-left',
  gameStatus: 'game-status', p1Name: 'p1-name', p2Name: 'p2-name', p1Profile: 'p1-profile', p2Profile: 'p2-profile',
  endgameModal: 'endgame-modal', endgameP1Score: 'endgame-p1-score', endgameP2Score: 'endgame-p2-score',
  endgameWinner: 'endgame-winner', btnReturnLobby: 'btn-return-lobby', btnMenuSettings: 'btn-menu-settings',
  btnMenuAchievements: 'btn-menu-achievements', btnMenuCompendium: 'btn-menu-compendium', btnMenuHelp: 'btn-menu-help',
  modalSettings: 'modal-settings', modalAchievements: 'modal-achievements', modalCompendium: 'modal-compendium',
  modalProfile: 'modal-profile', modalHelp: 'modal-help'
}).map(([name, id]) => [name, byId(id)]));

export const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function handleAppScaling() {
  if (!els.appContainer) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 960) * 0.96;
  els.appContainer.style.transform = `scale(${scale})`;
  els.appContainer.style.transformOrigin = 'center center';
}

let skeletonsActive = false;

export function initMainSkeletons() {
  if (skeletonsActive) return;
  skeletonsActive = true;
  setClasses(true, [
    ['.profile-header h2', 'skeleton-box', 'skeleton-profile-title'],
    ['#btn-logout', 'skeleton-box', 'skeleton-icon-btn'],
    ['#btn-open-profile', 'skeleton-box', 'skeleton-icon-btn'],
    ['#profile-avatar-container', 'skeleton-box'],
    ['#profile-nickname', 'skeleton-box', 'skeleton-text-name'],
    ['#profile-status-msg', 'skeleton-box', 'skeleton-text-status'],
    ['#rolls-left', 'skeleton-box'],
    ['#game-status', 'skeleton-box'],
    ['#turn-timer', 'skeleton-box'],
    ['#btn-roll', 'skeleton-box', 'skeleton-btn-roll']
  ]);

  const history = document.querySelector('.history-card');
  if (history) history.innerHTML = createHistorySkeleton();
  const menu = document.querySelector('.play-menu-card');
  if (menu) {
    menu.classList.add('skeleton-fade-in');
    menu.querySelector('h2')?.classList.add('skeleton-box', 'skeleton-menu-title');
    menu.querySelectorAll('.btn-play-menu').forEach((button) => button.classList.add('skeleton-box', 'skeleton-menu-btn'));
  }
}

export function removeMainSkeletons() {
  if (!skeletonsActive) return;
  setClasses(false, [
    ['.profile-header h2', 'skeleton-box', 'skeleton-profile-title'],
    ['#btn-logout', 'skeleton-box', 'skeleton-icon-btn'],
    ['#btn-open-profile', 'skeleton-box', 'skeleton-icon-btn'],
    ['#profile-avatar-container', 'skeleton-box'],
    ['#profile-nickname', 'skeleton-box', 'skeleton-text-name'],
    ['#profile-status-msg', 'skeleton-box', 'skeleton-text-status'],
    ['#rolls-left', 'skeleton-box'],
    ['#game-status', 'skeleton-box'],
    ['#turn-timer', 'skeleton-box'],
    ['#btn-roll', 'skeleton-box', 'skeleton-btn-roll']
  ]);
  const menu = document.querySelector('.play-menu-card');
  menu?.querySelector('h2')?.classList.remove('skeleton-box', 'skeleton-menu-title');
  menu?.querySelectorAll('.btn-play-menu').forEach((button) => button.classList.remove('skeleton-box', 'skeleton-menu-btn'));
  skeletonsActive = false;
}

function setClasses(add, entries) {
  entries.forEach(([selector, ...classes]) => document.querySelector(selector)?.classList[add ? 'add' : 'remove'](...classes));
}

function createHistorySkeleton() {
  const rows = Array.from({ length: 5 }, () => `
    <div class="history-match-item skel-match-item"><div class="history-match-main">
      <div class="history-mode-col"><div class="skeleton-box skel-mode-icon"></div><div class="skeleton-box skel-mode-text"></div></div>
      <div class="history-players-col">
        <div class="history-player-row me"><div class="skeleton-box skel-avatar"></div><div class="skeleton-box skel-name"></div></div>
        <div class="history-player-row"><div class="skeleton-box skel-avatar"></div><div class="skeleton-box skel-name"></div></div>
      </div>
      <div class="history-score-col"><div class="skeleton-box skel-score"></div><div class="skeleton-box skel-score"></div></div>
      <div class="history-result-col"><div class="skeleton-box skel-badge"></div></div>
      <div class="history-date-col"><div class="skeleton-box skel-date"></div></div>
    </div></div>`).join('');
  return `
    <div class="history-header"><span class="skeleton-box" style="width:90px;height:18px;border-radius:4px"></span><div class="skeleton-box" style="width:24px;height:24px;border-radius:50%"></div></div>
    <div class="history-table-header">
      <div class="col-mode"><div class="skeleton-box" style="width:28px;height:14px;border-radius:4px"></div></div>
      <div class="col-players"><div class="skeleton-box" style="width:48px;height:14px;border-radius:4px"></div></div>
      <div class="col-score"><div class="skeleton-box" style="width:28px;height:14px;border-radius:4px"></div></div>
      <div class="col-result"><div class="skeleton-box" style="width:28px;height:14px;border-radius:4px;margin:0 auto"></div></div>
      <div class="col-date"><div class="skeleton-box" style="width:28px;height:14px;border-radius:4px;margin:0 auto"></div></div>
    </div><div class="history-match-list">${rows}</div>`;
}

const initSound = () => {
  soundEngine.init();
  soundEngine.ensureContext();
  window.removeEventListener('pointerdown', initSound);
  window.removeEventListener('keydown', initSound);
};

window.addEventListener('pointerdown', initSound);
window.addEventListener('keydown', initSound);
window.addEventListener('resize', handleAppScaling);
handleAppScaling();

[els.btnAugOnline, els.btnNormOnline, els.btnAugLobby, els.btnAugHotseat, els.btnPlayNormal, els.btnPlayNormalLobby]
  .forEach((button) => { if (button) button.disabled = false; });
const debugContainer = byId('debug-container');
if (debugContainer) debugContainer.style.display = isLocalhost ? 'block' : 'none';
