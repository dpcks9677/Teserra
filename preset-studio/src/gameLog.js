import { els } from './appShell.js';
import { networkEngine } from './networkEngine.js';
import { augmentDefinitions } from './scoreEngine.js';
import { getCurrentUser } from './authEngine.js';
import { refreshUserHistory } from './profileController.js';

let augmentsProvider = () => ({});

export function getPlayerLabel(playerIndex) {
  let name = `Player ${playerIndex}`;
  const searchPlayers = (window.initialMatchPlayers && window.initialMatchPlayers.length > 0)
    ? window.initialMatchPlayers
    : window.lobbyPlayers;

  if (searchPlayers && Array.isArray(searchPlayers)) {
    const found = searchPlayers.find((pl, idx) => (pl.playerIndex ? pl.playerIndex === playerIndex : idx + 1 === playerIndex));
    if (found?.nickname) {
      name = found.nickname;
    }
  } else {
    const oppNameElem = document.getElementById(`match-p${playerIndex}-name`);
    if (oppNameElem && oppNameElem.textContent) {
      name = oppNameElem.textContent;
    } else if (playerIndex === 1 && els.matchMyName && els.matchMyName.textContent) {
      name = els.matchMyName.textContent;
    }
  }
  return `P${playerIndex} (${name})`;
}
window.matchLogHistory = [];

const DEFAULT_CATEGORY_NAMES = {
  aces: 'Aces', deuces: 'Deuces', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  choice: 'Choice', '4oak': '4 of a Kind', fullhouse: 'Full House', 's-straight': 'S. Straight', 'l-straight': 'L. Straight', yacht: 'Yacht'
};

export function getCategoryDisplayName(catId, player = 1) {
  const pMuts = augmentsProvider()[player] || {};
  const augmentId = pMuts[catId];
  if (augmentId && augmentDefinitions[augmentId]) {
    const augment = augmentDefinitions[augmentId];
    if (!augment.isEnhancement && !augment.isQuest) {
      return augment.enName || augment.name;
    }
  }

  return DEFAULT_CATEGORY_NAMES[catId] || catId;
}

function formatLogEntry(log, playerNames = null) {
  if (log.type === 'system') {
    if (log.message === 'game-start') return '게임 시작!';
    return log.message;
  }

  let pLabel;
  if (playerNames && (playerNames[log.player] || playerNames[String(log.player)])) {
    const name = playerNames[log.player] || playerNames[String(log.player)];
    pLabel = `P${log.player} (${name})`;
  } else {
    pLabel = getPlayerLabel(log.player);
  }

  switch (log.type) {
    case 'turn-start':
      return `${pLabel}의 턴 (${log.round} 라운드)`;
    case 'roll-action':
      const { rolledCount, keptValues, isEquivalentRoll } = log.meta;
      const eePrefix = isEquivalentRoll ? '[등가교환] -5점의 페널티를 받고 주사위를 추가로 굴렸습니다. ' : '';
      if (!keptValues || keptValues.length === 0) {
        return `${eePrefix}주사위 ${rolledCount}개를 굴렸습니다.`;
      }
      return `${eePrefix}주사위 [${keptValues.join(', ')}]를 킵하고 ${rolledCount}개를 다시 굴렸습니다.`;
    case 'roll-result':
      return `주사위의 값이 나왔습니다. [${log.meta.values.join(', ')}]`;
    case 'score-record':
      const cName = log.meta.catName || getCategoryDisplayName(log.meta.catId, log.player);
      return `[${cName}] 족보에 ${log.meta.score}점을 기록했습니다.`;
    case 'timeout':
      return `시간 초과로 인해 [${log.meta.catName}] 족보에 ${log.meta.score}점을 자동으로 기입했습니다.`;
    case 'augment-action':
      return `${pLabel}이 [${log.meta.name}] 증강을 획득했습니다.`;
    default:
      return '';
  }
}

export function addGameLog(logData, type = 'normal', sync = false, player = 0) {
  if (!els.gameLogContainer) return;
  const emptyText = els.gameLogContainer.querySelector('.log-empty-text');
  if (emptyText) emptyText.remove();

  // JSON 객체 정규화 및 저장
  let normalizedLog;
  if (typeof logData === 'object' && logData !== null) {
    normalizedLog = logData;
  } else {
    normalizedLog = {
      type: 'system',
      message: String(logData),
      player: player
    };
  }

  window.matchLogHistory.push(normalizedLog);

  const formattedMessage = formatLogEntry(normalizedLog);

  const entryType = (normalizedLog.type === 'turn-start' || type === 'turn-start' || normalizedLog.message === '게임 시작!') ? 'turn-start' : type;

  const entry = document.createElement('div');
  entry.className = `game-log-entry ${entryType} fade-in`;
  if (player === 1) entry.classList.add('log-p1');
  else if (player === 2) entry.classList.add('log-p2');

  const textSpan = document.createElement('span');
  textSpan.textContent = formattedMessage;

  if (normalizedLog.type === 'timeout') {
    textSpan.style.textDecoration = 'underline';
  }

  entry.appendChild(textSpan);

  els.gameLogContainer.appendChild(entry);
  // 부모 스크롤을 끝으로
  if (els.gameLogContainer.parentElement) {
    els.gameLogContainer.parentElement.scrollTop = els.gameLogContainer.parentElement.scrollHeight;
  }

  // 소켓으로 메시지 쏠 경우 (sync가 true일 때)
  if (sync && window.isMultiplayer) {
    networkEngine.sendMessage({
      type: 'sync_log',
      logData: normalizedLog,
      logType: type,
      player: player
    });
  }
}

export function renderGameLogHistory(history) {
  if (!els.gameLogContainer || !Array.isArray(history)) return;
  const emptyText = els.gameLogContainer.querySelector('.log-empty-text');
  if (emptyText) emptyText.remove();
  els.gameLogContainer.innerHTML = '';
  window.matchLogHistory = [...history];

  history.forEach(log => {
    const isTurnStart = log.type === 'turn-start' || log.message === '게임 시작!';
    const entryType = isTurnStart ? 'turn-start' : (log.type || 'normal');
    const formattedMessage = formatLogEntry(log);

    const entry = document.createElement('div');
    entry.className = `game-log-entry ${entryType}`;
    if (log.player === 1) entry.classList.add('log-p1');
    else if (log.player === 2) entry.classList.add('log-p2');

    const textSpan = document.createElement('span');
    textSpan.textContent = formattedMessage;
    if (log.type === 'timeout') {
      textSpan.style.textDecoration = 'underline';
    }
    entry.appendChild(textSpan);
    els.gameLogContainer.appendChild(entry);
  });

  if (els.gameLogContainer.parentElement) {
    els.gameLogContainer.parentElement.scrollTop = els.gameLogContainer.parentElement.scrollHeight;
  }
}

export function showAugment() {
  if (els.augmentSection) {
    els.augmentSection.classList.remove('hidden');
    els.augmentSection.style.display = 'flex';
  }
  if (els.matchInfoSection) {
    els.matchInfoSection.classList.add('hidden');
    els.matchInfoSection.style.display = 'none';
  }
  if (els.tabAugmentView) els.tabAugmentView.classList.add('active');
  if (els.tabAugmentViewFromMatch) els.tabAugmentViewFromMatch.classList.add('active');
  if (els.tabMatchInfoView) els.tabMatchInfoView.classList.remove('active');
  if (els.tabMatchInfoViewFromAug) els.tabMatchInfoViewFromAug.classList.remove('active');
}

export function showMatchInfo() {
  if (els.augmentSection) {
    els.augmentSection.classList.add('hidden');
    els.augmentSection.style.display = 'none';
  }
  if (els.matchInfoSection) {
    els.matchInfoSection.classList.remove('hidden');
    els.matchInfoSection.style.display = 'flex';
  }
  if (els.tabAugmentView) els.tabAugmentView.classList.remove('active');
  if (els.tabAugmentViewFromMatch) els.tabAugmentViewFromMatch.classList.remove('active');
  if (els.tabMatchInfoView) els.tabMatchInfoView.classList.add('active');
  if (els.tabMatchInfoViewFromAug) els.tabMatchInfoViewFromAug.classList.add('active');

  const curUser = getCurrentUser();
  if (curUser?.uid) {
    refreshUserHistory(curUser.uid);
  }
}

export function initGameLog(getAugments) {
  augmentsProvider = getAugments;
  if (els.tabAugmentView) els.tabAugmentView.addEventListener('click', showAugment);
  if (els.tabAugmentViewFromMatch) els.tabAugmentViewFromMatch.addEventListener('click', showAugment);
  if (els.tabMatchInfoView) els.tabMatchInfoView.addEventListener('click', showMatchInfo);
  if (els.tabMatchInfoViewFromAug) els.tabMatchInfoViewFromAug.addEventListener('click', showMatchInfo);
}
