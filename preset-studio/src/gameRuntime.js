import { db } from "./firebaseConfig.js";
import { collection, addDoc, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { networkEngine } from "./networkEngine.js";
import { calculateScores, calculateUpperScoreTotal, augmentDefinitions } from "./scoreEngine.js";
import { DiceEngine } from "./DiceEngine.js";
import { getDiceSvg, getSpecialSvg, getVariantSvg, getDicesIconSvg, getAugmentedDicesIconSvg, getCirclePlusIconSvg, getCircleMinusIconSvg, getFlagIconSvg } from "./svgIcons.js";
import { setupDebugTools } from "./debugTools.js";
import "cropperjs/dist/cropper.css";
import { subscribeAuthState, signInWithGoogle, setNickname, getCurrentUser, normalizeUserUid, saveUserToDB, getUserFromDB, signOutUser, updateUserAvatar, updateUserActiveGame, clearUserActiveGame, saveAugmentProgress, resetAugmentProgress } from "./authEngine.js";
import defaultAugmentsData from "./augments.json";
import { createAugmentProgressSession, recordAchievementProgress, recordAugmentMetric, recordAugmentOffer, recordAugmentSelection } from "./augmentProgress.js";
import { isAchievementEligibleMode, recordScoreAchievementEvent } from "./augmentAchievements.js";
import { updateProfileStats } from "./profileStats.js";
import { getAugmentCategoryEnName, initGameMenu } from "./gameMenu.js";
import { els, handleAppScaling, initMainSkeletons, isLocalhost, removeMainSkeletons } from "./appShell.js";
import { escapeHtml } from "./htmlUtils.js";
import { cacheProfileData, deleteCachedProfileData, disposeProfileController, refreshUserHistory, renderHistoryAvatar, resetProfileModal, updateCachedProfileData } from "./profileController.js";
import { createProfileEditor } from './profileEditor.js';
import { addGameLog, getCategoryDisplayName, getPlayerLabel, initGameLog, renderGameLogHistory, showAugment, showMatchInfo } from "./gameLog.js";
import { resumeLandingDice, silenceLandingDice } from "./landingDice.js";
import { soundEngine } from "./SoundEngine.js";
import {
  canAcquireAugment,
  createAugmentApplicationPlan,
  createProphetCandidates,
  createQuestProgressPlan,
  getRandomBoxCandidates,
  selectRandomBoxAward
} from "./augmentRules.js";
import { createLocalRollOutcome } from "./localDiceResultProvider.js";
import { SCORE_CATEGORIES, UPPER_CATEGORIES } from './game/core/gameConstants.js';
import { createTurnTimer, TURN_DURATION_SECONDS } from './game/client/turnTimer.js';
import { createLocalGameState } from './game/client/localGameState.js';
import { getSeededAugments as getSeededAugmentsFromPool } from './game/augments/augmentDraft.js';
import { resolveTurnAdvance } from './game/core/turnFlow.js';
import { createTurnReadyPlan, createTurnStartPlan } from './game/client/turnStartPlan.js';
import { createTimeoutDicePlan, selectBestTimeoutScore } from './game/core/turnTimeout.js';
import { createScoreCommitPlan, createScoreDecision, resolveScoreCommitPhase } from './game/core/scoreCommit.js';
import { createEndGameSummary } from './game/core/endGameSummary.js';
import { createMatchPersistencePlan, createProfileStatsUpdatePlan } from './game/client/matchPersistence.js';
import { createAugmentProgressCompletionPlan } from './game/client/augmentProgressCompletion.js';
import { renderEndGameSummary } from './game/client/endGameRenderer.js';
import { createSessionResetPlan } from './game/client/sessionLifecycle.js';
import { createScoreboardStructurePlan, createScoreboardViewModel } from './game/client/scoreboardViewModel.js';
import { createAuthoritativeStatePlan } from './game/client/authoritativeStatePlan.js';
import { createPinInputController } from './game/client/pinInputController.js';
import { createLobbyController } from './game/client/lobbyController.js';
import { createMatchmakingController } from './game/client/matchmakingController.js';
import { createUiEventController } from './game/client/uiEventController.js';

const uiEventControllers = {
  auth: createUiEventController(),
  modeSelection: createUiEventController(),
  matchmaking: createUiEventController(),
  lobby: createUiEventController(),
  gameplay: createUiEventController()
};
const lifecycleUiEvents = createUiEventController();
let profileEditor = null;

let augmentData = defaultAugmentsData || [];
let augmentProgressSession = null;
const diceAugmentTypes = {
  'weighted-dice': 'heavy',
  'golden-die': 'golden',
  '8-sided': 'octahedron',
  'strange-die': 'weird',
  'promotion-die': 'promotion',
  'couple-dice': 'couple',
  'sevens-dice': 'sevens'
};

export { escapeHtml };

// 1. 유저 식별 (랜덤 닉네임 생성 및 캐시)
let myNickname = localStorage.getItem('ad_nickname');
if (!myNickname) {
  const adjectives = ['재빠른', '신중한', '묵직한', '황금', '이상한', '럭키'];
  const nouns = ['주사위', '스트레이트', '요트', '풀하우스', '초이스'];
  const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
  myNickname = `${randAdj} ${randNoun}`;
  localStorage.setItem('ad_nickname', myNickname);
}
let myStatusMsg = localStorage.getItem('ad_status_msg');
let myAvatarUrl = localStorage.getItem('ad_avatar_url');
let myCropData = null;
try {
  const cropStr = localStorage.getItem('ad_crop_data');
  if (cropStr) myCropData = JSON.parse(cropStr);
} catch (e) { }

// -----------------------------------------------------
// 스켈레톤 스크린 제어 시스템
// -----------------------------------------------------
// 캐시된 로그인 상태 확인 (낙관적 뷰 전환: 새로고침 시 랜딩 뷰 건너뛰고 메인 화면 즉시 노출 + 스켈레톤 활성화)
const isLoggedInCache = localStorage.getItem('ad_logged_in') === 'true';
if (isLoggedInCache) {
  silenceLandingDice();
  els.landingView?.classList.add('hidden');
  els.loginView?.classList.add('hidden');
  els.nicknameSetupView?.classList.add('hidden');
  els.appContainer?.classList.remove('hidden');
  handleAppScaling(); // 스컨테이너 노출 즉시 스케일링 동기화
  initMainSkeletons();
  if (myNickname) {
    if (els.myNickname) els.myNickname.textContent = myNickname;
    if (els.profileNickname) els.profileNickname.textContent = myNickname;
  }
  const statusToSet = myStatusMsg || '안녕하세요! 주사위 굴리러 왔습니다.';
  if (els.profileStatusMsg) {
    els.profileStatusMsg.textContent = statusToSet;
  }
  if (myAvatarUrl && myCropData) {
    if (typeof renderAvatar === 'function') {
      renderAvatar(myAvatarUrl, myCropData);
    }
  }
}

// 전역 상태
let gameMode = 'none'; // 'hotseat' | 'multi'
let diceBoxReady = false;

// 게임 턴 상태
let currentPlayer = 1; // 1 or 2
let currentRound = 1; // 1 to 12
let rollsLeft = 3;
let keptDice = []; // 킵된 주사위 배열 (값만 저장)
let activeDice = []; // 방금 굴린 주사위 배열 (값만 저장)
const initialLocalGameState = createLocalGameState();
let scores = initialLocalGameState.scores;
let activeAugments = initialLocalGameState.activeAugments;
let extraTurns = initialLocalGameState.extraTurns;
let isExtraTurnPhase = false;
let upperBonusThreshold = initialLocalGameState.upperBonusThreshold;
let yachtBankState = initialLocalGameState.yachtBankState;
let destroyedStrangeDice = initialLocalGameState.destroyedStrangeDice;
let promotionConsumed = initialLocalGameState.promotionConsumed;
let promotionAcquiredRound = initialLocalGameState.promotionAcquiredRound;
let playerTableFlipUsed = initialLocalGameState.playerTableFlipUsed;
let equivalentExchangeUses = initialLocalGameState.equivalentExchangeUses;
let equivalentExchangePenalty = initialLocalGameState.equivalentExchangePenalty;
let equivalentExchangeTurnUses = initialLocalGameState.equivalentExchangeTurnUses;
let questProgress = initialLocalGameState.questProgress;
let globalBonus = initialLocalGameState.globalBonus;
let draftSelections = initialLocalGameState.draftSelections;
let duelState = initialLocalGameState.duelState;
let coinTossState = initialLocalGameState.coinTossState;
let randomBoxAward = initialLocalGameState.randomBoxAward;
let prophetState = initialLocalGameState.prophetState;
let gambitState = initialLocalGameState.gambitState;
let doubleDownState = initialLocalGameState.doubleDownState;
let piggyBankState = initialLocalGameState.piggyBankState;
let diceAlchemyUsed = initialLocalGameState.diceAlchemyUsed;

function getPlayerAugments(player) {
  return Object.values(activeAugments[player] || {});
}

function hasAugment(player, augmentId) {
  return getPlayerAugments(player).includes(augmentId);
}

function generateLocalProphetNumbers(player) {
  const list = createProphetCandidates({
    categoryIds: categories.filter((category) => !category.isDivider).map((category) => category.id),
    scores: scores[player],
    activeAugments: activeAugments[player],
    calculateScores,
    scoreContext: { bank: yachtBankState[player]?.accumulatedScore || 0 }
  });
  for (let index = list.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list.slice(0, 3);
}

function resolveLocalRandomBoxes() {
  for (let player = 1; player <= getActivePlayerCount(); player++) {
    if (activeAugments[player]?.eh15 !== 'random-box' || randomBoxAward[player]) continue;
    delete activeAugments[player].eh15;
    const owned = getPlayerAugments(player);
    const candidates = getRandomBoxCandidates({ definitions: augmentData, ownedIds: owned });
    const awarded = selectRandomBoxAward(candidates, Math.floor(Math.random() * candidates.length));
    randomBoxAward[player] = awarded;
    if (awarded) window.applyAugment(player, awarded, true);
  }
}
let momentumState = initialLocalGameState.momentumState;
let momentumGainedScore = initialLocalGameState.momentumGainedScore;
let bountyHunterTarget = initialLocalGameState.bountyHunterTarget;
let bountyHunterAcquiredRound = initialLocalGameState.bountyHunterAcquiredRound;
let bountyHunterProgress = initialLocalGameState.bountyHunterProgress;
let authoritativeGameState = null;
let pendingAuthoritativeGameState = null;
let nextLocalDieId = 1;
let localRollToken = 0;

const turnTimer = createTurnTimer({
  getCurrentPlayer: () => currentPlayer,
  getActiveAugments: (player) => activeAugments[player] || activeAugments[`p${player}`] || {},
  getQuestProgress: (player) => questProgress[player] || questProgress[`p${player}`] || {},
  getGameMode: () => gameMode,
  isSessionStarted: () => Boolean(window.gameSessionStarted),
  getTimerElement: () => document.getElementById('turn-timer') || els.turnTimer,
  getTimerTextElement: () => document.getElementById('turn-timer-text'),
  soundEngine,
  onTimeout: () => handleTurnTimeout()
});

function isAuthoritativeOnlineMatch() {
  return window.isMultiplayer && Boolean(authoritativeGameState);
}

async function rollLocalDice(configs, { action = 'roll' } = {}) {
  const rollToken = ++localRollToken;
  diceEngine.diceArray.forEach((die) => {
    if (die.serverId == null) die.serverId = nextLocalDieId++;
    else nextLocalDieId = Math.max(nextLocalDieId, Number(die.serverId) + 1);
  });
  const keptDiceState = diceEngine.diceArray
    .filter((die) => die.isKept)
    .map((die) => ({
      id: die.serverId,
      type: die.config?.type || 'normal',
      promotionLevel: die.config?.promotionLevel || 0,
      value: die.value,
      kept: true
    }));
  const outcome = createLocalRollOutcome({
    configs,
    keptDice: action === 'tableFlip' ? [] : keptDiceState,
    nextDieId: nextLocalDieId,
    action
  });
  nextLocalDieId = outcome.nextDieId;
  const animatedConfigs = configs.map((config, index) => ({
    ...config,
    serverId: outcome.rolledDice[index].id
  }));
  const replayed = await diceEngine.rollWithTargetValues(
    animatedConfigs,
    outcome.rolledDice.map((die) => die.value),
    { presetIndex: outcome.presetIndex, mirrored: outcome.mirrored },
    { isFlip: action === 'tableFlip' }
  );
  if (rollToken !== localRollToken) return { source: 'cancelled' };
  if (!replayed) {
    if (action === 'tableFlip') await diceEngine.flipTable();
    else await diceEngine.roll(configs);
    if (rollToken !== localRollToken) return { source: 'cancelled' };
    return { source: 'local-physics' };
  }
  await diceEngine.completeAuthoritativeRoll(outcome.dice, 500);
  if (rollToken !== localRollToken) return { source: 'cancelled' };
  return outcome;
}

initGameLog(() => activeAugments);


// 2. Firebase Auth 흐름 제어
subscribeAuthState(async (user) => {
  if (user) {
    // Firestore에서 유저 데이터 조회
    const userData = await getUserFromDB(user.uid);
    cacheProfileData(user.uid, userData);
    refreshUserHistory(user.uid);

    if (userData && userData.nickname) {
      // 닉네임이 설정된 로그인 유저: 메인 게임 화면으로 바로 이동
      localStorage.setItem('ad_logged_in', 'true');
      localStorage.setItem('ad_nickname', userData.nickname);
      silenceLandingDice();
      els.landingView?.classList.add('hidden');
      els.loginView?.classList.add('hidden');
      els.nicknameSetupView?.classList.add('hidden');
      els.appContainer?.classList.remove('hidden');

      const nick = userData.nickname;
      if (els.myNickname) els.myNickname.textContent = nick;
      if (els.profileNickname) els.profileNickname.textContent = nick;

      const profileStatus = document.getElementById('profile-status-msg');
      if (profileStatus && userData.statusMsg) {
        profileStatus.textContent = userData.statusMsg;
        localStorage.setItem('ad_status_msg', userData.statusMsg);
      }

      if (userData.avatarUrl && userData.cropData) {
        localStorage.setItem('ad_avatar_url', userData.avatarUrl);
        localStorage.setItem('ad_crop_data', JSON.stringify(userData.cropData));
        if (typeof renderAvatar === 'function') {
          renderAvatar(userData.avatarUrl, userData.cropData, () => {
            removeMainSkeletons();
          });
        } else {
          removeMainSkeletons();
        }
      } else {
        localStorage.removeItem('ad_avatar_url');
        localStorage.removeItem('ad_crop_data');
        resetAvatarUI();
        removeMainSkeletons();
      }

      // 진행 중인 게임 재접속 체크
      if (userData.activeRoomId) {
        const modal = document.getElementById('reconnect-modal');
        if (modal) modal.classList.remove('hidden');

        const btnJoin = document.getElementById('btn-reconnect-join');
        const btnCancel = document.getElementById('btn-reconnect-cancel');

        if (btnJoin) {
          btnJoin.onclick = () => {
            modal.classList.add('hidden');
            window.pendingLobbyMode = userData.activeGameMode || 'normal';
            window.isMultiplayer = true;

            // 로비를 거치지 않고 바로 대전 화면으로 이동
            els.appContainer.className = '';
            if (window.pendingLobbyMode === 'normal') {
              els.appContainer.classList.add('playing-state', 'normal-mode');
            } else {
              els.appContainer.classList.add('playing-state');
            }

            window.currentRoomCode = userData.activeRoomId;
            if (els.lobbyCodeDisplay) els.lobbyCodeDisplay.textContent = userData.activeRoomId;
            const storedOnlineMatch = JSON.parse(sessionStorage.getItem('ad_online_match') || 'null');
            if (
              storedOnlineMatch
              && String(storedOnlineMatch.roomId || '').toUpperCase() === String(userData.activeRoomId).toUpperCase()
            ) {
              networkEngine.currentMatch = storedOnlineMatch;
              networkEngine.connectToOnlineMatch(storedOnlineMatch);
            } else {
              networkEngine.connectToLobby(userData.activeRoomId);
            }
            startMultiplayerGame();
          };
        }

        if (btnCancel) {
          btnCancel.onclick = async () => {
            modal.classList.add('hidden');
            const roomToCancel = userData.activeRoomId;
            const user = getCurrentUser();

            await resetUserSessionState();

            if (roomToCancel) {
              try {
                const sendForfeitAndDisconnect = () => {
                  const targetUid = window.myUid || user?.uid;
                  networkEngine.sendMessage({ type: 'player_forfeited', uid: targetUid });
                  setTimeout(() => {
                    networkEngine.disconnect();
                  }, 150);

                  if (targetUid) {
                    setTimeout(() => {
                      refreshUserHistory(targetUid);
                    }, 1200);
                  }
                };

                const onConnected = () => {
                  sendForfeitAndDisconnect();
                };
                networkEngine.once('connected', onConnected);
                networkEngine.connectToLobby(roomToCancel, true);
              } catch (e) {
                console.error("Forfeit notify error:", e);
                networkEngine.disconnect();
              }
            } else {
              networkEngine.disconnect();
            }
          };
        }
      }
    } else {
      // DB에 회원정보(닉네임)가 없는 경우: 닉네임 설정 화면
      silenceLandingDice();
      els.landingView?.classList.add('hidden');
      els.loginView?.classList.add('hidden');
      els.appContainer?.classList.add('hidden');
      els.nicknameSetupView?.classList.remove('hidden');
    }
  } else {
    // 비로그인 유저: 랜딩 페이지
    localStorage.removeItem('ad_logged_in');
    els.appContainer?.classList.add('hidden');
    els.loginView?.classList.add('hidden');
    els.nicknameSetupView?.classList.add('hidden');
    els.landingView?.classList.remove('hidden');
  }
});

uiEventControllers.auth.bind(els.btnGetStarted, 'click', () => {
  silenceLandingDice();
  els.landingView?.classList.add('hidden');
  els.loginView?.classList.remove('hidden');
});

uiEventControllers.auth.bind(els.btnGoogleLogin, 'click', async () => {
  try {
    await signInWithGoogle();
    // 성공하면 subscribeAuthState가 알아서 뷰를 전환함
  } catch (error) {
    console.error("Login failed", error);
  }
});

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  uiEventControllers.auth.bind(btnLogout, 'click', async () => {
    try {
      // 로그아웃 시 로비 초기화 및 퇴장
      networkEngine.disconnect();
      // 상태 클래스 초기화 (mode-select-state)
      if (els.appContainer) {
        els.appContainer.className = 'mode-select-state';
      }

      // 이전 픽스에서 잘못 들어갔던 hidden 제거
      if (els.lobbySection) els.lobbySection.classList.remove('hidden');
      if (els.lobbySelectSection) els.lobbySelectSection.classList.remove('hidden');

      // 프로필 DOM 캐시 초기화
      if (els.myNickname) els.myNickname.textContent = "Player";
      if (els.profileNickname) els.profileNickname.textContent = "Player";
      const statusMsg = document.getElementById('profile-status-msg');
      if (statusMsg) statusMsg.textContent = "";

      resetAvatarUI();

      await signOutUser();

      const landingView = document.getElementById('landing-view');
      if (landingView) {
        landingView.classList.remove('fade-in');
        void landingView.offsetWidth; // Reflow
        landingView.classList.add('fade-in');
      }

      resumeLandingDice();
    } catch (e) {
      console.error("Logout failed", e);
    }
  });
}

function validateNickname(nickname) {
  if (!nickname) {
    return { valid: false, message: "닉네임을 입력해주세요!" };
  }

  // 1. 기본 문자 검사 (공백 포함: 한글, 영문, 숫자, ., _, 공백만 허용)
  const allowedChars = /^[가-힣a-zA-Z0-9._ ]+$/;
  if (!allowedChars.test(nickname)) {
    return { valid: false, message: "한글, 영문, 숫자, 마침표(.), 언더바(_), 공백만 사용 가능합니다." };
  }

  // 2. 시작과 끝 문자 제한 검사 (공백, ., _ 로 시작하거나 끝날 수 없음)
  const invalidEnds = /^[._ ]|[._ ]$/;
  if (invalidEnds.test(nickname)) {
    return { valid: false, message: "닉네임의 처음과 끝에는 공백, 마침표(.), 언더바(_)를 사용할 수 없습니다." };
  }

  // 3. 연속 중복 사용 검사
  // 연속 공백("  "), 연속 마침표(".."), 연속 언더바("__") 방지
  if (nickname.includes('  ') || nickname.includes('..') || nickname.includes('__')) {
    return { valid: false, message: "공백, 마침표(.), 언더바(_)를 연속해서 사용할 수 없습니다." };
  }

  // 4. 특수문자 및 공백 간의 부자연스러운 인접 방지 (예: ". ", "_ ", " .", " _")
  if (nickname.includes('. ') || nickname.includes(' .') || nickname.includes('_ ') || nickname.includes(' _')) {
    return { valid: false, message: "특수문자(., _)와 공백은 붙여서 사용할 수 없습니다." };
  }

  // 5. 가중치 길이 계산 (한글 2점, 나머지 1점)
  let score = 0;
  for (let i = 0; i < nickname.length; i++) {
    const char = nickname.charCodeAt(i);
    if (char >= 0xAC00 && char <= 0xD7A3) {
      score += 2;
    } else {
      score += 1;
    }
  }

  if (score < 4 || score > 16) {
    return { valid: false, message: "닉네임 길이는 한글 기준 최대 8자, 영문 기준 최대 16자 내외여야 합니다." };
  }

  return { valid: true };
}

uiEventControllers.auth.bind(els.btnSubmitNickname, 'click', async () => {
  const nickname = els.nicknameInput?.value || "";
  const validation = validateNickname(nickname);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }

  // reCAPTCHA v3 검증 (백그라운드 토큰 발급)
  if (typeof grecaptcha !== 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        grecaptcha.ready(async () => {
          try {
            const token = await grecaptcha.execute('6LdKulgtAAAAAJgJb6_hEQJNE7hKre6Ab8EURscy', { action: 'submit' });
            if (!token) reject("토큰 발급 실패");
            else resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    } catch (e) {
      alert("자동가입 방지(reCAPTCHA) 검증에 실패했습니다. 다시 시도해주세요.");
      return;
    }
  }

  try {
    const user = getCurrentUser();
    if (user) {
      await setNickname(user, nickname);
      // Firestore DB에 데이터 병합
      await saveUserToDB(user.uid, nickname);

      // 설정 완료 플래그 저장 (현재 기기 fallback)
      localStorage.setItem('isNicknameSet_' + user.uid, 'true');

      // 화면 전환
      els.nicknameSetupView?.classList.add('hidden');
      els.appContainer?.classList.remove('hidden');
      if (els.myNickname) els.myNickname.textContent = nickname;
      if (els.profileNickname) els.profileNickname.textContent = nickname;
      deleteCachedProfileData(user.uid);
    }
  } catch (e) {
    alert("닉네임 설정 중 오류가 발생했습니다.");
    console.error(e);
  }
});

// -----------------------------------------------------
// 3. 로컬 핫시트 모드 로직 (코어 게임 루프)
// -----------------------------------------------------

function transitionToPlaying(mode) {
  if (!els.appContainer) return;

  // 1. 페이드 아웃 시작
  els.appContainer.style.opacity = '0';

  setTimeout(() => {
    // 2. 완전히 투명해진 상태에서 레이아웃 전환 및 게임 초기화
    els.appContainer.classList.remove('mode-select-state');
    els.appContainer.classList.add('playing-state');

    if (mode === 'hotseat') {
      els.appContainer.classList.add('normal-mode');
    } else {
      els.appContainer.classList.remove('normal-mode');
    }

    gameMode = mode;
    if (els.p1Name) els.p1Name.querySelector('.name-text').textContent = "Player 1";
    if (els.p2Name) els.p2Name.querySelector('.name-text').textContent = "Player 2";

    if (mode === 'hotseat') {
      showMatchInfo();
    } else {
      showAugment();
    }

    startHotseatGame(mode);

    // 3. 다시 페이드 인
    requestAnimationFrame(() => {
      els.appContainer.style.opacity = '1';
    });
  }, 600); // style.css의 opacity 0.6s 전환 시간과 동일하게 대기
}

uiEventControllers.modeSelection.bind(els.btnPlayNormal, 'click', () => {
  try {
    transitionToPlaying('hotseat');
  } catch (err) {
    alert("오류 발생: " + err.message + "\n" + err.stack);
    console.error(err);
  }
});

uiEventControllers.modeSelection.bind(els.btnAugHotseat, 'click', () => {
  try {
    transitionToPlaying('augmented-hotseat');
  } catch (err) {
    alert("오류 발생: " + err.message + "\n" + err.stack);
    console.error(err);
  }
});

// --- Lobby Flow ---
const pinInputController = createPinInputController({
  inputs: document.querySelectorAll('.pin-digit-input'),
  fallbackInput: els.inputLobbyJoinCode
});
const lobbyController = createLobbyController({
  networkEngine,
  lobbySection: els.lobbySection,
  handlers: {
    onLobbyState: handleLobbyState,
    onError: handleLobbyError,
    onGameStarted: handleGameStarted
  }
});
const matchmakingController = createMatchmakingController({
  networkEngine,
  handlers: {
    onMatchFound: handleMatchFound,
    onMatchCancelled: handleMatchCancelled,
    onError: handleMatchmakingError
  }
});

const startLobbyWaitingAnimation = () => lobbyController.startWaiting();
const stopLobbyWaitingAnimation = () => lobbyController.stopWaiting();

function clearDisconnectTimers() {
  [1, 2, 3, 4].forEach((playerIndex) => {
    if (disconnectTimers[playerIndex]) {
      clearInterval(disconnectTimers[playerIndex]);
      disconnectTimers[playerIndex] = null;
    }
  });
}

function applySessionResetPlan(resetPlan, { resetWindow = false } = {}) {
  ({
    currentPlayer,
    currentRound,
    rollsLeft,
    activeDice,
    keptDice,
    authoritativeGameState,
    pendingAuthoritativeGameState,
    nextLocalDieId,
    isExtraTurnPhase,
    isGameEnded,
    augmentProgressSession,
    isViewingOpponentAugments,
    forfeitedPlayers,
    forfeitedPlayerUids,
    disconnectGrace,
    scores,
    activeAugments,
    extraTurns,
    upperBonusThreshold,
    yachtBankState,
    destroyedStrangeDice,
    promotionConsumed,
    promotionAcquiredRound,
    playerTableFlipUsed,
    equivalentExchangeUses,
    equivalentExchangePenalty,
    equivalentExchangeTurnUses,
    questProgress,
    globalBonus,
    draftSelections,
    duelState,
    coinTossState,
    randomBoxAward,
    prophetState,
    gambitState,
    doubleDownState,
    piggyBankState,
    diceAlchemyUsed,
    momentumState,
    momentumGainedScore,
    bountyHunterTarget,
    bountyHunterAcquiredRound,
    bountyHunterProgress
  } = resetPlan.runtimeState);
  if (resetWindow) Object.assign(window, resetPlan.userWindowState);
}

export async function resetUserSessionState() {
  stopTurnTimer();
  stopLobbyWaitingAnimation();
  matchmakingController.reset();
  clearDisconnectTimers();
  networkEngine.disconnect();
  networkEngine.removeAllListeners('connected');
  sessionStorage.removeItem('ad_online_match');
  applySessionResetPlan(createSessionResetPlan(), { resetWindow: true });
  localRollToken++;

  const user = getCurrentUser();
  if (user?.uid) {
    await clearUserActiveGame(user.uid);
  }
}

const clearMatchmakingTimers = () => matchmakingController.clearTimers();

function setMatchmakingPanel(panel) {
  els.matchmakingSettings?.classList.toggle('hidden', panel !== 'settings');
  els.matchmakingWaiting?.classList.toggle('hidden', panel !== 'waiting');
  els.matchmakingConfirm?.classList.toggle('hidden', panel !== 'confirm');
  if (els.btnMatchmakingBack) els.btnMatchmakingBack.disabled = panel === 'confirm';
}

function populateMatchmakingRanges() {
  const values = Array.from({ length: 10 }, (_, index) => (index + 1) * 100);
  const render = (select, unlimitedFirst) => {
    if (!select || select.options.length) return;
    const options = unlimitedFirst
      ? [['unlimited', '제한 없음'], ...values.map((value) => [String(value), String(value)])]
      : [...values.map((value) => [String(value), String(value)]), ['unlimited', '제한 없음']];
    options.forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = 'unlimited';
  };
  render(els.matchmakingLower, true);
  render(els.matchmakingUpper, false);
}

async function showMatchmaking(mode) {
  if (!getCurrentUser()) {
    alert('온라인 플레이는 로그인이 필요함.');
    return;
  }
  await resetUserSessionState();
  const matchmakingMode = matchmakingController.setMode(mode);
  window.pendingLobbyMode = matchmakingMode;
  const user = getCurrentUser();
  const userData = await getUserFromDB(user.uid);
  const modeData = userData?.stats?.modes?.[matchmakingMode] || {};
  const storedRating = Number(modeData.rating);
  const matchmakingRating = matchmakingController.setRating(modeData.rating !== null && modeData.rating !== '' && Number.isFinite(storedRating)
    ? Math.max(0, storedRating)
    : 500);

  populateMatchmakingRanges();
  if (els.matchmakingTitle) {
    els.matchmakingTitle.textContent = matchmakingMode === 'normal'
      ? '요트 다이스 온라인 플레이'
      : '증강 요트 다이스 온라인 플레이';
  }
  if (els.matchmakingMyRating) els.matchmakingMyRating.textContent = String(matchmakingRating);
  if (els.matchmakingMyNickname) els.matchmakingMyNickname.textContent = userData?.nickname || user.displayName || 'Player';
  if (els.matchmakingMyAvatar) {
    els.matchmakingMyAvatar.style.backgroundImage = userData?.avatarUrl ? `url('${userData.avatarUrl}')` : '';
  }
  if (els.matchmakingError) els.matchmakingError.textContent = '';
  els.appContainer.className = 'matchmaking-state';
  setMatchmakingPanel('settings');
}

function returnToMatchmakingSettings(message = '') {
  clearMatchmakingTimers();
  matchmakingController.reset();
  sessionStorage.removeItem('ad_online_match');
  if (els.matchmakingError) els.matchmakingError.textContent = message;
  if (els.btnMatchmakingStart) els.btnMatchmakingStart.disabled = false;
  if (els.btnMatchmakingCancelMatch) els.btnMatchmakingCancelMatch.disabled = false;
  setMatchmakingPanel('settings');
}

function cancelMatchmakingAndReturn() {
  networkEngine.cancelMatchmaking();
  setTimeout(() => networkEngine.disconnect(), 120);
  returnToMatchmakingSettings();
}

uiEventControllers.modeSelection.bind(els.btnNormOnline, 'click', () => void showMatchmaking('normal'));
uiEventControllers.modeSelection.bind(els.btnAugOnline, 'click', () => void showMatchmaking('augmented'));

uiEventControllers.matchmaking.bind(els.btnMatchmakingBack, 'click', () => {
  networkEngine.cancelMatchmaking();
  networkEngine.disconnect();
  clearMatchmakingTimers();
  els.appContainer.className = 'mode-select-state';
});

uiEventControllers.matchmaking.bind(els.btnMatchmakingStart, 'click', async () => {
  if (!matchmakingController.beginSearch()) return;
  els.btnMatchmakingStart.disabled = true;
  const lower = els.matchmakingLower?.value || 'unlimited';
  const upper = els.matchmakingUpper?.value || 'unlimited';
  if (lower !== 'unlimited' && upper !== 'unlimited' && Number(lower) > Number(upper)) {
    if (els.matchmakingError) els.matchmakingError.textContent = '하한선은 상한선보다 클 수 없음.';
    matchmakingController.reset();
    els.btnMatchmakingStart.disabled = false;
    return;
  }

  if (els.matchmakingError) els.matchmakingError.textContent = '';
  setMatchmakingPanel('waiting');
  matchmakingController.startElapsed((seconds) => {
    if (els.matchmakingElapsed) {
      els.matchmakingElapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
  });

  try {
    await networkEngine.connectToMatchmaking({
      mode: matchmakingController.getMode(),
      lower,
      upper
    });
  } catch (error) {
    returnToMatchmakingSettings(error.message || '매치메이킹 시작에 실패함.');
  }
});

uiEventControllers.matchmaking.bind(els.btnMatchmakingCancelQueue, 'click', cancelMatchmakingAndReturn);
uiEventControllers.matchmaking.bind(els.btnMatchmakingCancelMatch, 'click', cancelMatchmakingAndReturn);

function handleMatchFound(data) {
  clearMatchmakingTimers();
  const match = networkEngine.currentMatch || data;
  sessionStorage.setItem('ad_online_match', JSON.stringify(match));
  if (els.matchmakingOpponentName) els.matchmakingOpponentName.textContent = data.opponent?.nickname || 'Opponent';
  if (els.matchmakingOpponentAvatar) {
    els.matchmakingOpponentAvatar.style.backgroundImage = data.opponent?.avatarUrl ? `url('${data.opponent.avatarUrl}')` : '';
  }
  if (els.btnMatchmakingCancelMatch) els.btnMatchmakingCancelMatch.disabled = false;
  setMatchmakingPanel('confirm');

  const startsAt = Number(data.startsAt) || Date.now() + 3000;
  matchmakingController.startCountdown({
    startsAt,
    onTick: (remaining) => {
    if (els.matchmakingCountdown) els.matchmakingCountdown.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
    },
    onConnect: () => {
      if (els.matchmakingCountdown) els.matchmakingCountdown.textContent = '연결 중';
      if (els.btnMatchmakingCancelMatch) els.btnMatchmakingCancelMatch.disabled = true;
      void networkEngine.connectToOnlineMatch(match);
    },
    onFailure: () => {
      networkEngine.disconnect();
      returnToMatchmakingSettings('게임 세션 연결에 실패하여 설정 화면으로 돌아왔음.');
    },
    isConnected: () => window.gameSessionStarted
  });
}

function handleMatchCancelled(data) {
  networkEngine.disconnect();
  returnToMatchmakingSettings(data?.reason || '매치가 취소되었음.');
}

function handleMatchmakingError(data) {
  networkEngine.disconnect();
  returnToMatchmakingSettings(data?.message || '매치메이킹 서버 연결에 실패함.');
}

lifecycleUiEvents.bind(window, 'pagehide', (event) => {
  if (event.persisted) return;
  if (networkEngine.matchmakingSocket) networkEngine.cancelMatchmaking();
  matchmakingController.dispose();
  lobbyController.dispose();
  pinInputController.dispose();
  profileEditor?.dispose();
  disposeProfileController();
  Object.values(uiEventControllers).forEach(controller => controller.dispose());
  lifecycleUiEvents.dispose();
});

function showLobbySelect(mode) {
  resetUserSessionState();
  window.pendingLobbyMode = mode;
  if (els.lobbySelectModeTitle) {
    els.lobbySelectModeTitle.textContent = mode === 'normal' ? '요트 다이스 로비 플레이' : '증강 요트 다이스 로비 플레이';
  }
  els.appContainer.classList.remove('mode-select-state', 'playing-state', 'normal-mode', 'lobby-state');
  els.appContainer.classList.add('lobby-select-state');
  pinInputController.reset();
  hideLobbyJoinError();
}

function hideLobbyJoinError() {
  const error = document.getElementById('lobby-join-error');
  if (!error) return;
  error.textContent = '';
  error.classList.remove('is-visible', 'shake');
}

function showLobbyJoinError(message) {
  const error = document.getElementById('lobby-join-error');
  if (!error) return;
  error.textContent = message;
  error.classList.remove('shake');
  error.classList.add('is-visible');
  void error.offsetWidth;
  error.classList.add('shake');
}

function showLobby(isHost, joinCode = null, alreadyConnected = false) {
  els.appContainer.classList.remove('lobby-select-state');
  els.appContainer.classList.add('lobby-state');
  startLobbyWaitingAnimation();

  if (window.pendingLobbyMode === 'normal') {
    els.lobbyModeText.textContent = '요트 다이스';
  } else {
    els.lobbyModeText.textContent = '증강 요트 다이스';
  }

  // 모드별 슬롯 개수 동적 구성 (일반 요트: 4인, 증강 요트: 2인)
  const maxSlots = (window.pendingLobbyMode === 'normal') ? 4 : 2;
  const lobbyPlayersContainer = els.lobbySection.querySelector('.lobby-players');
  if (lobbyPlayersContainer) {
    let slotsHtml = '';
    for (let i = 0; i < maxSlots; i++) {
      if (i === 0) {
        slotsHtml += `
          <div class="lobby-player-slot host">
            <div class="player-avatar"></div>
            <div class="player-name">Player 1</div>
            <div class="player-status">✓</div>
          </div>`;
      } else {
        slotsHtml += `
          <div class="lobby-player-slot empty">
            <div class="player-avatar"></div>
            <div class="player-name">Waiting...</div>
            <div class="player-status"></div>
          </div>`;
      }
    }
    lobbyPlayersContainer.innerHTML = slotsHtml;
  }

  const user = getCurrentUser();
  const myName = els.profileNickname?.textContent || "Player 1";
  const slots = els.lobbySection.querySelectorAll('.lobby-player-slot');
  if (slots.length > 0) {
    const p1NameElem = slots[0].querySelector('.player-name');
    if (p1NameElem) p1NameElem.textContent = myName;

    const p1AvatarElem = slots[0].querySelector('.player-avatar');
    const profileAvatarContainer = document.getElementById('profile-avatar-container');
    const currentBg = profileAvatarContainer?.style?.backgroundImage;

    if (p1AvatarElem && currentBg && currentBg !== 'none') {
      p1AvatarElem.style.backgroundImage = currentBg;
      p1AvatarElem.style.backgroundSize = 'cover';
      p1AvatarElem.style.backgroundPosition = 'center';
    } else if (p1AvatarElem && window.myPlayerInfo && window.myPlayerInfo.avatarUrl) {
      p1AvatarElem.style.backgroundImage = `url('${window.myPlayerInfo.avatarUrl}')`;
      p1AvatarElem.style.backgroundSize = 'cover';
      p1AvatarElem.style.backgroundPosition = 'center';
    }
  }

  if (isHost) {
    // 랜덤 로비 코드 생성 (6자리 대문자)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    els.lobbyCodeDisplay.textContent = code;
    els.btnLobbyStart.textContent = '게임 시작';
    networkEngine.connectToLobby(code);
  } else {
    const uppercaseCode = String(joinCode || '').trim().toUpperCase();
    els.lobbyCodeDisplay.textContent = uppercaseCode;
    els.btnLobbyStart.textContent = '준비 (Ready)';
    if (!alreadyConnected) networkEngine.connectToLobby(uppercaseCode);
  }

  // 로비 상태 초기화
  window.isReady = false;
  els.btnLobbyStart.classList.remove('ready');
}

// 네트워크 이벤트 리스너 등록
function handleLobbyState(data) {
  if (lobbyController.getPendingJoinCode()) {
    const code = lobbyController.consumePendingJoinCode();
    showLobby(false, code, true);
  }

  const players = data.players || [];
  const oldPlayers = window.lobbyPlayers || [];

  // 퇴장/입장 감지 알림
  if (oldPlayers.length > 0) {
    oldPlayers.forEach(op => {
      if (!players.some(np => np.uid === op.uid || np.connId === op.connId)) {
        addGameLog(`${op.nickname} 님이 로비에서 퇴장하셨습니다.`, 'system', false);
      }
    });
    players.forEach(np => {
      if (!oldPlayers.some(op => op.uid === np.uid || op.connId === np.connId)) {
        addGameLog(`${np.nickname} 님이 로비에 입장하셨습니다.`, 'system', false);
      }
    });
  }

  window.lobbyPlayers = players;
  const slots = els.lobbySection.querySelectorAll('.lobby-player-slot');

  // 모든 슬롯 초기화
  slots.forEach(slot => {
    slot.className = 'lobby-player-slot empty';
    const nameElem = slot.querySelector('.player-name');
    if (nameElem) nameElem.textContent = `Waiting${'.'.repeat(lobbyController.getWaitingDotsCount())}`;
    const avatarElem = slot.querySelector('.player-avatar');
    if (avatarElem) {
      avatarElem.style.backgroundImage = 'none';
      avatarElem.style.backgroundColor = '#ccc';
    }
    const statusElem = slot.querySelector('.player-status');
    if (statusElem) {
      statusElem.textContent = '';
      statusElem.className = 'player-status';
    }
  });

  // 서버에서 받은 유저 정보로 채우기
  players.forEach((p, index) => {
    if (index >= slots.length) return;
    const slot = slots[index];
    slot.className = 'lobby-player-slot' + (p.isHost ? ' host' : '') + (p.isReady ? ' ready-state' : '');

    const nameElem = slot.querySelector('.player-name');
    if (nameElem) {
      nameElem.textContent = p.nickname;
    }

    const avatarElem = slot.querySelector('.player-avatar');
    if (avatarElem) {
      if (p.avatarUrl) {
        avatarElem.style.backgroundImage = `url(${p.avatarUrl})`;
        avatarElem.style.backgroundSize = 'cover';
        avatarElem.style.backgroundPosition = 'center';
      } else {
        avatarElem.style.backgroundImage = 'none';
        avatarElem.style.backgroundColor = '#ccc';
      }
    }

    const statusElem = slot.querySelector('.player-status');
    if (statusElem) {
      if (p.isHost || p.isReady) {
        statusElem.textContent = '✓';
        statusElem.className = 'player-status ready';
      } else {
        statusElem.innerHTML = '<span>•</span><span>•</span><span>•</span>';
        statusElem.className = 'player-status not-ready';
      }
    }
  });

  // 내가 호스트인지 확인하고 버튼 제어
  const myConnId = networkEngine.socket?.id; // PartySocket id
  const myUid = window.myUid || getCurrentUser()?.uid;
  const me = players.find(p => (myConnId && p.connId === myConnId) || (myUid && p.uid === myUid));
  if (me) {
    window.myPlayerInfo = me;
    if (me.isHost) {
      els.btnLobbyStart.textContent = '게임 시작';
      const allReady = players.every(p => p.isReady);
      els.btnLobbyStart.disabled = players.length <= 1 || !allReady;
    } else {
      els.btnLobbyStart.textContent = me.isReady ? '준비 완료 (Cancel)' : '준비 (Ready)';
      els.btnLobbyStart.disabled = false;
    }
  }
}

function handleLobbyError(data) {
  if (isAuthoritativeOnlineMatch() && els.appContainer?.classList.contains('playing-state')) {
    addGameLog(data?.message || '게임 명령이 거부되었습니다.', 'system', false);
    return;
  }
  if (!lobbyController.getPendingJoinCode()) return;
  const isModeMismatch = data?.code === 'ROOM_MODE_MISMATCH';
  const message = isModeMismatch
    ? '게임모드가 다른 방에 입장할 수 없습니다.'
    : (data?.message || '방에 입장할 수 없습니다.');
  lobbyController.clearPendingJoinCode();
  networkEngine.disconnect();
  stopLobbyWaitingAnimation();
  els.appContainer?.classList.remove('lobby-state');
  els.appContainer?.classList.add('lobby-select-state');
  showLobbyJoinError(message);
}

function handleGameStarted(data) {
  stopLobbyWaitingAnimation();
  clearMatchmakingTimers();
  window.gameSessionStarted = true;
  if (Array.isArray(data.players)) window.lobbyPlayers = data.players;
  if (data?.sessionType === 'matchmaking') {
    networkEngine.notifyMatchStarted();
  }
  pendingAuthoritativeGameState = data?.authoritativeState || null;
  // 모든 기존 상태 클래스를 제거하고 게임 화면으로 이동
  els.appContainer.className = '';

  if (window.pendingLobbyMode === 'normal') {
    els.appContainer.classList.add('playing-state', 'normal-mode');
  } else {
    els.appContainer.classList.add('playing-state');
  }

  window.isMultiplayer = true;
  if (window.lobbyPlayers && Array.isArray(window.lobbyPlayers)) {
    window.initialMatchPlayers = JSON.parse(JSON.stringify(window.lobbyPlayers));
    window.matchTotalPlayers = window.lobbyPlayers.length;
  }
  startMultiplayerGame();
}

networkEngine.on('rating_settled', (data) => {
  const user = getCurrentUser();
  const result = user ? data?.results?.[user.uid] : null;
  if (result) {
    addGameLog(`레이팅 ${result.before} → ${result.after} (${result.delta >= 0 ? '+' : ''}${result.delta})`, 'system', false);
    deleteCachedProfileData(user.uid);
    refreshUserHistory(user.uid);
  }
});

networkEngine.on('rating_settlement_failed', () => {
  addGameLog('레이팅 정산이 지연되고 있음.', 'system', false);
});

networkEngine.on('authoritative_timer', (data) => {
  if (!authoritativeGameState || data.revision !== authoritativeGameState.revision) return;
  authoritativeGameState.turnTimeRemaining = Number(data.turnTimeRemaining) || 0;
  turnTimer.setRemaining(authoritativeGameState.turnTimeRemaining);
  const draftTimerText = document.getElementById('augment-timer-text');
  if (authoritativeGameState.phase === 'draft' && draftTimerText) {
    draftTimerText.textContent = `${Math.max(0, Math.floor(turnTimer.getRemaining()))}s`;
  }
  updateTurnTimerUI();
});

networkEngine.on('authoritative_state', (data) => {
  if (!data?.state) return;
  authoritativeApplyQueue = authoritativeApplyQueue
    .then(async () => {
      // 점수 상태와 로그는 즉시 반영함. 3초 유예는 서버의 다음 입력 차단으로만 유지하고,
      // 여기서 대기하면 점수 표시·로그·정렬 후속 처리가 모두 지연됨.
      return applyAuthoritativeState(data.state, data.action);
    })
    .catch((error) => console.error('[online] state_apply_failed', error));
});

networkEngine.on('ingame_message', (data) => {
  if (data.subType === 'debug_next_turn' || data.type === 'debug_next_turn') {
    window.debugNextTurnHandler?.();
    return;
  }
  if (data.subType === 'debug_prev_turn' || data.type === 'debug_prev_turn') {
    window.debugPrevTurnHandler?.();
    return;
  }

  if (data.type === 'augment_selecting' || data.subType === 'augment_selecting') {
    const optionsContainer = document.getElementById('augment-options');
    if (optionsContainer && optionsContainer.children[data.optionIndex]) {
      optionsContainer.children[data.optionIndex].classList.add('selected');
    }
    return;
  }

  if (data.type === 'apply_augment' || data.subType === 'apply_augment') {
    if (window.applyAugment) {
      window.applyAugment(data.player, data.augmentId, true);
    }
    let expectedCount = 0;
    if (currentRound >= 1) expectedCount = 1;
    if (currentRound >= 6) expectedCount = 2;
    if (currentRound >= 9) expectedCount = 3;

    const p1Count = Object.keys(activeAugments[1] || {}).length;
    const p2Count = Object.keys(activeAugments[2] || {}).length;

    if (p1Count < expectedCount) {
      if (!window.isMultiplayer && typeof updateAugmentSidebar === 'function') updateAugmentSidebar(1);
      showAugmentSelectionModal(1);
    } else if (p2Count < expectedCount) {
      if (!window.isMultiplayer && typeof updateAugmentSidebar === 'function') updateAugmentSidebar(2);
      showAugmentSelectionModal(2, () => {
        const modal = document.getElementById('augment-selection-modal');
        if (modal) modal.classList.add('hidden');
        if (typeof window.proceedTurnStart === 'function') window.proceedTurnStart();
      });
    } else {
      const modal = document.getElementById('augment-selection-modal');
      if (modal) {
        if (augmentTimerInterval) {
          clearInterval(augmentTimerInterval);
          augmentTimerInterval = null;
        }
        modal.classList.add('hidden');
      }
      if (!window.isMultiplayer && typeof updateAugmentSidebar === 'function') updateAugmentSidebar(currentPlayer);
      if (typeof window.proceedTurnStart === 'function') window.proceedTurnStart();
      if (typeof updateRollsUI === 'function') updateRollsUI();
    }
    return;
  }

  if (!window.isMultiplayer || Number(currentPlayer) === Number(window.myPlayerIndex)) return;

  if (data.type === 'sync_roll') {
    pauseTurnTimer();
    rollsLeft = data.rollsLeft;
    if (data.equivalentExchangeUses !== undefined) {
      equivalentExchangeUses[currentPlayer] = data.equivalentExchangeUses;
    }
    if (data.equivalentExchangePenalty !== undefined) {
      equivalentExchangePenalty[currentPlayer] = data.equivalentExchangePenalty;
    }
    updateRollsUI();
    clearScorePreviews();
    window.lastRollStartTime = Date.now();
    if (diceEngine) {
      diceEngine.ready.then(() => diceEngine.roll(data.specialConfigs, true, data.spawnTransforms));
    }
  } else if (data.type === 'sync_roll_end') {
    const elapsed = Date.now() - (window.lastRollStartTime || 0);
    const minAnimTime = 1100;
    const remainingDelay = Math.max(0, minAnimTime - elapsed);

    setTimeout(async () => {
      if (diceEngine) {
        await diceEngine.ready;
        diceEngine.forceRollEnd(data.finalValues, data.finalTransforms);
        diceEngine.diceArray.forEach(die => die.isKept = false);
        keptDice = [];
        activeDice = diceEngine.diceArray.filter(d => d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);
        diceEngine.arrangeAll(true);
        updateScorePreviews();
        resumeTurnTimer();
      }
    }, remainingDelay);
  } else if (data.type === 'sync_keep') {
    if (diceEngine) {
      const die = diceEngine.diceArray[data.dieIndex];
      if (die) {
        die.isKept = data.isKept;
        if (die.isKept) {
          const usedSlots = diceEngine.diceArray.filter(d => d.isKept && d !== die).map(d => d.keepSlot);
          let firstEmpty = 0;
          for (let i = 0; i < 5; i++) {
            if (!usedSlots.includes(i)) {
              firstEmpty = i;
              break;
            }
          }
          die.keepSlot = firstEmpty;
        } else {
          die.keepSlot = null;
        }
        diceEngine.arrangeAll(false, die);
        activeDice = diceEngine.diceArray.filter(d => !d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);
        keptDice = diceEngine.diceArray.filter(d => d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);
        updateScorePreviews();
      }
    }
  } else if (data.type === 'sync_score') {
    lockScore(data.catId, data.scoreInfo, true, data.force);
  } else if (data.type === 'sync_log') {
    // 턴 시작 및 게임 시작 로그는 각 클라이언트의 startTurn()에서 이미 로컬 출력하므로 중복 렌더링 차단
    if (data.logData?.type === 'turn-start' || data.logData?.message === '게임 시작!') {
      return;
    }
    addGameLog(data.logData, data.logType, false, data.player);
  }
});

networkEngine.on('full_game_sync', (data) => {
  if (!data || !data.sessionData) return;
  const sData = data.sessionData;

  if (data.players) window.lobbyPlayers = data.players;

  const myConnId = networkEngine.socket?.id;
  const myUid = getCurrentUser()?.uid;
  const me = window.lobbyPlayers?.find(p => p.connId === myConnId || (myUid && p.uid === myUid));
  if (me && window.lobbyPlayers) {
    window.myPlayerInfo = me;
    const idx = window.lobbyPlayers.indexOf(me);
    window.myPlayerIndex = idx >= 0 ? idx + 1 : (me.isHost ? 1 : 2);
  }

  if (sData.disconnectGrace) {
    for (let p = 1; p <= 4; p++) {
      if (sData.disconnectGrace[p] !== undefined) disconnectGrace[p] = sData.disconnectGrace[p];
    }
  }
  if (data.players) {
    data.players.forEach((p, idx) => {
      if (p.disconnected) handlePlayerDisconnect(p.playerIndex || (idx + 1));
    });
  }

  if (data.authoritativeState) {
    void applyAuthoritativeState(data.authoritativeState, { kind: 'full_game_sync' });
    return;
  }

  scores = sData.scores || { 1: {}, 2: {} };
  activeAugments = sData.activeAugments || { 1: {}, 2: {} };
  currentRound = sData.currentRound || 1;
  currentPlayer = sData.currentPlayer || 1;
  rollsLeft = sData.rollsLeft !== undefined ? sData.rollsLeft : 3;

  if (sData.matchLogHistory) {
    renderGameLogHistory(sData.matchLogHistory);
  }

  activeDice = sData.activeDice || [];
  keptDice = sData.keptDice || [];

  const allDiceValues = [...keptDice, ...activeDice];
  if (allDiceValues.length > 0 && diceEngine) {
    try {
      const keptIndexes = [];
      for (let k = 0; k < keptDice.length; k++) {
        keptIndexes.push(k);
      }
      diceEngine.forceValues(allDiceValues, keptIndexes);
    } catch (e) {
      console.error("Dice restore error on sync:", e);
    }
  }

  initScoreboard();
  updateScoreboard();
  updateScorePreviews();
  updateRollsUI();
  updateMatchProfiles();

  els.gameStatus.textContent = `P${currentPlayer}의 턴 (라운드 ${currentRound}/12)`;
  updateTurnHighlights();

  const isMyTurn = !window.isMultiplayer || currentPlayer === window.myPlayerIndex;
  if (diceBoxReady) {
    els.btnRoll.disabled = !isMyTurn || rollsLeft <= 0;
  }

  startTurnTimer(sData.turnTimeRemaining !== undefined ? sData.turnTimeRemaining : 45);
});

networkEngine.on('player_disconnected', (data) => {
  let pIndex = null;
  const searchPlayers = window.initialMatchPlayers || window.lobbyPlayers;
  if (searchPlayers) {
    const foundIdx = searchPlayers.findIndex(pl => pl.uid === data.uid || pl.connId === data.connId);
    if (foundIdx !== -1) {
      pIndex = foundIdx + 1;
    }
  }
  if (!pIndex && data.pIndex) {
    pIndex = Number(data.pIndex);
  }
  if (!pIndex) {
    pIndex = 1;
  }
  handlePlayerDisconnect(pIndex);
});

networkEngine.on('player_reconnected', (data) => {
  let pIndex = null;
  const searchPlayers = window.initialMatchPlayers || window.lobbyPlayers;
  if (searchPlayers) {
    const foundIdx = searchPlayers.findIndex(pl => pl.uid === data.uid || pl.connId === data.connId);
    if (foundIdx !== -1) {
      pIndex = foundIdx + 1;
    }
  }
  if (!pIndex && data.pIndex) {
    pIndex = Number(data.pIndex);
  }
  if (!pIndex) {
    pIndex = 1;
  }
  handlePlayerReconnect(pIndex);
});

function cleanUid(raw) {
  return normalizeUserUid(raw) || raw;
}


networkEngine.on('player_forfeited', (data) => {
  if (!els.appContainer?.classList.contains('playing-state')) {
    return;
  }

  let forfeitPIndex = null;
  const cleanSenderUid = cleanUid(data?.uid);

  const searchPlayers = (window.initialMatchPlayers && window.initialMatchPlayers.length > 0)
    ? window.initialMatchPlayers
    : (window.lobbyPlayers || []);

  if (Array.isArray(searchPlayers)) {
    const foundIdx = searchPlayers.findIndex(pl => {
      const plUid = cleanUid(pl?.uid);
      return (plUid && cleanSenderUid && plUid === cleanSenderUid) || (pl?.connId && data?.connId && pl.connId === data.connId);
    });
    if (foundIdx !== -1) {
      forfeitPIndex = foundIdx + 1;
    }
  }

  if (!forfeitPIndex && data?.pIndex) {
    forfeitPIndex = Number(data.pIndex);
  }

  if (!forfeitPIndex) {
    forfeitPIndex = 1;
  }

  handleGameForfeit(forfeitPIndex, data.uid);
  const user = getCurrentUser();
  if (user?.uid) {
    setTimeout(() => {
      refreshUserHistory(user.uid);
    }, 1500);
  }
});

networkEngine.on('game_already_ended', async (data) => {
  alert(data.message || '이미 완료되거나 종료된 게임 세션입니다.');
  const user = getCurrentUser();
  if (user?.uid) {
    await clearUserActiveGame(user.uid);
  }
  stopTurnTimer();
  networkEngine.disconnect();
  els.appContainer.className = 'mode-select-state';
});

uiEventControllers.modeSelection.bind(els.btnPlayNormalLobby, 'click', () => {
  showLobbySelect('normal');
});

uiEventControllers.modeSelection.bind(els.btnAugLobby, 'click', () => {
  showLobbySelect('augmented');
});

uiEventControllers.lobby.bind(els.btnLobbySelectBack, 'click', () => {
  els.appContainer.classList.remove('lobby-select-state');
  els.appContainer.classList.add('mode-select-state');
});

uiEventControllers.lobby.bind(els.btnLobbyCreate, 'click', () => {
  showLobby(true);
});

// 로비 참여 코드 클립보드 복사 버튼 이벤트
const btnCopyCode = document.getElementById('btn-copy-lobby-code');
uiEventControllers.lobby.bind(btnCopyCode, 'click', async () => {
  const codeDisplay = document.getElementById('lobby-code-display');
  const code = codeDisplay?.textContent?.trim();
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    btnCopyCode.classList.add('copied');
    btnCopyCode.innerHTML = `
      <svg class="copy-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      btnCopyCode.classList.remove('copied');
      btnCopyCode.innerHTML = `
        <svg class="copy-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
    }, 1500);
  } catch (err) {
    console.error("Copy failed:", err);
  }
});

uiEventControllers.lobby.bind(els.btnLobbyJoin, 'click', () => {
  const code = pinInputController.getCode();

  if (code.length !== 6) {
    showLobbyJoinError('6자리의 참여 코드를 정확히 입력해주세요.');
    return;
  }
  hideLobbyJoinError();
  lobbyController.beginJoin(code);
});

uiEventControllers.lobby.bind(els.btnLobbyBack, 'click', () => {
  networkEngine.disconnect();
  stopLobbyWaitingAnimation();
  pinInputController.reset();
  els.appContainer.classList.remove('lobby-state');
  els.appContainer.classList.add('lobby-select-state');
});

uiEventControllers.lobby.bind(els.btnLobbyStart, 'click', () => {
  const myConnId = networkEngine.socket?.id;
  // players를 직접 알 수는 없지만, UI 상태로 판단
  if (els.btnLobbyStart.textContent.includes('게임 시작')) {
    networkEngine.startGame();
  } else {
    window.isReady = !window.isReady;
    networkEngine.setReady(window.isReady);
  }
});

window.gameSessionStarted = false;

function isWaitingLobbyState() {
  return !window.gameSessionStarted || gameMode === 'none';
}

let forfeitedPlayers = { 1: false, 2: false, 3: false, 4: false };
let forfeitedPlayerUids = {};

function handleGameForfeit(forfeitedPlayerIndex, forfeitUid = null) {
  forfeitedPlayers[forfeitedPlayerIndex] = true;
  if (forfeitUid) {
    forfeitedPlayerUids[forfeitedPlayerIndex] = forfeitUid;
  }

  const boxElem = document.getElementById(`match-p${forfeitedPlayerIndex}-box`) || (forfeitedPlayerIndex === 1 ? document.getElementById('match-my-box') : null);
  if (boxElem) {
    const avatarContainer = boxElem.querySelector('.match-avatar-container');
    if (avatarContainer && !avatarContainer.querySelector('.forfeit-overlay')) {
      const flagOverlay = document.createElement('div');
      flagOverlay.className = 'disconnect-overlay forfeit-overlay';
      flagOverlay.innerHTML = getFlagIconSvg('forfeit-flag-svg', 26);
      avatarContainer.appendChild(flagOverlay);
    }
  }

  const totalCount = getActivePlayerCount();
  const activePlayers = [];
  for (let p = 1; p <= totalCount; p++) {
    if (!forfeitedPlayers[p]) {
      activePlayers.push(p);
    }
  }

  if (activePlayers.length >= 2) {
    if (currentPlayer === forfeitedPlayerIndex) {
      const nextP = activePlayers.find(p => p > currentPlayer) || activePlayers[0];
      currentPlayer = nextP;
      startTurn();
    }
  } else {
    const lastSurv = activePlayers[0] || 1;
    const winnerData = window.lobbyPlayers ? window.lobbyPlayers[lastSurv - 1] : null;
    const winnerName = winnerData ? winnerData.nickname : `Player ${lastSurv}`;

    stopTurnTimer();
    const winnerTitle = document.getElementById('endgame-winner');
    if (winnerTitle) {
      winnerTitle.textContent = `${winnerName} 몰수승!`;
    }
    endGame();
  }
}

function resetGameSession({ preservePendingAuthoritativeState = false } = {}) {
  stopTurnTimer();
  const retainedPendingState = preservePendingAuthoritativeState ? pendingAuthoritativeGameState : null;
  applySessionResetPlan(createSessionResetPlan());
  if (preservePendingAuthoritativeState) pendingAuthoritativeGameState = retainedPendingState;
  localRollToken++;
  clearDisconnectTimers();
  window.matchLogHistory = [];

  if (els.gameLogContainer) {
    els.gameLogContainer.innerHTML = '<div class="log-empty-text">게임 로그가 없습니다.</div>';
  }

  if (typeof updateScoreboard === 'function') {
    updateScoreboard();
  }

  [els.matchP1Box, els.matchP2Box].forEach(box => {
    if (box) {
      const avatarContainer = box.querySelector('.match-avatar-container');
      if (avatarContainer) {
        avatarContainer.classList.remove('disconnected');
        const flagOverlay = avatarContainer.querySelector('.forfeit-overlay');
        if (flagOverlay) flagOverlay.remove();
      }
    }
  });

  if (els.matchP1Disconnect) els.matchP1Disconnect.classList.add('hidden');
  if (els.matchP2Disconnect) els.matchP2Disconnect.classList.add('hidden');

  if (els.matchP1Name) els.matchP1Name.textContent = "Player 1";
  if (els.matchP2Name) els.matchP2Name.textContent = "Player 2";
  if (els.matchP1Avatar) els.matchP1Avatar.style.backgroundImage = 'none';
  if (els.matchP2Avatar) els.matchP2Avatar.style.backgroundImage = 'none';

  if (els.p1Name) {
    const textEl = els.p1Name.querySelector('.name-text');
    if (textEl) textEl.textContent = "Player 1";
    else els.p1Name.textContent = "Player 1";
  }
  if (els.p2Name) {
    const textEl = els.p2Name.querySelector('.name-text');
    if (textEl) textEl.textContent = "Player 2";
    else els.p2Name.textContent = "Player 2";
  }

  initScoreboard();
  updateScoreboard();
  updateTurnTimerUI();

  if (typeof diceEngine !== 'undefined' && diceEngine) {
    diceEngine.diceArray.forEach(die => die.isKept = false);
    diceEngine.arrangeAll(true);
    diceEngine.allowKeep = true;
  }
}

function startHotseatGame(mode = 'hotseat') {
  resetGameSession();
  window.gameSessionStarted = true;
  window.isMultiplayer = false;
  gameMode = mode;
  window.lobbyPlayers = null;
  window.myPlayerInfo = null;

  updateMatchProfiles();
  startTurn();
}

function updateTurnHighlights() {
  const count = getActivePlayerCount();
  const myP = window.myPlayerIndex || 1;
  const isMyTurn = (currentPlayer === myP);

  const myBox = document.getElementById('match-my-box');
  const myName = document.getElementById('match-my-name');

  if (myBox) myBox.classList.toggle('active-turn', isMyTurn);
  if (myName) myName.classList.toggle('active-turn', isMyTurn);

  for (let p = 1; p <= count; p++) {
    const isCurrent = (p === currentPlayer);
    const oppBox = document.getElementById(`match-p${p}-box`);
    const oppName = document.getElementById(`match-p${p}-name`);

    if (oppBox) oppBox.classList.toggle('active-turn', isCurrent);
    if (oppName) oppName.classList.toggle('active-turn', isCurrent);
  }

  // 프로필 아바타 초록 글로우: data-player-index 매칭으로 100% 정확하게 단 1개만 활성화!
  const allAvatarElems = document.querySelectorAll('.match-avatar-container, .match-avatar');
  allAvatarElems.forEach(elem => {
    const pIdxStr = elem.getAttribute('data-player-index');
    if (pIdxStr) {
      const pIdx = Number(pIdxStr);
      elem.classList.toggle('turn-active-glow', pIdx === currentPlayer);
    }
  });

  if (els.p1Name) els.p1Name.classList.toggle('active-turn', currentPlayer === 1);
  if (els.p2Name) els.p2Name.classList.toggle('active-turn', currentPlayer === 2);
  if (els.p1Profile) els.p1Profile.classList.toggle('active-turn', currentPlayer === 1);
  if (els.p2Profile) els.p2Profile.classList.toggle('active-turn', currentPlayer === 2);
}

function updateMatchProfiles() {
  const myBoxName = document.getElementById('match-my-name');
  const myBoxAvatar = document.getElementById('match-my-avatar');
  const oppContainer = document.getElementById('match-opponents-container');

  const myConnId = networkEngine.socket?.id;
  const myUid = getCurrentUser()?.uid;
  const players = (window.initialMatchPlayers && window.initialMatchPlayers.length > 0)
    ? window.initialMatchPlayers
    : (window.lobbyPlayers || []);

  const getPIndex = (pObj, fallbackIdx) => {
    if (!pObj) return fallbackIdx;
    if (pObj.playerIndex) return Number(pObj.playerIndex);
    const idx = players.indexOf(pObj);
    return idx >= 0 ? idx + 1 : fallbackIdx;
  };

  let me = players.find(p => p.connId === myConnId || (myUid && p.uid === myUid)) || players[0];
  let opponents = players.filter(p => p !== me);

  if (!me) {
    me = { nickname: "Player (Me)", avatarUrl: null };
  }
  if (opponents.length === 0) {
    opponents = [{ nickname: "Player 2", avatarUrl: null }];
  }

  const myP = me ? getPIndex(me, window.myPlayerIndex || 1) : (window.myPlayerIndex || 1);

  if (myBoxName) myBoxName.textContent = me.nickname || "Player (Me)";
  if (myBoxAvatar) {
    if (me.avatarUrl) {
      myBoxAvatar.style.backgroundImage = `url('${me.avatarUrl}')`;
      myBoxAvatar.style.backgroundSize = 'cover';
    } else {
      myBoxAvatar.style.backgroundImage = '';
      myBoxAvatar.style.backgroundSize = '';
    }
    myBoxAvatar.setAttribute('data-player-index', myP);
    if (myBoxAvatar.parentElement) {
      myBoxAvatar.parentElement.setAttribute('data-player-index', myP);
    }
  }

  if (oppContainer) {
    oppContainer.innerHTML = '';
    // 상대방을 playerIndex 순서대로 정렬
    opponents.sort((a, b) => getPIndex(a, 99) - getPIndex(b, 99));

    opponents.forEach((opp, idx) => {
      const oppIdx = getPIndex(opp, idx + 2);
      const isCurrentTurn = (oppIdx === currentPlayer);
      const oppBox = document.createElement('div');
      oppBox.className = `match-player-box ${isCurrentTurn ? 'active-turn' : ''}`;
      oppBox.id = `match-p${oppIdx}-box`;

      const avStyle = opp.avatarUrl ? `background-image: url('${opp.avatarUrl}'); background-size: cover;` : '';
      oppBox.innerHTML = `
        <div class="match-avatar-container" data-player-index="${oppIdx}" style="position: relative; display: inline-block;">
          <div class="match-avatar" id="match-p${oppIdx}-avatar" data-player-index="${oppIdx}" style="${avStyle}"></div>
          <div class="disconnect-overlay hidden" id="match-p${oppIdx}-disconnect">
            <svg class="unplug-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible;">
              <path d="m19 5 3-3"></path>
              <path d="m2 22 3-3"></path>
              <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"></path>
              <path d="M7.5 13.5 10 11"></path>
              <path d="M10.5 16.5 13 14"></path>
              <path d="m17.7 3.7-2.3 2.3 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"></path>
            </svg>
            <span class="disconnect-timer-text" id="match-p${oppIdx}-disconnect-timer">60s</span>
          </div>
        </div>
        <div class="match-nickname ${isCurrentTurn ? 'active-turn' : ''}" id="match-p${oppIdx}-name">${opp.nickname || `Player ${oppIdx}`}</div>
      `;
      oppContainer.appendChild(oppBox);
    });
  }

  updateTurnHighlights();
}

function startMultiplayerGame() {
  resetGameSession({ preservePendingAuthoritativeState: true });
  window.gameSessionStarted = true;
  window.isMultiplayer = true;
  authoritativeGameState = pendingAuthoritativeGameState;
  pendingAuthoritativeGameState = null;

  if (window.lobbyPlayers && Array.isArray(window.lobbyPlayers)) {
    window.initialMatchPlayers = JSON.parse(JSON.stringify(window.lobbyPlayers));
    window.initialMatchPlayers.forEach((p, idx) => {
      if (!p.playerIndex) p.playerIndex = idx + 1;
    });
  }

  if (window.lobbyPlayers && window.myPlayerInfo) {
    const myConnId = networkEngine.socket?.id;
    const myUid = getCurrentUser()?.uid;
    const found = window.lobbyPlayers.find(p => p.connId === myConnId || (myUid && p.uid === myUid));
    if (found && found.playerIndex) {
      window.myPlayerIndex = Number(found.playerIndex);
    } else {
      const idx = window.lobbyPlayers.indexOf(window.myPlayerInfo);
      window.myPlayerIndex = idx >= 0 ? idx + 1 : (window.myPlayerInfo.playerIndex || (window.myPlayerInfo.isHost ? 1 : 2));
    }
  } else {
    window.myPlayerIndex = window.myPlayerInfo?.playerIndex || (window.myPlayerInfo?.isHost ? 1 : 2);
  }

  currentPlayer = 1;
  currentRound = 1;
  const hotseatState = createLocalGameState(2);
  scores = hotseatState.scores;
  activeAugments = hotseatState.activeAugments;
  upperBonusThreshold = hotseatState.upperBonusThreshold;
  globalBonus = hotseatState.globalBonus;
  draftSelections = hotseatState.draftSelections;
  destroyedStrangeDice = hotseatState.destroyedStrangeDice;
  promotionConsumed = hotseatState.promotionConsumed;
  playerTableFlipUsed = hotseatState.playerTableFlipUsed;

  const isNormalMode = window.pendingLobbyMode === 'normal';
  gameMode = isNormalMode ? 'normal' : 'augmented';
  if (gameMode === 'augmented') {
    augmentProgressSession = createAugmentProgressSession();
  }

  initScoreboard();
  updateScoreboard();

  const user = getCurrentUser();
  const roomCode = els.lobbyCodeDisplay?.textContent?.trim() || networkEngine.roomCode || window.currentRoomCode;
  if (user?.uid && roomCode) {
    updateUserActiveGame(user.uid, roomCode, gameMode);
  }

  if (gameMode === 'normal') {
    showMatchInfo();
  } else {
    showAugment();
  }

  updateMatchProfiles();

  // 게임 로그 초기화
  if (els.gameLogContainer) {
    els.gameLogContainer.innerHTML = '';
  }

  updateScoreboard();
  if (isAuthoritativeOnlineMatch()) {
    stopTurnTimer();
    void applyAuthoritativeState(authoritativeGameState, { kind: 'game_started' });
    els.btnRoll.disabled = true;
    return;
  }
  startTurn();
}

function renderAuthoritativeDraft(command) {
  const modal = document.getElementById('augment-selection-modal');
  if (!modal) return;
  if (!command.visible) {
    modal.classList.add('hidden');
    return;
  }

  if (augmentTimerInterval) {
    clearInterval(augmentTimerInterval);
    augmentTimerInterval = null;
  }
  const title = document.getElementById('augment-modal-title');
  const optionsContainer = document.getElementById('augment-options');
  const timerText = document.getElementById('augment-timer-text');
  if (title) title.textContent = command.title;
  if (timerText) timerText.textContent = command.timerText;
  if (!optionsContainer) return;

  optionsContainer.innerHTML = '';
  optionsContainer.style.pointerEvents = command.isMine ? 'auto' : 'none';
  command.optionIds.forEach((augmentId) => {
    const augment = augmentData.find((item) => item.augmentId === augmentId);
    if (!augment) return;
    const option = document.createElement('div');
    option.className = `augment-option${command.isMine ? '' : ' disabled-option'}`;
    option.innerHTML = `
      <div class="modal-compendium-type-text">${getAugmentCategoryEnName(augment)}</div>
      <div class="aug-slot-header">${getVariantSvg(augmentId) || ''} <span class="aug-slot-name">${augment.name}</span></div>
      <div class="aug-slot-desc">${augment.description || ''}</div>
    `;
    if (command.isMine) {
      option.addEventListener('click', () => {
        optionsContainer.style.pointerEvents = 'none';
        option.classList.add('selected');
        networkEngine.sendMessage({ type: 'game_select_augment', augmentId });
      });
    }
    optionsContainer.appendChild(option);
  });
  modal.classList.remove('hidden');
}

const appliedAuthoritativeAnimations = new Set();

async function renderAuthoritativeDice(command) {
  if (!diceEngine) return;
  if (command.strategy === 'skip') return;
  if (command.strategy === 'keep-or-force') {
    if (diceEngine.applyServerKeep(command.dieId, command.isKept)) return;
    diceEngine.forceDiceState(command.dice);
    return;
  }
  if (command.strategy === 'force') {
    if (command.warnMissingRollData) console.warn('[online] No roll data available, forcing dice state');
    diceEngine.forceDiceState(command.dice);
    return;
  }

  try {
    const waitMs = Number.isFinite(command.animationStartAt)
      ? Math.max(0, command.animationStartAt - Date.now())
      : 0;
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (authoritativeGameState?.revision !== command.revision) return;
    soundEngine.playSFX('dice_roll');
    const replayed = await diceEngine.rollWithTargetValues(
      command.configs,
      command.orderedTargets,
      command.animation,
      { isFlip: command.isFlip, elapsedMs: 0 }
    );
    if (authoritativeGameState?.revision !== command.revision) return;
    if (!replayed) {
      diceEngine.forceDiceState(command.dice);
      return;
    }
    await diceEngine.completeAuthoritativeRoll(command.dice, 500);
  } catch (error) {
    if (authoritativeGameState?.revision !== command.revision) return;
    console.warn('[online] Authoritative roll failed, falling back to forceDiceState', error);
    diceEngine.forceDiceState(command.dice);
  }
}

let authoritativeApplyQueue = Promise.resolve();
let lastAuthoritativeActionRevision = 0;

function getAuthoritativeRuntimeState() {
  return {
    authoritativeGameState,
    scores,
    activeAugments,
    currentRound,
    currentPlayer,
    rollsLeft,
    extraTurns,
    isExtraTurnPhase,
    upperBonusThreshold,
    yachtBankState,
    destroyedStrangeDice,
    promotionConsumed,
    promotionAcquiredRound,
    playerTableFlipUsed,
    equivalentExchangeUses,
    equivalentExchangePenalty,
    equivalentExchangeTurnUses,
    questProgress,
    globalBonus,
    momentumState,
    bountyHunterTarget,
    bountyHunterAcquiredRound,
    bountyHunterProgress,
    keptDice,
    activeDice
  };
}

function applyAuthoritativeStatePatch(patch) {
  if ('authoritativeGameState' in patch) authoritativeGameState = patch.authoritativeGameState;
  if ('scores' in patch) scores = patch.scores;
  if ('activeAugments' in patch) activeAugments = patch.activeAugments;
  if ('currentRound' in patch) currentRound = patch.currentRound;
  if ('currentPlayer' in patch) currentPlayer = patch.currentPlayer;
  if ('rollsLeft' in patch) rollsLeft = patch.rollsLeft;
  if ('extraTurns' in patch) extraTurns = patch.extraTurns;
  if ('isExtraTurnPhase' in patch) isExtraTurnPhase = patch.isExtraTurnPhase;
  if ('upperBonusThreshold' in patch) upperBonusThreshold = patch.upperBonusThreshold;
  if ('yachtBankState' in patch) yachtBankState = patch.yachtBankState;
  if ('destroyedStrangeDice' in patch) destroyedStrangeDice = patch.destroyedStrangeDice;
  if ('promotionConsumed' in patch) promotionConsumed = patch.promotionConsumed;
  if ('promotionAcquiredRound' in patch) promotionAcquiredRound = patch.promotionAcquiredRound;
  if ('playerTableFlipUsed' in patch) playerTableFlipUsed = patch.playerTableFlipUsed;
  if ('equivalentExchangeUses' in patch) equivalentExchangeUses = patch.equivalentExchangeUses;
  if ('equivalentExchangePenalty' in patch) equivalentExchangePenalty = patch.equivalentExchangePenalty;
  if ('equivalentExchangeTurnUses' in patch) equivalentExchangeTurnUses = patch.equivalentExchangeTurnUses;
  if ('questProgress' in patch) questProgress = patch.questProgress;
  if ('globalBonus' in patch) globalBonus = patch.globalBonus;
  if ('momentumState' in patch) momentumState = patch.momentumState;
  if ('bountyHunterTarget' in patch) bountyHunterTarget = patch.bountyHunterTarget;
  if ('bountyHunterAcquiredRound' in patch) bountyHunterAcquiredRound = patch.bountyHunterAcquiredRound;
  if ('bountyHunterProgress' in patch) bountyHunterProgress = patch.bountyHunterProgress;
  if ('keptDice' in patch) keptDice = patch.keptDice;
  if ('activeDice' in patch) activeDice = patch.activeDice;
}

function applyAuthoritativeBrowserEffect(command) {
  switch (command.type) {
    case 'stop-turn-timer':
      stopTurnTimer();
      break;
    case 'set-turn-time-remaining':
      turnTimer.setRemaining(command.seconds);
      break;
    case 'render-authoritative-draft':
      renderAuthoritativeDraft(command);
      break;
    case 'refresh-scoreboard':
      updateScoreboard();
      break;
    case 'refresh-match-profiles':
      updateMatchProfiles();
      break;
    case 'refresh-turn-ui':
      updateTurnHighlights();
      updateAugmentSidebar?.(currentPlayer);
      updateTurnTimerUI();
      break;
    case 'set-game-status':
      els.gameStatus.textContent = command.text;
      break;
    case 'set-roll-disabled':
      els.btnRoll.disabled = command.disabled;
      break;
    case 'refresh-score-previews':
      updateScorePreviews();
      break;
    case 'clear-score-previews':
      clearScorePreviews();
      break;
    case 'refresh-rolls-ui':
      updateRollsUI();
      break;
    case 'start-bgm':
      soundEngine.startBGM(command.elapsedSeconds);
      break;
    case 'end-game':
      endGame(command.authoritative);
      break;
  }
}

async function applyAuthoritativeState(state, action = null) {
  const previousState = authoritativeGameState;
  const plan = createAuthoritativeStatePlan({
    previousState,
    state,
    action,
    runtimeState: getAuthoritativeRuntimeState(),
    lastActionRevision: lastAuthoritativeActionRevision,
    appliedAnimationIds: [...appliedAuthoritativeAnimations],
    localPlayerIndex: window.myPlayerIndex,
    turnDurationSeconds: TURN_DURATION_SECONDS
  });
  applyAuthoritativeStatePatch(plan.statePatch);
  plan.beforeDiceEffects.forEach(applyAuthoritativeBrowserEffect);

  if (diceEngine) {
    appliedAuthoritativeAnimations.clear();
    plan.nextAnimationIds.forEach((animationId) => appliedAuthoritativeAnimations.add(animationId));
  }
  await renderAuthoritativeDice(plan.diceEffect);
  if (authoritativeGameState?.revision !== plan.revision) return;

  const actionEffect = plan.afterDiceEffects.find((command) => command.type === 'apply-authoritative-action');
  if (actionEffect) {
    action = actionEffect.action;
    lastAuthoritativeActionRevision = plan.nextLastActionRevision;
    if (action.kind === 'game_roll' || action.kind === 'game_table_flip') {
      addGameLog({ type: 'roll-result', player: action.player, meta: { values: state.dice.filter((die) => !die.kept).map((die) => die.value) } }, 'roll-result', false, action.player);
      if (action.kind === 'game_table_flip' && isLocalAugmentProgressPlayer(action.player)) {
        const achievementState = augmentProgressSession.achievementState;
        achievementState.tableFlipDiceCount = (previousState?.dice || []).filter((die) => !die.kept).length;
        achievementState.flags.tableFlipLateBehind = Number(previousState?.currentRound) >= 9 && Boolean(achievementState.flags.tableFlipBehindAtRound9);
      }
    } else if (action.kind === 'game_score') {
      const score = state.scores?.[action.player]?.[action.catId];
      const value = typeof score === 'object' ? score.score : score;
      addGameLog({ type: 'score-record', player: action.player, meta: { catId: action.catId, score: value } }, 'score-record', false, action.player);
      if (isLocalAugmentProgressPlayer(action.player)) {
        const player = Number(action.player);
        const scoreObj = typeof score === 'object' ? score : { score: Number(score) || 0, bonus: 0, bonusDetails: [] };
        const dice = (previousState?.dice || []).filter((die) => die.type !== 'weird');
        const augments = Object.values(previousState?.activeAugments?.[player] || state.activeAugments?.[player] || {}).filter(Boolean);
        recordScoreAchievementEvent(augmentProgressSession, {
          augmentIds: augments,
          categoryAugmentId: previousState?.activeAugments?.[player]?.[action.catId] || state.activeAugments?.[player]?.[action.catId] || null,
          categoryId: action.catId,
          diceValues: dice.map((die) => Number(die.value)),
          round: Number(previousState?.currentRound) || Number(state.currentRound),
          rollsLeft: Number(previousState?.rollsLeft),
          score: Number(scoreObj.score) || 0,
          goldenBonus: dice.some((die) => die.type === 'golden' && [1, 2, 3].includes(Number(die.value))),
          tableFlipDiceCount: augmentProgressSession.achievementState.tableFlipDiceCount || 0,
          equivalentExchangeUses: Number(previousState?.equivalentExchangeTurnUses?.[player]) || 0
        });

        const flags = augmentProgressSession.achievementState.flags;
        const previousQuest = previousState?.questProgress?.[player] || {};
        const nextQuest = state.questProgress?.[player] || {};
        const playerScores = state.scores?.[player] || {};
        const upperSum = ['aces', 'deuces', 'threes', 'fours', 'fives', 'sixes'].reduce((total, category) => {
          const entry = playerScores[category];
          return total + (typeof entry === 'object' ? Number(entry?.score) || 0 : Number(entry) || 0);
        }, 0);

        if (augments.includes('fast-straight') && !previousQuest.fastStraightRewarded && nextQuest.fastStraightRewarded && Number(previousState?.currentRound) <= 6) {
          recordAchievementProgress(augmentProgressSession, 'fast-straight-speed');
        }
        if (augments.includes('no-time-to-waste') && !nextQuest.noTimeRewarded) {
          if (Number(previousState?.rollsLeft) === 2 && Number(scoreObj.score) >= 15) flags.noTimeHighScoreCount = (flags.noTimeHighScoreCount || 0) + 1;
          else flags.noTimeHighScoreFailed = true;
        }
        if (augments.includes('no-time-to-waste') && !previousQuest.noTimeRewarded && nextQuest.noTimeRewarded && !flags.noTimeHighScoreFailed && flags.noTimeHighScoreCount >= 3) {
          recordAchievementProgress(augmentProgressSession, 'no-time-to-waste-careful');
        }
        if (augments.includes('step-by-step') && nextQuest.stepRewarded && upperSum >= Number(state.upperBonusThreshold?.[player] || 63) && !flags.stepUpperBonus) {
          flags.stepUpperBonus = true;
          recordAchievementProgress(augmentProgressSession, 'step-by-step-perfect-plan');
        }
        if (augments.includes('two-households') && action.catId === 'choice' && Number(scoreObj.score) >= 20) flags.twoHouseholdsChoiceAtLeast20 = true;
        if (augments.includes('two-households') && !previousQuest.twoHouseholdsRewarded && nextQuest.twoHouseholdsRewarded && flags.twoHouseholdsChoiceAtLeast20) {
          recordAchievementProgress(augmentProgressSession, 'two-households-clone');
        }
        if (augments.includes('holdout') && !previousQuest.holdoutRewarded && nextQuest.holdoutRewarded && Number(previousState?.currentRound) === 12) flags.holdoutTurn12 = true;
        if (augments.includes('copycat') && !previousQuest.copycatRewarded && nextQuest.copycatRewarded) {
          const opponents = Object.keys(state.scores || {}).filter((key) => Number(key) !== player);
          const copied = opponents.some((key) => {
            const opponent = state.scores?.[key]?.[action.catId];
            const opponentScore = typeof opponent === 'object' ? Number(opponent?.score) : Number(opponent);
            return Number(scoreObj.score) > 0 && opponentScore === Number(scoreObj.score);
          });
          if (copied) recordAchievementProgress(augmentProgressSession, 'copycat-perfect');
        }
        if (augments.includes('doubling') && !previousQuest.doublingRewarded && nextQuest.doublingRewarded) {
          const highCounts = Object.values(playerScores).reduce((counts, entry) => {
            const points = typeof entry === 'object' ? Number(entry?.score) : Number(entry);
            if (points >= 20) counts[points] = (counts[points] || 0) + 1;
            return counts;
          }, {});
          if (Object.values(highCounts).some((count) => count >= 2)) recordAchievementProgress(augmentProgressSession, 'doubling-echo');
        }
        if (augments.includes('nozdormu') && !previousQuest.nozdormuRewarded && nextQuest.nozdormuRewarded && !flags.nozdormuScratched) {
          recordAchievementProgress(augmentProgressSession, 'nozdormu-no-scratch');
        }
        if (augments.includes('double-large-straight') && upperSum >= 60 && !flags.doubleLargeUpperBonus) {
          flags.doubleLargeUpperBonus = true;
          recordAchievementProgress(augmentProgressSession, 'double-large-straight-upper-bonus');
        }
        if (augments.includes('bounty-hunter') && Number(scoreObj.score) >= 20 && previousState?.bountyHunterTarget?.[player] === action.catId && Number(previousState?.currentRound) - Number(previousState?.bountyHunterAcquiredRound?.[player] || previousState?.currentRound) < 3) {
          recordAchievementProgress(augmentProgressSession, 'bounty-hunter-legendary-killer');
        }
        if ((Number(previousState?.bountyHunterProgress?.[player]?.count) || 0) < 3 && (Number(state.bountyHunterProgress?.[player]?.count) || 0) >= 3) flags.bountyCompleted = true;
        if (!previousState?.promotionConsumed?.[player] && state.promotionConsumed?.[player]) recordAchievementProgress(augmentProgressSession, 'promotion-die-rank-seven');
        if (!previousState?.yachtBankState?.[player]?.completed && state.yachtBankState?.[player]?.completed && Math.min(Number(state.yachtBankState?.[player]?.accumulatedScore) || 0, 15) === 15) {
          recordAchievementProgress(augmentProgressSession, 'yacht-bank-thrifty');
        }
        if (previousState?.momentumState?.[player] !== 'used' && state.momentumState?.[player] === 'used') {
          flags.momentumTriggered = true;
          const totalScore = (Number(scoreObj.score) || 0) + (Number(scoreObj.bonus) || 0);
          if (totalScore >= 30) recordAchievementProgress(augmentProgressSession, 'momentum-comeback');
        }
      }
    } else if (action.kind === 'game_select_augment') {
      addGameLog({ type: 'augment-action', player: action.player, meta: { augmentId: action.augmentId } }, 'augment-action', false, action.player);
    } else if (action.kind === 'game_augment_action') {
      addGameLog({ type: 'augment-action', player: action.player, meta: { augmentId: action.augmentId } }, 'augment-action', false, action.player);
    } else if (action.kind === 'timeout') {
      addGameLog({ type: 'timeout', player: action.player, meta: { catId: action.catId, score: action.score ?? 0 } }, 'timeout', false, action.player);
    }
  }
  const turnStartEffect = plan.afterDiceEffects.find((command) => command.type === 'announce-turn-start');
  if (turnStartEffect) {
    addGameLog({ type: 'turn-start', player: turnStartEffect.player, round: turnStartEffect.round }, 'turn-start', false, turnStartEffect.player);
    if (Number(turnStartEffect.player) === Number(window.myPlayerIndex)) soundEngine.playSFX('turn_change');
    if (isLocalAugmentProgressPlayer(turnStartEffect.player) && Number(turnStartEffect.round) === 9 && getPlayerAugments(Number(turnStartEffect.player)).includes('table-flip')) {
      const totalOf = (player) => Object.values(state.scores?.[player] || {}).reduce((total, entry) =>
        total + (typeof entry === 'object' ? (Number(entry?.score) || 0) + (Number(entry?.bonus) || 0) : Number(entry) || 0), 0
      ) + (Number(state.questProgress?.[player]?.questBonus) || 0)
        + (Number(state.globalBonus?.[player]) || 0);
      const myTotal = totalOf(Number(turnStartEffect.player));
      augmentProgressSession.achievementState.flags.tableFlipBehindAtRound9 = Object.keys(state.scores || {})
        .some((player) => Number(player) !== Number(turnStartEffect.player) && totalOf(player) > myTotal);
    }
  }
  const scoreGraceEffect = plan.afterDiceEffects.find((command) => command.type === 'schedule-score-grace');
  if (scoreGraceEffect) {
    setTimeout(() => {
      if (authoritativeGameState?.revision !== scoreGraceEffect.revision) return;
      updateTurnHighlights();
      updateAugmentSidebar?.(currentPlayer);
      updateTurnTimerUI();
      if (scoreGraceEffect.player) {
        addGameLog({ type: 'turn-start', player: scoreGraceEffect.player, round: scoreGraceEffect.round }, 'turn-start', false, scoreGraceEffect.player);
        if (Number(scoreGraceEffect.player) === Number(window.myPlayerIndex)) soundEngine.playSFX('turn_change');
      }
    }, scoreGraceEffect.delayMs);
  }

  plan.afterDiceEffects
    .filter((command) => ![
      'apply-authoritative-action',
      'announce-turn-start',
      'schedule-score-grace'
    ].includes(command.type))
    .forEach(applyAuthoritativeBrowserEffect);
}

let augmentTimerInterval = null;

function getSeededAugments(round, player) {
  const isHotseat = gameMode === 'hotseat' || gameMode === 'augmented-hotseat';
  const roomCode = els.lobbyCodeDisplay?.textContent?.trim() || networkEngine.roomCode || window.currentRoomCode || 'DEFAULT';
  return getSeededAugmentsFromPool({
    augmentData,
    round,
    player,
    ownedAugmentIds: getPlayerAugments(player),
    scores,
    isHotseat,
    roomCode,
    canAcquireAugment,
    cryptoProvider: typeof window !== 'undefined' ? window.crypto : undefined
  });
}

function showAugmentSelectionModal(player, onSelect) {
  pauseTurnTimer();
  const modal = document.getElementById('augment-selection-modal');
  const title = document.getElementById('augment-modal-title');
  const optionsContainer = document.getElementById('augment-options');
  const timerElem = document.getElementById('augment-timer');
  const timerText = document.getElementById('augment-timer-text');

  if (!modal || !title || !optionsContainer) return;

  // 증강 선택 중에는 메인 턴 타이머를 정지하고 -- (모래시계 멈춤) 상태로 변경
  stopTurnTimer();
  const mainTimerElem = document.getElementById('turn-timer') || els.turnTimer;
  const mainTimerText = document.getElementById('turn-timer-text');
  if (mainTimerText) mainTimerText.textContent = '--';
  if (mainTimerElem) {
    mainTimerElem.classList.add('paused');
    mainTimerElem.classList.remove('warning');
  }

  if (augmentTimerInterval) {
    clearInterval(augmentTimerInterval);
    augmentTimerInterval = null;
  }

  const isMyTurn = !window.isMultiplayer || player === window.myPlayerIndex;
  title.textContent = isMyTurn ? `Player ${player} 증강 선택` : `Player ${player} 증강 선택 중...`;
  optionsContainer.innerHTML = '';
  optionsContainer.style.pointerEvents = 'auto';

  let timeLeft = 30;
  if (timerText) timerText.textContent = `${timeLeft}s`;
  if (timerElem) {
    timerElem.classList.remove('warning', 'paused');
  }

  const selectedAugments = getSeededAugments(typeof currentRound !== 'undefined' ? currentRound : 1, player);
  if (isMyTurn && window.isMultiplayer && gameMode === 'augmented') {
    recordAugmentOffer(
      augmentProgressSession,
      selectedAugments.map(aug => aug.augmentId),
      `${currentRound}:${player}`
    );
  }

  let isSelecting = false;
  let selectionCommitted = false;
  const cleanupAndSelect = (aug) => {
    if (selectionCommitted) return;
    selectionCommitted = true;
    if (augmentTimerInterval) {
      clearInterval(augmentTimerInterval);
      augmentTimerInterval = null;
    }
    modal.classList.add('hidden');
    if (isMyTurn && window.isMultiplayer && gameMode === 'augmented') {
      recordAugmentSelection(augmentProgressSession, aug.augmentId);
    }
    if (window.applyAugment) window.applyAugment(player, aug.augmentId);
    draftSelections[player] = (draftSelections[player] || 0) + 1;
    if (onSelect) {
      onSelect();
    }
  };

  selectedAugments.forEach((aug, idx) => {
    const btn = document.createElement('div');
    btn.className = 'augment-option' + (!isMyTurn ? ' disabled-option' : '');
    let desc = aug.description || aug.name + ' 증강이 적용됩니다.';

    const catEnName = getAugmentCategoryEnName(aug);
    const icon = getVariantSvg(aug.augmentId) || '';
    btn.innerHTML = `
      <div class="modal-compendium-type-text">${catEnName}</div>
      <div class="aug-slot-header">${icon} <span class="aug-slot-name">${aug.name}</span></div>
      <div class="aug-slot-desc">${desc}</div>
    `;

    if (isMyTurn) {
      btn.addEventListener('click', () => {
        if (isSelecting) return;
        isSelecting = true;
        optionsContainer.style.pointerEvents = 'none';
        btn.classList.add('selected');

        if (window.isMultiplayer && networkEngine) {
          networkEngine.sendMessage({
            type: 'augment_selecting',
            player,
            optionIndex: idx,
            augmentId: aug.augmentId
          });
        }

        setTimeout(() => {
          cleanupAndSelect(aug);
        }, 500);
      });
    }
    optionsContainer.appendChild(btn);
  });

  augmentTimerInterval = setInterval(() => {
    timeLeft--;
    if (timerText) timerText.textContent = `${timeLeft}s`;
    if (timerElem) {
      if (timeLeft <= 10) timerElem.classList.add('warning');
      else timerElem.classList.remove('warning');
    }

    if (timeLeft <= 0) {
      clearInterval(augmentTimerInterval);
      augmentTimerInterval = null;
      if (isMyTurn) {
        const autoPick = selectedAugments[Math.floor(Math.random() * selectedAugments.length)];
        cleanupAndSelect(autoPick);
      }
    }
  }, 1000);

  modal.classList.remove('hidden');
}

// === 턴 타임아웃 46초(45.99초 유예값) 제어 시스템 ===
// Turn timing state is owned by game/client/turnTimer.js.

function startTurnTimer(overrideTime = null) {
  turnTimer.start(overrideTime);
}

function stopTurnTimer() {
  turnTimer.stop();
}

function pauseTurnTimer() {
  turnTimer.pause();
}

function resumeTurnTimer() {
  turnTimer.resume();
}

function updateTurnTimerUI() {
  turnTimer.updateUI();
}

async function handleTurnTimeout() {
  const isMyTurn = !window.isMultiplayer || currentPlayer === window.myPlayerIndex;
  const isCurrentPlayerDisconnected = Boolean(disconnectTimers[currentPlayer]);

  // 내 턴도 아니고, 턴 주인이 끊긴 상태도 아니라면 자동 타임아웃 족보 기입 무시
  if (!isMyTurn && !isCurrentPlayerDisconnected) return;

  const timeoutDicePlan = createTimeoutDicePlan({
    rollsLeft,
    keptDice,
    activeDice,
    fallbackDice: diceEngine?.diceArray?.map((die) => die.value) || []
  });
  const dice5 = timeoutDicePlan.diceValues;
  if (timeoutDicePlan.shouldResetDice) {
    // 한 번도 주사위를 굴리지 않은 상태에서 타임아웃된 경우
    // 주사위 눈의 합계를 0으로 취급
    keptDice = [];
    activeDice = [];
    if (diceEngine) {
      diceEngine.diceArray.forEach(die => die.isKept = false);
      diceEngine.arrangeAll(true);
    }
  }

  const fullDiceObjects = diceEngine?.diceArray ? diceEngine.diceArray.map(d => ({ value: d.value, type: d.config.type })) : [];
  const potentialScores = typeof calculateScores === 'function' ? calculateScores(dice5, activeAugments[currentPlayer] || {}, { bank: (yachtBankState[currentPlayer]?.accumulatedScore || 0), fullDice: fullDiceObjects }) : {};
  const bestScore = selectBestTimeoutScore({
    categoryIds: SCORE_CATEGORIES,
    recordedScores: scores[currentPlayer],
    potentialScores
  });

  if (bestScore) {
    const committed = lockScore(bestScore.categoryId, bestScore.scoreInfo, false, true);
    if (committed) {
      const catName = getCategoryDisplayName(bestScore.categoryId, currentPlayer);
      addGameLog({
        type: 'timeout',
        player: currentPlayer,
        round: currentRound,
        meta: {
          catId: bestScore.categoryId,
          catName,
          score: bestScore.baseScore
        }
      }, 'timeout', window.isMultiplayer, currentPlayer);
    }
  }
}

// === 네트워크 재접속 유예시간 (60초 누적 타이머) 시스템 ===
let disconnectGrace = { 1: 60, 2: 60, 3: 60, 4: 60 };
const disconnectTimers = { 1: null, 2: null, 3: null, 4: null };

function handlePlayerDisconnect(playerIndex) {
  const box = document.getElementById(`match-p${playerIndex}-box`) || (playerIndex === 1 ? document.getElementById('match-my-box') : null);
  const avatarContainer = box?.querySelector('.match-avatar-container');
  let overlay = document.getElementById(`match-p${playerIndex}-disconnect`) || (playerIndex === 1 ? els.matchP1Disconnect : els.matchP2Disconnect);
  let timerText = document.getElementById(`match-p${playerIndex}-disconnect-timer`) || (playerIndex === 1 ? els.matchP1DisconnectTimer : els.matchP2DisconnectTimer);

  if (avatarContainer) avatarContainer.classList.add('disconnected');
  if (overlay) overlay.classList.remove('hidden');
  if (timerText) timerText.textContent = `${disconnectGrace[playerIndex] !== undefined ? disconnectGrace[playerIndex] : 60}s`;

  if (disconnectTimers[playerIndex]) return;

  disconnectTimers[playerIndex] = setInterval(() => {
    if (disconnectGrace[playerIndex] === undefined) disconnectGrace[playerIndex] = 60;
    disconnectGrace[playerIndex]--;
    if (timerText) timerText.textContent = `${disconnectGrace[playerIndex]}s`;

    if (disconnectGrace[playerIndex] <= 0) {
      clearInterval(disconnectTimers[playerIndex]);
      disconnectTimers[playerIndex] = null;
      handleGameForfeit(playerIndex);
    }
  }, 1000);
}

function handlePlayerReconnect(playerIndex) {
  if (disconnectTimers[playerIndex]) {
    clearInterval(disconnectTimers[playerIndex]);
    disconnectTimers[playerIndex] = null;
  }

  const box = document.getElementById(`match-p${playerIndex}-box`) || (playerIndex === 1 ? document.getElementById('match-my-box') : null);
  const avatarContainer = box?.querySelector('.match-avatar-container');
  let overlay = document.getElementById(`match-p${playerIndex}-disconnect`) || (playerIndex === 1 ? els.matchP1Disconnect : els.matchP2Disconnect);

  if (avatarContainer) avatarContainer.classList.remove('disconnected');
  if (overlay) overlay.classList.add('hidden');
}


function startTurn() {
  pauseTurnTimer();

  equivalentExchangeTurnUses[currentPlayer] = 0;
  const turnStartPlan = createTurnStartPlan({
    player: currentPlayer,
    round: currentRound,
    gameMode,
    isMultiplayer: Boolean(window.isMultiplayer),
    localPlayerIndex: window.myPlayerIndex,
    matchLogCount: window.matchLogHistory?.length || 0,
    activeAugmentIds: getPlayerAugments(currentPlayer),
    draftSelectionCount: draftSelections[currentPlayer],
    yachtBankState: yachtBankState[currentPlayer],
    yachtScore: scores[currentPlayer]?.yacht,
    gambitState: gambitState[currentPlayer],
    prophetRemaining: prophetState[currentPlayer]?.remaining
  });
  if (isLocalAugmentProgressPlayer(currentPlayer)) {
    augmentProgressSession.achievementState.tableFlipDiceCount = 0;
    if (currentRound === 9 && getPlayerAugments(currentPlayer).includes('table-flip')) {
      const totalOf = (player) => Object.values(scores[player] || {}).reduce((total, value) =>
        total + (typeof value === 'object' ? value.score + (value.bonus || 0) : value), 0
      ) + (questProgress[player]?.questBonus || 0) + (globalBonus[player] || 0);
      const myTotal = totalOf(currentPlayer);
      augmentProgressSession.achievementState.flags.tableFlipBehindAtRound9 = Array.from({ length: getActivePlayerCount() }, (_, index) => index + 1)
        .some((player) => player !== currentPlayer && !forfeitedPlayers[player] && totalOf(player) > myTotal);
    }
  }
  rollsLeft = 3;
  keptDice = [];
  activeDice = [];
  if (diceEngine) {
    diceEngine.clearAll();
  }
  els.gameStatus.textContent = turnStartPlan.statusText;

  updateMatchProfiles();
  updateTurnHighlights();

  if (turnStartPlan.playTurnSound) {
    soundEngine.playSFX('turn_change');
  }

  if (turnStartPlan.resetOpponentAugmentView) {
    isViewingOpponentAugments = false;
  }
  updateQuestProgress(currentPlayer, null, null);
  gambitState[currentPlayer] = turnStartPlan.nextGambitState;
  const prophet = prophetState[currentPlayer];
  if (turnStartPlan.shouldRefreshProphet) {
    prophet.numbers = generateLocalProphetNumbers(currentPlayer);
  }

  // 게임 최선두 1라운드 P1 시작 시 '게임 시작!' 로그 기록
  if (turnStartPlan.shouldLogGameStart) {
    addGameLog('게임 시작!', 'turn-start', true, 0);
  }

  // 요트 뱅크: 3턴 진행 완료(turnsLeft === 0) 후 4번째 턴 진입 시 자동 기입 및 턴 자동 넘김
  if (turnStartPlan.yachtBank.shouldInitialize) {
    yachtBankState[currentPlayer] = { turnsLeft: 3, accumulatedScore: 0, initialized: true, completed: false };
  }
  if (turnStartPlan.yachtBank.shouldAutoStore) {
    const bankState = yachtBankState[currentPlayer];
    bankState.completed = true;
    const finalScore = turnStartPlan.yachtBank.finalScore;
    scores[currentPlayer].yacht = { score: finalScore, bonus: 0, bonusDetails: [] };
    addGameLog({ type: 'system', message: `[Bank] 요트 뱅크 증강의 효과로 ${finalScore}점이 Bank 족보에 자동으로 기록되었습니다.` }, 'system', window.isMultiplayer, currentPlayer);
    updateScoreboard();

    // 족보 자동 기록 완료 후 약 0.8초 연출/로그 안내 후 다음 턴으로 자동으로 넘어가도록 스케줄링
    setTimeout(() => {
      advanceTurnAfterScore();
    }, 800);
    return;
  }

  window.proceedTurnStart = function () {
    resolveLocalRandomBoxes();
    startTurnTimer();

    // 이전 턴의 fade-out 효과 클래스 잔재 정리
    document.querySelectorAll('.fade-out-target').forEach(el => {
      el.classList.remove('fade-out-target', 'bounty-target-highlight');
    });

    const roomCode = els.lobbyCodeDisplay?.textContent?.trim() || networkEngine.roomCode || window.currentRoomCode || 'HOTSEAT';
    const turnReadyPlan = createTurnReadyPlan({
      player: currentPlayer,
      round: currentRound,
      roomCode,
      activeAugmentIds: getPlayerAugments(currentPlayer),
      bountyProgress: bountyHunterProgress[currentPlayer],
      scores: scores[currentPlayer],
      yachtBankState: yachtBankState[currentPlayer]
    });
    bountyHunterTarget[currentPlayer] = turnReadyPlan.bountyTarget;

    addGameLog({ type: 'turn-start', player: currentPlayer, round: currentRound }, 'turn-start', true, currentPlayer);
    clearScorePreviews();
    updateRollsUI();

    // [이벤트 트리거 1: 내 턴이 시작되었을 때 불이 들어옴]
    if (typeof diceEngine !== 'undefined' && diceEngine && typeof diceEngine.setYachtBankActive === 'function') {
      diceEngine.setYachtBankActive(turnReadyPlan.yachtBankActive);
    }

    // 현상금 사냥꾼 타겟 지정 완료 후 UI 갱신 (지연 방지)
    if (typeof updateAugmentSidebar === 'function') {
      updateAugmentSidebar(currentPlayer);
    }
    updateScoreboard();
  };
  const proceedTurnStart = window.proceedTurnStart;

  if (turnStartPlan.draft.required) {
    const expectedCount = turnStartPlan.draft.expectedCount;
    // P1이 증강 선택을 처음 시작할 때 페이즈 안내 로그 출력
    if (turnStartPlan.draft.shouldLogPhase) {
      addGameLog(`${expectedCount}페이즈 증강 선택`, 'turn-start', false, 0);
    }

    els.btnRoll.disabled = true;

    showAugmentSelectionModal(currentPlayer, () => {
      if (currentPlayer === 1) {
        const p2Count = draftSelections[2] || 0;
        if (p2Count < expectedCount) {
          if (typeof updateAugmentSidebar === 'function') updateAugmentSidebar(2);
          showAugmentSelectionModal(2, () => {
            if (typeof updateAugmentSidebar === 'function') updateAugmentSidebar(1);
            proceedTurnStart();
          });
          return;
        }
      }
      proceedTurnStart();
    });
    return;
  }

  proceedTurnStart();
}

function updateRollsUI(isRolling = false) {
  els.rollsLeft.textContent = `남은 굴리기: ${rollsLeft}`;
  const isMyTurn = !window.isMultiplayer || currentPlayer === window.myPlayerIndex;

  const hasEquivalentExchange = getPlayerAugments(currentPlayer).includes('equivalent-exchange');
  const canEquivalentExchange = hasEquivalentExchange && (equivalentExchangeUses[currentPlayer] || 0) > 0;

  if (isRolling) {
    els.btnRoll.disabled = true;
    els.btnRoll.classList.remove('equivalent-exchange-active');
    els.btnRoll.textContent = '주사위 굴리기';
    if (typeof diceEngine !== 'undefined' && diceEngine) {
      diceEngine.allowKeep = false;
    }
    return;
  }

  if (rollsLeft > 0) {
    els.btnRoll.disabled = !isMyTurn || !diceBoxReady;
    els.btnRoll.classList.remove('equivalent-exchange-active');
    els.btnRoll.textContent = '주사위 굴리기';
  } else if (canEquivalentExchange) {
    els.btnRoll.disabled = !isMyTurn || !diceBoxReady;
    els.btnRoll.classList.add('equivalent-exchange-active');
    els.btnRoll.textContent = '거래를 원하는가?';
  } else {
    els.btnRoll.disabled = true;
    els.btnRoll.classList.remove('equivalent-exchange-active');
    els.btnRoll.textContent = '주사위 굴리기';
  }

  if (typeof diceEngine !== 'undefined' && diceEngine) {
    const activeAugmentsList = getPlayerAugments(currentPlayer);
    let baseDiceCount = gambitState[currentPlayer] === 'penalty' ? 4 : gambitState[currentPlayer] === 'reward' ? 6 : 5;
    const totalDiceAllowed = baseDiceCount + (activeAugmentsList.includes('strange-die') && !destroyedStrangeDice[currentPlayer] ? 1 : 0);

    // 요트 뱅크 활성화 기간 조건: 증강 보유 중이고 퀘스트 미완료이며 turnsLeft가 남아있거나 방금 선택된 턴인 경우
    const bankSt = yachtBankState[currentPlayer];
    const hasYachtBank = Boolean(activeAugments[currentPlayer] && activeAugments[currentPlayer]['yacht'] === 'yacht-bank');
    const isYachtBankActive = hasYachtBank && !bankSt?.completed && (bankSt?.turnsLeft === undefined || bankSt?.turnsLeft > 0);

    diceEngine.allowKeep = isMyTurn && (rollsLeft < 3 || canEquivalentExchange || isYachtBankActive);

    // 요트 뱅크 활성화 시 킵 존 테두리 금빛 강조 연출 (CSS)
    const diceBoardElem = document.getElementById('dice-board-area');
    if (diceBoardElem) {
      if (isYachtBankActive) {
        diceBoardElem.classList.add('yacht-bank-active');
      } else {
        diceBoardElem.classList.remove('yacht-bank-active');
      }
    }
  }

}

// 주사위 굴림
uiEventControllers.gameplay.bind(els.btnRoll, 'click', async () => {
  // 권한 검증: 본인 턴이 아니면 굴리기 불가
  const isMyTurn = !window.isMultiplayer || currentPlayer === window.myPlayerIndex;

  // 로비(자유 연습) 모드일 경우 코어 게임 로직 무시
  if (els.appContainer?.classList.contains('mode-select-state') && !els.appContainer?.classList.contains('playing-state')) {
    els.btnRoll.disabled = true;

    // 킵된 주사위 외의 나머지만 굴림
    const keptCount = diceEngine.diceArray.filter(d => d.isKept).length;
    const specialConfigs = [];
    for (let i = 0; i < 5 - keptCount; i++) specialConfigs.push({ type: 'normal' });

    diceEngine.cleanUpDeadDice();
    const practiceRoll = await rollLocalDice(specialConfigs);
    if (practiceRoll.source === 'cancelled') return;

    setTimeout(() => {
      // 본 게임과 동일하게 굴린 후에는 모든 주사위 킵을 풀고 중앙(버건디 매트)에 정렬
      if (diceBoxReady) els.btnRoll.disabled = false;
    }, 100);
    return;
  }

  if (isAuthoritativeOnlineMatch()) {
    if (!isMyTurn || authoritativeGameState?.phase !== 'action') return;
    const unkeptDice = (authoritativeGameState?.dice || []).filter((die) => !die.kept);
    if (authoritativeGameState?.turnRollCount > 0 && !unkeptDice.length) return;
    els.btnRoll.disabled = true;
    clearScorePreviews();
    networkEngine.sendMessage({ type: 'game_roll' });
    return;
  }

  // 실제 게임 모드 로직
  const hasEE = getPlayerAugments(currentPlayer).includes('equivalent-exchange');
  const canEE = rollsLeft <= 0 && hasEE && (equivalentExchangeUses[currentPlayer] || 0) > 0;

  if (!isMyTurn) return;
  if (rollsLeft <= 0 && !canEE) return;

  pauseTurnTimer(); // 주사위 굴리는 동안 타이머 정지
  soundEngine.playSFX('dice_roll');
  let isEquivalentRoll = false;
  if (rollsLeft > 0) {
    rollsLeft--;
  } else if (canEE) {
    isEquivalentRoll = true;
    equivalentExchangeUses[currentPlayer]--;
    equivalentExchangePenalty[currentPlayer] = (equivalentExchangePenalty[currentPlayer] || 0) + 5;
    equivalentExchangeTurnUses[currentPlayer] = (equivalentExchangeTurnUses[currentPlayer] || 0) + 1;
  }

  updateRollsUI(true);
  els.btnRoll.disabled = true; // 굴리는 중 비활성화
  clearScorePreviews();

  // 구성(config) 생성
  const activeAugmentsList = getPlayerAugments(currentPlayer);
  const gambitActive = gambitState[currentPlayer] === 'penalty' || gambitState[currentPlayer] === 'reward';
  let baseDiceCount = gambitState[currentPlayer] === 'penalty' ? 4 : gambitState[currentPlayer] === 'reward' ? 6 : 5;
  const specialConfigs = [];

  if (!gambitActive && activeAugmentsList.includes('strange-die') && !destroyedStrangeDice[currentPlayer]) {
    specialConfigs.push({ type: 'weird' });
  }
  if (!gambitActive && activeAugmentsList.includes('promotion-die') && !promotionConsumed[currentPlayer]) {
    const acqRound = promotionAcquiredRound[currentPlayer] || currentRound;
    const pLevel = Math.max(0, currentRound - acqRound);
    specialConfigs.push({ type: 'promotion', promotionLevel: pLevel });
  }

  let heavyCount = !gambitActive && activeAugmentsList.includes('weighted-dice') ? 1 : 0;
  let goldenCount = !gambitActive && activeAugmentsList.includes('golden-die') ? 1 : 0;
  let octCount = !gambitActive && activeAugmentsList.includes('8-sided') ? 2 : 0;
  let coupleCount = !gambitActive && activeAugmentsList.includes('couple-dice') ? 2 : 0;
  let sevensCount = !gambitActive && activeAugmentsList.includes('sevens-dice') ? 2 : 0;

  // 킵된 주사위에서 소모된 수량 차감
  const keptConfigs = diceEngine.diceArray.filter(d => d.isKept).map(d => d.config.type);
  keptConfigs.forEach(t => {
    if (t === 'heavy') heavyCount--;
    else if (t === 'golden') goldenCount--;
    else if (t === 'octahedron') octCount--;
    else if (t === 'couple') coupleCount--;
    else if (t === 'sevens') sevensCount--;
    else if (t === 'weird') {
      const idx = specialConfigs.findIndex(c => c.type === 'weird');
      if (idx !== -1) specialConfigs.splice(idx, 1);
    }
    else if (t === 'promotion') {
      const idx = specialConfigs.findIndex(c => c.type === 'promotion');
      if (idx !== -1) specialConfigs.splice(idx, 1);
    }
  });

  for (let i = 0; i < heavyCount; i++) specialConfigs.push({ type: 'heavy' });
  for (let i = 0; i < goldenCount; i++) specialConfigs.push({ type: 'golden' });
  for (let i = 0; i < octCount; i++) specialConfigs.push({ type: 'octahedron' });
  for (let i = 0; i < coupleCount; i++) specialConfigs.push({ type: 'couple' });
  for (let i = 0; i < sevensCount; i++) specialConfigs.push({ type: 'sevens' });

  const totalDiceAllowed = baseDiceCount + (!gambitActive && activeAugmentsList.includes('strange-die') && !destroyedStrangeDice[currentPlayer] ? 1 : 0);
  const normalCountToRoll = totalDiceAllowed - keptConfigs.length - specialConfigs.length;

  for (let i = 0; i < normalCountToRoll; i++) specialConfigs.push({ type: 'normal' });

  if (isLocalAugmentProgressPlayer()) {
    Object.entries(diceAugmentTypes).forEach(([augmentId, diceType]) => {
      if (specialConfigs.some((config) => config.type === diceType)) {
        recordAugmentMetric(augmentProgressSession, augmentId, 'diceRolls');
      }
    });
  }

  // Custom Dice Engine Roll
  diceEngine.cleanUpDeadDice();

  const rolledCount = specialConfigs.length;
  if (keptConfigs.length === 0) {
    addGameLog({ type: 'roll-action', player: currentPlayer, meta: { rolledCount, keptValues: [], isEquivalentRoll } }, 'roll-action', window.isMultiplayer, currentPlayer);
  } else {
    const keptValues = diceEngine.diceArray.filter(d => d.isKept).map(d => d.value).sort((a, b) => a - b);
    addGameLog({ type: 'roll-action', player: currentPlayer, meta: { rolledCount, keptValues, isEquivalentRoll } }, 'roll-action', window.isMultiplayer, currentPlayer);
  }

  const rollPromise = rollLocalDice(specialConfigs);

  if (window.isMultiplayer) {
    const spawnTransforms = diceEngine.getSpawnTransforms();
    networkEngine.sendMessage({
      type: 'sync_roll',
      specialConfigs,
      rollsLeft,
      spawnTransforms,
      equivalentExchangeUses: equivalentExchangeUses[currentPlayer],
      equivalentExchangePenalty: equivalentExchangePenalty[currentPlayer],
      isEquivalentRoll
    });
  }

  const localRoll = await rollPromise;
  if (localRoll.source === 'cancelled') return;

  if (window.isMultiplayer) {
    const finalValues = diceEngine.diceArray.map(d => d.value);
    const finalTransforms = diceEngine.getFinalTransforms();
    networkEngine.sendMessage({ type: 'sync_roll_end', finalValues, finalTransforms });
  }

  // Arrange them after a short delay
  setTimeout(() => {
    // 리롤 시 모든 주사위를 버건디 매트(중앙)에 함께 정렬하기 위해 킵 상태 초기화
    // 기존 킵 주사위 상태를 유지함.


    // 로컬 상태 동기화
    keptDice = diceEngine.diceArray.filter(d => d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);
    activeDice = diceEngine.diceArray.filter(d => !d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);

    addGameLog({ type: 'roll-result', player: currentPlayer, meta: { values: activeDice } }, 'roll-result', window.isMultiplayer, currentPlayer);

    updateRollsUI();
    resumeTurnTimer(); // 롤링 완료 후 타이머 재개
    updateScorePreviews(); // 롤링 완료 후 족보 미리보기 및 기입 버튼 활성화
  }, 100); // 틱틱거림 방지를 위해 딜레이 대폭 축소
});

// 점수 미리보기
function updateScorePreviews() {
  clearScorePreviews();

  // 아직 주사위를 굴리지 않은 턴 시작 직후인 경우 미리보기 생략
  if (rollsLeft === 3 && activeDice.length === 0 && keptDice.length === 0) {
    return;
  }

  // 요트 뱅크: 킵 존 주사위는 족보 점수 계산에서 제외
  const isYachtBankActive = (activeAugments[currentPlayer] && activeAugments[currentPlayer]['yacht'] === 'yacht-bank' && yachtBankState[currentPlayer]?.turnsLeft > 0);
  const evalDice = isYachtBankActive ? [...activeDice] : [...keptDice, ...activeDice];

  if (evalDice.length > 5) {
    if (keptDice.length === 5) {
      previewScores(keptDice);
    } else {
      showNotSelectedState(5 - keptDice.length);
    }
  } else {
    previewScores(evalDice);
  }
}

function showNotSelectedState(neededCount) {
  if (!scores[currentPlayer]) scores[currentPlayer] = {};
  if (!activeAugments[currentPlayer]) activeAugments[currentPlayer] = {};

  categories.forEach(cat => {
    if (cat.isDivider) return;
    const cellId = `p${currentPlayer}-${cat.id}`;
    const cell = document.getElementById(cellId);

    // 이미 확정된 점수면 스킵
    if (scores[currentPlayer] && scores[currentPlayer][cat.id] !== undefined) return;

    // "선택되지 않음" 상태 적용
    if (cell) {
      cell.textContent = '-';
      cell.style.color = '#888';
      cell.classList.remove('suggested');
      cell.onclick = null;
      cell.title = `족보에 기입할 주사위를 ${neededCount}개 선택해주세요.`;
    }
  });
}

function previewScores(diceArray) {
  if (!scores[currentPlayer]) scores[currentPlayer] = {};
  if (!activeAugments[currentPlayer]) activeAugments[currentPlayer] = {};
  if (!yachtBankState[currentPlayer]) yachtBankState[currentPlayer] = { turnsLeft: 0, accumulatedScore: 0, initialized: false, completed: false };

  // Get full dice array from engine to pass configs to scoreEngine if needed
  const fullDiceObjects = diceEngine.diceArray.map(d => ({ value: d.value, type: d.config.type }));
  const potentialScores = calculateScores(diceArray, activeAugments[currentPlayer] || {}, { bank: (yachtBankState[currentPlayer]?.accumulatedScore || 0), fullDice: fullDiceObjects });
  const playerAugments = getPlayerAugments(currentPlayer);

  categories.forEach(cat => {
    if (cat.isDivider) return;
    if (scores[currentPlayer] && scores[currentPlayer][cat.id] !== undefined) return;

    const cellId = `p${currentPlayer}-${cat.id}`;
    const cell = document.getElementById(cellId);
    if (!cell) return;

    const scoreObj = createScoreDecision({
      scoreInfo: potentialScores[cat.id],
      hasMomentum: playerAugments.includes('momentum'),
      momentumState: momentumState[currentPlayer],
      doubleDownState: doubleDownState[currentPlayer],
      doubleDownBonusColor: '#c084fc'
    }).scoreInfo;

    let scoreText = scoreObj.score.toString();
    if (scoreObj.bonus > 0) {
      scoreText += ` <span style="color: #D4AF37;">+${scoreObj.bonus}</span>`;
    }

    // 요트 뱅크 미리보기 및 잠금 처리
    const isYachtBankCell = (cat.id === 'yacht' && activeAugments[currentPlayer]['yacht'] === 'yacht-bank');
    if (isYachtBankCell) {
      const bankVal = Math.min(yachtBankState[currentPlayer]?.accumulatedScore || 0, 15);
      scoreText = `${bankVal}`;
    }

    cell.innerHTML = scoreText;
    cell.style.color = ''; // 인라인 색상 초기화 (suggested/suggested-readonly 클래스 적용을 위해)

    // 턴 주체 여부에 따라 클래스 구분 (본인 턴: suggested, 상대방 턴: suggested-readonly 호버 무반응)
    const isMyTurn = !window.isMultiplayer || currentPlayer === window.myPlayerIndex;
    if (isMyTurn && !isYachtBankCell) {
      cell.classList.remove('suggested-readonly');
      cell.classList.add('suggested');
      cell.onclick = () => {
        if (isAuthoritativeOnlineMatch()) {
          cell.onclick = null;
          networkEngine.sendMessage({ type: 'game_score', catId: cat.id });
        } else {
          lockScore(cat.id, potentialScores[cat.id]);
        }
      };
    } else {
      cell.classList.remove('suggested');
      cell.classList.add('suggested-readonly');
      cell.onclick = null;
    }
  });

  if (typeof updateAugmentSidebar === 'function') {
    updateAugmentSidebar();
  }
}

function clearScorePreviews() {
  const count = getActivePlayerCount();
  categories.forEach(cat => {
    if (cat.isDivider) return;
    for (let p = 1; p <= count; p++) {
      const cell = document.getElementById(`p${p}-${cat.id}`);
      if (cell) {
        if (!scores[p] || scores[p][cat.id] === undefined) {
          cell.style.color = ''; // 인라인 색상 초기화
          cell.classList.remove('suggested');
          cell.classList.remove('suggested-readonly');
          cell.onclick = null; // 이벤트 제거
          cell.title = '';
        }
      }
    }
  });
  updateScoreboard();
}

function getUpperSum(player) {
  if (!scores[player]) scores[player] = {};
  if (!activeAugments[player]) activeAugments[player] = {};
  return calculateUpperScoreTotal(scores[player], activeAugments[player]);
}

function recordDiceScoreUsage(catId, scoreObj) {
  if (!isLocalAugmentProgressPlayer() || !scoreObj || scoreObj.score <= 0 || !diceEngine) return;
  const dice = diceEngine.diceArray.filter((die) => die.config?.type !== 'weird');
  const augments = activeAugments[currentPlayer] || {};
  Object.entries(diceAugmentTypes).forEach(([augmentId, diceType]) => {
    if (!Object.values(augments).includes(augmentId) || !dice.some((die) => die.config?.type === diceType)) return;
    const withoutAugmentDice = dice.filter((die) => die.config?.type !== diceType).map((die) => die.value);
    const withoutScore = calculateScores(withoutAugmentDice, augments, { bank: yachtBankState[currentPlayer]?.accumulatedScore || 0 })[catId]?.score || 0;
    if (withoutScore !== scoreObj.score) {
      recordAugmentMetric(augmentProgressSession, augmentId, 'diceScoreRecords');
    }
  });

  if (Object.values(augments).includes('couple-dice') && scoreObj.bonusDetails?.some((detail) => detail.value === 3)) {
    recordAchievementProgress(augmentProgressSession, 'couple-dice-perfect-match');
  }
}

function applyScoreDecisionMutation(player, plan) {
  const mutation = plan.stateMutation;
  momentumState[player] = mutation.momentumState;
  doubleDownState[player] = mutation.doubleDownState;
  if (mutation.momentumGainedScore !== null) {
    momentumGainedScore[player] = mutation.momentumGainedScore;
  }
}

function emitScoreDecisionEvents(player, plan) {
  const armed = plan.augmentEvents.find((event) => event.type === 'momentum-armed');
  if (armed) {
    addGameLog({ type: 'system', message: `${getPlayerLabel(player)}의 [추진력] 증강이 발동 준비되었습니다! (다음 턴 점수 획득 시 1.5배)` }, 'system', window.isMultiplayer, player);
  }

  const multiplied = plan.augmentEvents.find((event) => event.type === 'score-multiplied');
  if (!multiplied?.momentum) return;
  if (isLocalAugmentProgressPlayer(player)) {
    recordAchievementProgress(augmentProgressSession, 'momentum-kneel', multiplied.bonus, 'max');
    if (multiplied.totalScore >= 30) recordAchievementProgress(augmentProgressSession, 'momentum-comeback');
    augmentProgressSession.achievementState.flags.momentumTriggered = true;
  }
  addGameLog({ type: 'system', message: `${getPlayerLabel(player)}의 [추진력] 증강이 발동하여 획득 점수가 ${multiplied.multiplier === 2 ? 2 : 1.5}배로 증가했습니다! (${multiplied.totalScore}점 획득)` }, 'system', window.isMultiplayer, player);
}

function getScoreCommitPhase() {
  const draftModal = document.getElementById('augment-selection-modal');
  return resolveScoreCommitPhase({
    authoritativePhase: isAuthoritativeOnlineMatch() ? authoritativeGameState?.phase ?? null : null,
    isSessionStarted: Boolean(window.gameSessionStarted),
    isGameEnded,
    isDraftOpen: Boolean(draftModal && !draftModal.classList.contains('hidden'))
  });
}

function lockScore(catId, scoreInfo, isSync = false, force = false) {
  if (!scores[currentPlayer]) scores[currentPlayer] = {};
  const playerAugments = getPlayerAugments(currentPlayer);
  const commitPlan = createScoreCommitPlan({
    categoryId: catId,
    categoryIds: SCORE_CATEGORIES,
    recordedScores: scores[currentPlayer],
    phase: getScoreCommitPhase(),
    hasRolled: rollsLeft !== 3 || activeDice.length > 0 || keptDice.length > 0,
    force,
    scoreInfo,
    activeAugmentIds: playerAugments,
    momentumState: momentumState[currentPlayer],
    doubleDownState: doubleDownState[currentPlayer],
    isMultiplayer: window.isMultiplayer,
    isSync,
    doubleDownBonusColor: '#c084fc'
  });
  if (!commitPlan.validation.ok) return false;

  stopTurnTimer();
  if (commitPlan.effects.playScoreSound) soundEngine.playSFX('scoreboard');
  if (commitPlan.effects.stopBgm) soundEngine.stopBGM();
  if (commitPlan.effects.sendNetwork) {
    networkEngine.sendMessage({ type: 'sync_score', catId, scoreInfo, force });
  }

  const scoreObj = commitPlan.decision.scoreInfo;
  applyScoreDecisionMutation(currentPlayer, commitPlan);
  emitScoreDecisionEvents(currentPlayer, commitPlan);

  // 현상금 사냥꾼 타겟 기입 검증 및 진행도 누적
  const activeAugmentsList = getPlayerAugments(currentPlayer);
  if (activeAugmentsList.includes('bounty-hunter') && bountyHunterTarget[currentPlayer] === catId) {
    const bhProg = bountyHunterProgress[currentPlayer] || { count: 0, penaltyCount: 0 };
    bhProg.count = (bhProg.count || 0) + 1;

    // 스크래치(0점) 기입 여부 판정
    const actualScore = scoreObj.score !== undefined ? scoreObj.score : 0;
    if (actualScore === 0) {
      bhProg.penaltyCount = (bhProg.penaltyCount || 0) + 1;
    }
    if (isLocalAugmentProgressPlayer() && actualScore >= 20 && currentRound - (bountyHunterAcquiredRound[currentPlayer] || currentRound) < 3) {
      recordAchievementProgress(augmentProgressSession, 'bounty-hunter-legendary-killer');
    }

    const remainingHits = 3 - bhProg.count;
    if (remainingHits > 0) {
      addGameLog({ type: 'system', message: `[현상금 사냥꾼] 타겟 적중! 앞으로 ${remainingHits}회 남았습니다.` }, 'system', window.isMultiplayer, currentPlayer);
    } else if (remainingHits === 0) {
      // 3회 달성: 퀘스트 완료 보상 가산 (스크래치 감점 계산)
      const finalReward = Math.max(0, 15 - (bhProg.penaltyCount * 3));
      if (!questProgress[currentPlayer]) questProgress[currentPlayer] = {};
      questProgress[currentPlayer].questBonus = (questProgress[currentPlayer].questBonus || 0) + finalReward;
      addGameLog({ type: 'system', message: `[현상금 사냥꾼] 현상금 획득 성공! 보너스 +${finalReward}점을 얻었습니다.` }, 'system', window.isMultiplayer, currentPlayer);
      if (isLocalAugmentProgressPlayer()) augmentProgressSession.achievementState.flags.bountyCompleted = true;
    }
  }

  if (isLocalAugmentProgressPlayer()) {
    recordDiceScoreUsage(catId, scoreObj);
    const scoreDice = (diceEngine?.diceArray || []).filter((die) => die.config?.type !== 'weird');
    recordScoreAchievementEvent(augmentProgressSession, {
      augmentIds: activeAugmentsList,
      categoryAugmentId: activeAugments[currentPlayer]?.[catId] || null,
      categoryId: catId,
      diceValues: scoreDice.map((die) => Number(die.value)),
      round: currentRound,
      rollsLeft,
      score: Number(scoreObj.score) || 0,
      goldenBonus: scoreDice.some((die) => die.config?.type === 'golden' && [1, 2, 3].includes(Number(die.value))),
      tableFlipDiceCount: augmentProgressSession.achievementState.tableFlipDiceCount || 0,
      equivalentExchangeUses: equivalentExchangeTurnUses[currentPlayer] || 0
    });
  }

  scores[currentPlayer][catId] = scoreObj;

  const recordedScore = (Number(scoreObj.score) || 0) + (Number(scoreObj.bonus) || 0);
  const prophet = prophetState[currentPlayer];
  if (prophet?.remaining > 0) {
    if (prophet.numbers.includes(recordedScore)) {
      globalBonus[currentPlayer] = (globalBonus[currentPlayer] || 0) + 7;
      prophet.successes = (prophet.successes || 0) + 1;
    }
    prophet.remaining--;
  }

  for (let owner = 1; owner <= 2; owner++) {
    const duel = duelState[owner];
    if (!duel || duel.resolved || duel.round !== currentRound) continue;
    const opponent = owner === 1 ? 2 : 1;
    if (currentPlayer === owner) duel.ownerScore = recordedScore;
    if (currentPlayer === opponent) duel.opponentScore = recordedScore;
    if (duel.ownerScore == null || duel.opponentScore == null) continue;
    if (duel.ownerScore > duel.opponentScore) globalBonus[owner] = (globalBonus[owner] || 0) + 10;
    else if (duel.ownerScore === duel.opponentScore) globalBonus[owner] = (globalBonus[owner] || 0) + 5;
    duel.resolved = true;
  }

  if (activeAugmentsList.includes('piggy-bank')) {
    const piggy = piggyBankState[currentPlayer] || (piggyBankState[currentPlayer] = { balance: 0, payouts: 0 });
    piggy.balance += rollsLeft * 3;
    if (piggy.balance >= 12) {
      globalBonus[currentPlayer] = (globalBonus[currentPlayer] || 0) + 12;
      piggy.balance = 0;
      piggy.payouts++;
    }
  }
  if (gambitState[currentPlayer] === 'penalty') gambitState[currentPlayer] = 'pending-reward';
  else if (gambitState[currentPlayer] === 'reward') gambitState[currentPlayer] = 'used';

  if (isLocalAugmentProgressPlayer()) {
    const achievementFlags = augmentProgressSession.achievementState.flags;
    if (activeAugmentsList.includes('double-large-straight') && getUpperSum(currentPlayer) >= 60 && !achievementFlags.doubleLargeUpperBonus) {
      achievementFlags.doubleLargeUpperBonus = true;
      recordAchievementProgress(augmentProgressSession, 'double-large-straight-upper-bonus');
    }
  }

  // 타임아웃에 의한 자동 기입인 경우 일반 족보 기입 로그 작성을 생략 (중복 방지)
  if (commitPlan.effects.writeScoreLog) {
    const catName = getCategoryDisplayName(catId, currentPlayer);
    addGameLog({ type: 'score-record', player: currentPlayer, meta: { catId, catName, score: scoreObj.score } }, 'score-record', false, currentPlayer);
  }


  // 이상한 주사위 파괴 체크 (굴려서 6이 나오면 무조건 파괴)
  diceEngine.diceArray.forEach(d => {
    if (d.config.type === 'weird' && d.value === 6) {
      destroyedStrangeDice[currentPlayer] = true;
    }
  });

  // 프로모션 주사위 소모 체크 (프로모션 주사위 눈금이 6인 상태에서 족보 기입 완료 시 소모)
  const usedDice = diceEngine.diceArray.length > 5 ? diceEngine.diceArray.filter(d => d.isKept) : diceEngine.diceArray;
  usedDice.forEach(d => {
    if (d.config.type === 'promotion' && d.value === 6) {
      promotionConsumed[currentPlayer] = true;
      if (isLocalAugmentProgressPlayer()) recordAchievementProgress(augmentProgressSession, 'promotion-die-rank-seven');
      addGameLog({ type: 'system', message: `${getPlayerLabel(currentPlayer)}의 프로모션 주사위가 소모되어 일반 주사위로 복구되었습니다.` }, 'system', window.isMultiplayer, currentPlayer);
    }
  });

  stopTurnTimer(); // 족보 선택 즉시 장고 타이머 일시 정지
  els.btnRoll.disabled = true; // 주사위 정리 중 굴리기 버튼 비활성화

  const cell = document.getElementById(`p${currentPlayer}-${catId}`);

  let scoreText = '';
  if (typeof scoreObj === 'object') {
    scoreText = `${scoreObj.score}`;
    if (scoreObj.bonusDetails && scoreObj.bonusDetails.length > 0) {
      scoreObj.bonusDetails.forEach(b => {
        const sign = b.value > 0 ? '+' : '';
        scoreText += ` <span style="color: ${b.color};">${sign}${b.value}</span>`;
      });
    } else if (scoreObj.bonus > 0) {
      scoreText += ` <span style="color: #D4AF37;">+${scoreObj.bonus}</span>`;
    }
  } else {
    scoreText = scoreObj;
  }

  cell.innerHTML = scoreText;
  cell.classList.remove('suggested');
  cell.classList.add('filled');
  cell.onclick = null; // 클릭 해제

  // 타겟 족보 제목 Fade Out 효과
  if (bountyHunterTarget[currentPlayer] === catId) {
    const title = document.getElementById(`${currentPlayer === 1 ? 'cat-title-left' : 'cat-title-right'}-${catId}`);
    if (title?.classList.contains('bounty-target-highlight')) {
      title.classList.add('fade-out-target');
    }
  }

  // 특수 족보 완성 확인 (Choice 포함)
  if (diceEngine) {
    diceEngine.playClearAnimation(commitPlan.animationCleanup.isSpecial); // 애니메이션 실행
  }

  const totalCount = getActivePlayerCount();

  updateQuestProgress(currentPlayer, catId, scoreObj);
  const upperSum = getUpperSum(currentPlayer);
  if (upperSum >= upperBonusThreshold[currentPlayer]) {
    scores[currentPlayer]['bonus'] = questProgress[currentPlayer]?.stepRewarded ? 55 : 35;
  }
  if (isLocalAugmentProgressPlayer() && activeAugmentsList.includes('step-by-step') && questProgress[currentPlayer]?.stepRewarded) {
    const flags = augmentProgressSession.achievementState.flags;
    if (getUpperSum(currentPlayer) >= upperBonusThreshold[currentPlayer] && !flags.stepUpperBonus) {
      flags.stepUpperBonus = true;
      recordAchievementProgress(augmentProgressSession, 'step-by-step-perfect-plan');
    }
  }

  // 요트 뱅크: 턴 종료 시 킵 존 주사위 눈금 누적 (최대 15점) 및 남은 턴 차감
  if (activeAugments[currentPlayer] && activeAugments[currentPlayer]['yacht'] === 'yacht-bank') {
    if (!yachtBankState[currentPlayer]) {
      yachtBankState[currentPlayer] = { turnsLeft: 3, accumulatedScore: 0, initialized: true, completed: false };
    }
    const bankState = yachtBankState[currentPlayer];
    if (bankState && bankState.turnsLeft > 0 && !bankState.completed) {
      const keptSum = keptDice.reduce((a, b) => a + b, 0);
      if (keptSum > 0) {
        bankState.accumulatedScore = Math.min(bankState.accumulatedScore + keptSum, 15);
        addGameLog({ type: 'system', message: `[Bank] 요트 뱅크 족보에 주사위 [${keptDice.join(', ')}]를 적립해 ${keptSum}점이 누적되었습니다. (${bankState.accumulatedScore}/15점)` }, 'system', window.isMultiplayer, currentPlayer);
        if (isLocalAugmentProgressPlayer()) {
          const enhancedKeptCount = diceEngine.diceArray.filter((die) =>
            die.isKept && Object.values(diceAugmentTypes).includes(die.config?.type)
          ).length;
          if (enhancedKeptCount) {
            recordAchievementProgress(augmentProgressSession, 'yacht-bank-fence', enhancedKeptCount);
          }
        }
      }
      bankState.turnsLeft--;
      if (bankState.turnsLeft === 0) {
        bankState.completed = true; // 3턴 진행 완료
      }
    }
  }

  clearScorePreviews();
  updateScoreboard();

  // [이벤트 트리거 2: 내 턴이 끝났을 때 불이 꺼짐]
  if (typeof diceEngine !== 'undefined' && diceEngine && typeof diceEngine.setYachtBankActive === 'function') {
    diceEngine.setYachtBankActive(false);
  }

  // 족보 점수 기입 및 결과/로그 확인 유예시간 3초(3000ms) 적용
  setTimeout(() => {
    if (diceEngine) {
      diceEngine.clearAll();
    }

    advanceTurnAfterScore();
  }, commitPlan.animationCleanup.delayMs);
  return true;
}

function hasUnfilledCategory(p) {
  if (!scores[p]) return true;
  return SCORE_CATEGORIES.some(catId => scores[p][catId] === undefined);
}

function advanceTurnAfterScore() {
  applyTurnTransition(resolveTurnAdvance({
    currentPlayer,
    currentRound,
    playerCount: getActivePlayerCount(),
    isExtraTurnPhase,
    extraTurns,
    hasRemainingCategory: hasUnfilledCategory,
    isPlayerEligible: (player) => !forfeitedPlayers[player]
  }));
}

function applyTurnTransition(transition) {
  currentPlayer = transition.currentPlayer;
  currentRound = transition.currentRound;
  isExtraTurnPhase = transition.isExtraTurnPhase;
  extraTurns = transition.extraTurns;

  if (transition.kind === 'game-end') {
    endGame();
    return;
  }

  if (transition.kind === 'extra-turn') {
    addGameLog({
      type: 'system',
      message: `${getPlayerLabel(currentPlayer)}의 추가 턴(+1턴)이 시작됩니다!`
    }, 'system', window.isMultiplayer, currentPlayer);
  }

  startTurn();
}

let isGameEnded = false;

function isLocalAugmentProgressPlayer(player = currentPlayer) {
  return isAchievementEligibleMode(gameMode, window.isMultiplayer)
    && player === (window.myPlayerIndex || 1)
    && Boolean(augmentProgressSession);
}

function setAugmentProgressSaveStatus(message = '', state = '') {
  const status = document.getElementById('endgame-augment-progress-status');
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.dataset.state = state;
}

async function savePersonalAugmentProgress(won = false) {
  const user = getCurrentUser();
  const myPlayer = window.myPlayerIndex || 1;
  const selectedAugments = getPlayerAugments(myPlayer);
  const completionPlan = createAugmentProgressCompletionPlan({
    gameMode,
    isMultiplayer: window.isMultiplayer,
    userUid: user?.uid,
    forfeitedPlayers,
    session: augmentProgressSession,
    selectedAugments,
    scores: scores[myPlayer] || {},
    questProgress: questProgress[myPlayer] || {},
    yachtBankState: yachtBankState[myPlayer] || {},
    bountyHunterProgress: bountyHunterProgress[myPlayer] || {},
    prophetState: prophetState[myPlayer] || {},
    tableFlipUsed: Boolean(playerTableFlipUsed[myPlayer]),
    won,
    promotionConsumed: Boolean(promotionConsumed[myPlayer])
  });

  const blockedStatuses = {
    'ineligible-mode': ['도전과제 저장 제외: 온라인 증강 모드가 아님.', 'skipped'],
    'missing-user': ['도전과제 저장 실패: 로그인 정보가 없음.', 'error'],
    'incomplete-match': ['도전과제 저장 제외: 정상 완주 경기가 아님.', 'skipped'],
    'missing-session': ['도전과제 저장 실패: 게임 진행 세션을 찾을 수 없음.', 'error']
  };
  if (completionPlan.status !== 'ready') {
    setAugmentProgressSaveStatus(...blockedStatuses[completionPlan.status]);
    return false;
  }

  augmentProgressSession = completionPlan.session;
  setAugmentProgressSaveStatus('도전과제 진행도 저장 중...', 'pending');

  try {
    const saved = await saveAugmentProgress(completionPlan.userUid, augmentProgressSession);
    if (!saved) {
      setAugmentProgressSaveStatus('도전과제 저장 실패: 이미 처리된 게임이거나 사용자 데이터를 찾을 수 없음.', 'error');
      return false;
    }
    setAugmentProgressSaveStatus('도전과제 진행도 저장 완료함.', 'success');
    return true;
  } catch (error) {
    console.error('Augment progress save failed:', error);
    const reason = error?.code || error?.message || '알 수 없는 오류';
    setAugmentProgressSaveStatus(`도전과제 저장 실패: ${reason}`, 'error');
    return false;
  }
}

function endGame(serverConfirmed = false) {
  if (isGameEnded) return;
  isGameEnded = true;

  if (window.isMultiplayer && !serverConfirmed && !isAuthoritativeOnlineMatch()) {
    networkEngine.sendMessage({ type: 'game_ended' });
  }
  const user = getCurrentUser();
  if (user?.uid) {
    clearUserActiveGame(user.uid);
  }
  const count = getActivePlayerCount();
  const playerProfiles = Array.from({ length: count }, (_, index) => (
    window.initialMatchPlayers?.[index] || window.lobbyPlayers?.[index] || null
  ));
  const endGameSummary = createEndGameSummary({
    playerCount: count,
    scores,
    activeAugments,
    yachtBankState,
    questProgress,
    globalBonus,
    equivalentExchangePenalty,
    forfeitedPlayers,
    players: playerProfiles,
    localPlayerIndex: window.myPlayerIndex,
    fallbackAvatarUrl: window.myPlayerInfo?.avatarUrl || user?.photoURL || null
  });
  const playerStats = endGameSummary.players;
  const activePlayers = endGameSummary.activePlayers;

  renderEndGameSummary({
    summary: endGameSummary,
    scoresContainer: document.getElementById('endgame-scores-container'),
    winnerTitleElement: document.getElementById('endgame-winner')
  });

  els.endgameModal?.classList.remove('hidden');
  setAugmentProgressSaveStatus();
  const localPlayer = playerStats.find((player) => player.playerIndex === (window.myPlayerIndex || 1));
  void savePersonalAugmentProgress(Boolean(localPlayer?.isWinner && !endGameSummary.isDraw));

  const myIdx = window.myPlayerIndex || 1;
  const activePlayerIndices = activePlayers.map((player) => player.playerIndex);
  const saverIndex = activePlayerIndices.includes(1) ? 1 : (activePlayerIndices[0] || 1);
  const isHostOrSaver = (myIdx === saverIndex);

  if (gameMode && gameMode !== 'hotseat' && gameMode !== 'none') {
    if (isHostOrSaver) {
      saveMatchData();
    }
  }
}

async function saveMatchData() {
  if (
    gameMode === 'hotseat'
    || gameMode === 'augmented-hotseat'
    || !window.isMultiplayer
    || networkEngine.sessionType === 'matchmaking'
  ) {
    return;
  }

  const count = getActivePlayerCount();
  const matchCompletedAt = new Date().toISOString();
  const playersSource = (window.initialMatchPlayers && window.initialMatchPlayers.length > 0)
    ? window.initialMatchPlayers
    : (window.lobbyPlayers || []);
  const curUser = getCurrentUser();
  const { playersData, matchDocument } = createMatchPersistencePlan({
    playerCount: count,
    players: playersSource,
    currentUserUid: curUser?.uid,
    sessionUid: window.myUid,
    localPlayerIndex: window.myPlayerIndex,
    scores,
    activeAugments,
    yachtBankState,
    questProgress,
    globalBonus,
    equivalentExchangePenalty,
    forfeitedPlayers,
    forfeitedPlayerUids,
    mode: gameMode,
    playLogs: window.matchLogHistory || [],
    normalizeUid: cleanUid
  });
  const matchDoc = {
    ...matchDocument,
    timestamp: serverTimestamp()
  };

  try {
    // 1. matches 컬렉션에 매치 결과 저장
    const docRef = await addDoc(collection(db, "matches"), matchDoc);

    // 2. 현재 사용자 stats 데이터 누적 업데이트
    const curAuthUser = getCurrentUser();
    const profileStatsPlan = createProfileStatsUpdatePlan({
      playersData,
      currentUserUid: curAuthUser?.uid,
      mode: gameMode,
      completedAt: matchCompletedAt,
      normalizeUid: cleanUid
    });
    if (profileStatsPlan) {
      const userRef = doc(db, "users", profileStatsPlan.uid);
      try {
        await runTransaction(db, async (transaction) => {
          const sfDoc = await transaction.get(userRef);
          if (!sfDoc.exists()) return;

          const oldData = sfDoc.data();
          const stats = oldData.stats || {};
          transaction.update(userRef, {
            stats: updateProfileStats(stats, profileStatsPlan.result)
          });
        });
      } catch (txErr) {
        console.error("Stats Transaction failed: ", txErr);
      }
    }

    const currentUser = getCurrentUser();
    if (currentUser?.uid) {
      deleteCachedProfileData(currentUser.uid);
      refreshUserHistory(currentUser.uid);
    }
  } catch (err) {
    console.error("Failed to save match data:", err);
  }
}

uiEventControllers.gameplay.bind(els.btnReturnLobby, 'click', async () => {
  // 1. 모달 닫기 및 페이드 아웃
  els.endgameModal.classList.add('hidden');
  if (els.appContainer) els.appContainer.style.opacity = '0';

  const user = getCurrentUser();
  if (user?.uid) {
    await clearUserActiveGame(user.uid);
  }

  setTimeout(() => {
    // 2. 세션 및 UI 완전 리셋
    resetGameSession();
    gameMode = 'none';
    // UI 전환 (playing -> mode-select)
    if (els.appContainer) {
      els.appContainer.classList.remove('playing-state', 'normal-mode');
      els.appContainer.classList.add('mode-select-state');
    }
    if (els.matchInfoSection) {
      els.matchInfoSection.classList.add('hidden');
    }

    if (els.gameStatus) els.gameStatus.textContent = '로비 (자유 연습)';
    if (els.rollsLeft) els.rollsLeft.textContent = '무한 굴리기';
    if (els.btnRoll) els.btnRoll.disabled = false;

    // 3. 페이드 인
    requestAnimationFrame(() => {
      if (els.appContainer) els.appContainer.style.opacity = '1';
    });
  }, 600);
});


// -----------------------------------------------------
// 4. 점수판 렌더링 & 주사위 초기화
// -----------------------------------------------------


const categories = [
  { id: 'aces', krName: '에이스', enName: `${getDiceSvg(1)} Aces` },
  { id: 'deuces', krName: '듀스', enName: `${getDiceSvg(2)} Deuces` },
  { id: 'threes', krName: '쓰리스', enName: `${getDiceSvg(3)} Threes` },
  { id: 'fours', krName: '포스', enName: `${getDiceSvg(4)} Fours` },
  { id: 'fives', krName: '파이브스', enName: `${getDiceSvg(5)} Fives` },
  { id: 'sixes', krName: '식스', enName: `${getDiceSvg(6)} Sixes` },
  { id: 'bonus', krName: '보너스', enName: 'Bonus (0/63)', isDivider: true },
  { id: 'choice', krName: '초이스', enName: `${getSpecialSvg('choice')} Choice` },
  { id: '4oak', krName: '포카인드', enName: `${getSpecialSvg('4oak')} 4 of a Kind` },
  { id: 'fullhouse', krName: '풀하우스', enName: `${getSpecialSvg('fullhouse')} Full House` },
  { id: 's-straight', krName: '스몰 스트레이트', enName: `${getSpecialSvg('s-straight')} S. Straight` },
  { id: 'l-straight', krName: '라지 스트레이트', enName: `${getSpecialSvg('l-straight')} L. Straight` },
  { id: 'yacht', krName: '요트', enName: `${getSpecialSvg('yacht')} Yacht` }
];

function getActivePlayerCount() {
  if (window.matchTotalPlayers && window.matchTotalPlayers >= 2) {
    return window.matchTotalPlayers;
  }
  if (window.isMultiplayer && window.lobbyPlayers && window.lobbyPlayers.length >= 2) {
    return window.lobbyPlayers.length;
  }
  return 2;
}

function initScoreboard() {
  const count = getActivePlayerCount();
  const players = (window.initialMatchPlayers && window.initialMatchPlayers.length > 0)
    ? window.initialMatchPlayers
    : (window.lobbyPlayers || []);
  const structurePlan = createScoreboardStructurePlan({
    playerCount: count,
    mode: gameMode || window.pendingLobbyMode || 'normal',
    players
  });
  const showRight = structurePlan.showRightCategory;

  // 1. 헤더 (thead) 동적 생성
  const thead = document.querySelector('#score-table thead');
  if (thead) {
    let headerHtml = '<tr><th class="col-cat highlight-dark">Categories</th>';
    for (let i = 1; i <= count; i++) {
      const pName = structurePlan.playerNames[i - 1];
      headerHtml += `<th id="p${i}-name" class="col-player" title="${pName}"><div class="name-text" title="${pName}">${pName}</div></th>`;
    }
    if (showRight) {
      headerHtml += '<th class="col-cat highlight-dark">Categories</th>';
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;
  }

  // 2. 바디 (tbody) 동적 생성
  els.scoreTbody.innerHTML = '';
  categories.forEach(cat => {
    const tr = document.createElement('tr');
    let cellsHtml = '';

    if (cat.isDivider && cat.id === 'bonus') {
      const bonusTitle = structurePlan.initialBonusTitle;
      cellsHtml += `<th class="col-cat" id="cat-title-left-${cat.id}">${bonusTitle}</th>`;
      for (let i = 1; i <= count; i++) {
        const initText = structurePlan.initialBonusCellText;
        cellsHtml += `<td id="p${i}-${cat.id}" style="font-weight: bold; color: #888;">${initText}</td>`;
      }
      if (showRight) {
        cellsHtml += `<th class="col-cat" id="cat-title-right-${cat.id}">${bonusTitle}</th>`;
      }
      tr.style.backgroundColor = '#ddd';
    } else {
      cellsHtml += `<th class="col-cat" id="cat-title-left-${cat.id}">${cat.enName}</th>`;
      for (let i = 1; i <= count; i++) {
        cellsHtml += `<td class="score-cell" id="p${i}-${cat.id}"></td>`;
      }
      if (showRight) {
        cellsHtml += `<th class="col-cat" id="cat-title-right-${cat.id}">${cat.enName}</th>`;
      }
    }
    tr.innerHTML = cellsHtml;
    els.scoreTbody.appendChild(tr);
  });

  // 3. 총합(TOTAL) 렌더링
  const totalTr = document.createElement('tr');
  totalTr.style.borderTop = '1px solid var(--border-color)';
  let totalHtml = '<th class="col-cat highlight-dark" style="font-weight: bold;">TOTAL</th>';
  for (let i = 1; i <= count; i++) {
    totalHtml += `<td id="p${i}-total" class="score-cell filled" style="font-weight: bold; color: #222; background-color: #ffffff; border-radius: 0;">0</td>`;
  }
  if (showRight) {
    totalHtml += '<th class="col-cat highlight-dark" style="font-weight: bold;">TOTAL</th>';
  }
  totalTr.innerHTML = totalHtml;
  els.scoreTbody.appendChild(totalTr);
}

function updateScoreboard() {
  const count = getActivePlayerCount();
  const viewModel = createScoreboardViewModel({
    categories,
    playerCount: count,
    scores,
    activeAugments,
    yachtBankState,
    questProgress,
    globalBonus,
    equivalentExchangePenalty,
    upperBonusThreshold,
    currentPlayer,
    bountyHunterTarget
  });

  categories.forEach(cat => {
    if (cat.isDivider && cat.id === 'bonus') {
      const titleLeft = document.getElementById(`cat-title-left-${cat.id}`);
      const titleRight = document.getElementById(`cat-title-right-${cat.id}`);
      if (titleLeft) titleLeft.textContent = viewModel.bonus.titleLeft;
      if (titleRight) titleRight.textContent = viewModel.bonus.titleRight;

      for (let p = 1; p <= count; p++) {
        const cell = document.getElementById(`p${p}-${cat.id}`);
        if (cell) cell.innerHTML = viewModel.bonus.cells[p].html;
      }
    } else {
      for (let p = 1; p <= count; p++) {
        const cell = document.getElementById(`p${p}-${cat.id}`);
        if (!cell) continue;
        const cellModel = viewModel.scoreCells[cat.id][p];
        if (cellModel.kind === 'filled') {
            cell.innerHTML = cellModel.html;
            cell.className = 'score-cell filled';
            cell.style.color = '';
            cell.title = '';
        } else if (!cell.classList.contains('suggested')) {
          cell.textContent = cellModel.text;
          cell.style.color = cellModel.kind === 'bank' ? '#888' : '';
          cell.className = 'score-cell';
          cell.title = '';
          }
      }

      // 현상금 사냥꾼 타겟은 점수 기입 칸 대신 족보 제목 칸에 표시한다.
      ['left', 'right'].forEach(side => {
        const title = document.getElementById(`cat-title-${side}-${cat.id}`);
        if (!title) return;
        if (!title.classList.contains('fade-out-target')) {
          title.classList.toggle('bounty-target-highlight', viewModel.bountyTitles[cat.id][side]);
        }
      });
    }
  });

  for (let p = 1; p <= count; p++) {
    const pTotalEl = document.getElementById(`p${p}-total`);
    if (pTotalEl) pTotalEl.innerHTML = viewModel.totals[p].html;
  }
}

initScoreboard();
updateScoreboard();
updateTurnTimerUI();

// 3D 주사위 엔진 초기화
let diceEngine;

setTimeout(async () => {
  diceEngine = new DiceEngine("#dice-board-area");

  diceEngine.onDieClick = (val, isKept, dieIndex) => {
    // 로비 화면일 경우 점수 연산 생략 (클릭/킵만 작동)
    if (els.appContainer?.classList.contains('mode-select-state')) return;

    if (isAuthoritativeOnlineMatch()) {
      const die = diceEngine.diceArray[dieIndex];
      if (die?.serverId !== undefined) {
        networkEngine.sendMessage({ type: 'game_keep', dieId: die.serverId, isKept });
      }
      return;
    }

    // 상태 배열을 엔진과 동기화 (이상한 주사위는 족보 계산 배열에서 제외)
    activeDice = diceEngine.diceArray.filter(d => !d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);
    keptDice = diceEngine.diceArray.filter(d => d.isKept && d.config.type !== 'weird').map(d => d.value).sort((a, b) => a - b);

    if (window.isMultiplayer) {
      networkEngine.sendMessage({ type: 'sync_keep', dieIndex, isKept });
    }

    const allDice = [...keptDice, ...activeDice];
    updateScorePreviews();
  };

  diceEngine.onPhysicsUpdate = null; // 매 프레임 스트리밍 패킷 전송 비활성화

  await diceEngine.ready;
  diceBoxReady = true;
  removeMainSkeletons();
  if (els.appContainer?.classList.contains('mode-select-state')) {
    els.btnRoll.disabled = false;
    if (els.gameStatus) els.gameStatus.textContent = '로비 (자유 연습)';
    if (els.rollsLeft) els.rollsLeft.textContent = '무한 굴리기';
    diceEngine.allowKeep = true;
  }


  if (gameMode !== 'none') {
    updateRollsUI();
  } else {
    els.btnRoll.disabled = false;
  }
}, 100);

function getCurrentScoringDiceValues(player) {
  const allDice = [...keptDice, ...activeDice];
  const bankActive = activeAugments[player]?.yacht === 'yacht-bank'
    && yachtBankState[player]?.turnsLeft > 0;
  if (bankActive) return [...activeDice];
  return allDice.length > 5 ? [...keptDice] : allDice;
}

function updateQuestProgress(player, catId, scoreObj) {
  const p = (typeof player === 'string' && player.startsWith('p')) ? parseInt(player.slice(1), 10) : Number(player || 1);
  if (!questProgress[p]) questProgress[p] = {};
  const prog = questProgress[p];
  const s = scores[p] || {};
  const myAugments = getPlayerAugments(p);

  if (catId && myAugments.includes('no-time-to-waste') && !prog.noTimeRewarded && !prog.noTimeFailed && isLocalAugmentProgressPlayer(p)) {
    const actualScore = typeof scoreObj === 'object' ? Number(scoreObj?.score) || 0 : Number(scoreObj) || 0;
    const flags = augmentProgressSession.achievementState.flags;
    if (rollsLeft === 2 && actualScore >= 15) flags.noTimeHighScoreCount = (flags.noTimeHighScoreCount || 0) + 1;
    else flags.noTimeHighScoreFailed = true;
  }

  const opponent = p === 1 ? 2 : 1;
  const plan = createQuestProgressPlan({
    augmentIds: myAugments.filter((augmentId) => !['bounty-hunter', 'prophet'].includes(augmentId)),
    progress: prog,
    category: catId,
    score: scoreObj,
    scores: s,
    categoryIds: SCORE_CATEGORIES,
    opponentScores: scores[opponent] || {},
    scoringDiceValues: getCurrentScoringDiceValues(p),
    currentRound,
    isFirstRollScore: rollsLeft === 2,
    noTimeProgressField: 'noTimeCount',
    fastStraightSatisfied: s['s-straight']?.score > 0 && s['l-straight']?.score > 0,
    copycatScoreValue: typeof scoreObj === 'object' ? scoreObj?.score : scoreObj,
    copycatOpponentScoreValue: typeof scores[opponent]?.[catId] === 'object'
      ? scores[opponent][catId]?.score
      : scores[opponent]?.[catId],
    evaluateNozdormu: true
  });
  if (plan.facts.twoHouseholdsChoiceAtLeast20 !== undefined) {
    plan.progress.twoHouseholdsChoiceAtLeast20 = plan.facts.twoHouseholdsChoiceAtLeast20;
  }
  questProgress[p] = plan.progress;

  const questNames = {
    'every-little': '티끌 모아 태산',
    'fast-straight': '재빠른 스트레이트',
    'no-time-to-waste': '낭비할 시간 없다',
    'two-households': '두 집 살림',
    holdout: '알박기',
    'cautious-straight': '신중한 스트레이트',
    copycat: '카피캣',
    doubling: '더블링',
    nozdormu: '노즈도르무'
  };
  for (const reward of plan.rewards) {
    if (reward.id === 'step-by-step') {
      addGameLog({ type: 'system', message: `${getPlayerLabel(player)}이 [차근차근] 퀘스트를 달성하여 상단 보너스가 +55점으로 강화되었습니다!` }, 'system', window.isMultiplayer, player);
      continue;
    }
    addGameLog({ type: 'system', message: `${getPlayerLabel(p)}이 [${questNames[reward.id]}] 퀘스트를 달성하여 보너스 +${reward.points}점을 획득했습니다!` }, 'system', window.isMultiplayer, p);
    if (!isLocalAugmentProgressPlayer(p)) continue;
    if (reward.id === 'fast-straight' && currentRound <= 6) recordAchievementProgress(augmentProgressSession, 'fast-straight-speed');
    if (reward.id === 'no-time-to-waste') {
      const flags = augmentProgressSession.achievementState.flags;
      if (!flags.noTimeHighScoreFailed && flags.noTimeHighScoreCount >= 3) recordAchievementProgress(augmentProgressSession, 'no-time-to-waste-careful');
    }
    if (reward.id === 'two-households' && plan.progress.twoHouseholdsChoiceAtLeast20) recordAchievementProgress(augmentProgressSession, 'two-households-clone');
    if (reward.id === 'holdout' && currentRound === 12) augmentProgressSession.achievementState.flags.holdoutTurn12 = true;
    if (reward.id === 'copycat' && plan.facts.copycatSpecialCleared) recordAchievementProgress(augmentProgressSession, 'copycat-perfect');
    if (reward.id === 'doubling') {
      const highScoreCounts = (plan.facts.doublingValues || []).filter((value) => value >= 20).reduce((counts, value) => {
        counts[value] = (counts[value] || 0) + 1;
        return counts;
      }, {});
      if (Object.values(highScoreCounts).some((count) => count >= 2)) recordAchievementProgress(augmentProgressSession, 'doubling-echo');
    }
    if (reward.id === 'nozdormu' && !augmentProgressSession.achievementState.flags.nozdormuScratched) recordAchievementProgress(augmentProgressSession, 'nozdormu-no-scratch');
  }
}

// -----------------------------------------------------
// 5. 디버그 도구
// -----------------------------------------------------
function applyLocalAugmentAction(player, augmentId) {
  if (player !== currentPlayer || diceEngine?.physicsActive) return false;

  if (augmentId === 'coin-toss') {
    if (rollsLeft === 3 || coinTossState[player]?.used) return false;
    const heads = Array.from({ length: 3 }, () => Math.random() < 0.5 ? 0 : 1).reduce((sum, value) => sum + value, 0);
    coinTossState[player] = { used: true, heads };
    if (heads === 0) globalBonus[player] = (globalBonus[player] || 0) - 5;
    else if (heads === 1) {
      const lowest = diceEngine.diceArray.reduce((found, die) => !found || die.value < found.value ? die : found, null);
      if (lowest) lowest.value = 6;
    } else if (heads === 2) rollsLeft++;
    else upperBonusThreshold[player] = Math.min(upperBonusThreshold[player] || 63, 57);
  } else if (augmentId === 'gambit') {
    if (gambitState[player] !== 'ready' || rollsLeft !== 3) return false;
    gambitState[player] = 'penalty';
  } else if (augmentId === 'double-down') {
    if (doubleDownState[player] !== 'ready' || currentRound < 9 || rollsLeft !== 3) return false;
    doubleDownState[player] = 'active';
  } else if (augmentId === 'dice-alchemy') {
    if (rollsLeft === 3 || diceAlchemyUsed[player]) return false;
    diceAlchemyUsed[player] = true;
    diceEngine.diceArray.forEach((die) => {
      if (!die.isKept) die.value = Math.max(1, die.value - 1);
    });
  } else return false;

  const diceState = diceEngine.diceArray.map((die, index) => ({
    id: die.serverId ?? index + 1,
    type: die.config?.type || 'normal',
    promotionLevel: die.config?.promotionLevel || 0,
    value: die.value,
    kept: die.isKept
  }));
  diceEngine.forceDiceState(diceState);
  keptDice = diceEngine.diceArray.filter((die) => die.isKept && die.config.type !== 'weird').map((die) => die.value).sort((a, b) => a - b);
  activeDice = diceEngine.diceArray.filter((die) => !die.isKept && die.config.type !== 'weird').map((die) => die.value).sort((a, b) => a - b);
  updateRollsUI();
  updateScorePreviews();
  updateAugmentSidebar(player);
  return true;
}

// 좌측 증강 섹션(UI) 업데이트 함수
function getQuestProgressText(player, augmentId) {
  const p = (typeof player === 'string' && player.startsWith('p')) ? parseInt(player.slice(1), 10) : Number(player || 1);
  const prog = questProgress[p] || {};
  const s = scores[p] || {};
  let questLines = [];
  let status = 'in-progress';

  const line = (text, isDone, isFailed = false) => {
    const isInactive = isFailed || status === 'failed' || isDone;
    const opacity = isDone ? '0.7' : '0.6';
    const content = isInactive
      ? `<span style="text-decoration: line-through; opacity: ${opacity};"><strong><u>퀘스트</u></strong>: ${text}</span>`
      : `<strong><u>퀘스트</u></strong>: ${text}`;
    return `<div style="margin-top: 4px;">${content}</div>`;
  };

  switch (augmentId) {
    case 'fast-straight':
      if (prog.fastStraightRewarded) status = 'completed';
      else if (currentRound > 8 && !(s['s-straight']?.score > 0 && s['l-straight']?.score > 0)) status = 'failed';
      questLines.push(line('8턴 안에 S. Straight 기입', s['s-straight']?.score > 0));
      questLines.push(line('8턴 안에 L. Straight 기입', s['l-straight']?.score > 0));
      break;

    case 'no-time-to-waste':
      const count = prog.noTimeCount || 0;
      if (prog.noTimeRewarded) status = 'completed';
      else if (prog.noTimeFailed) status = 'failed';
      questLines.push(line(`리롤 없이 족보 기입 (${count}/3)`, count >= 3));
      break;

    case 'step-by-step':
      const stepCount = prog.stepCount || 0;
      if (prog.stepRewarded) status = 'completed';
      else if (prog.stepFailed) status = 'failed';
      questLines.push(line(`Aces부터 Sixes까지 순서대로 기입 (${stepCount}/6)`, stepCount >= 6));
      break;

    case 'two-households':
      if (prog.twoHouseholdsRewarded && s['fullhouse']?.score > 0) status = 'completed';
      questLines.push(line('Choice 족보를 Full House 형태로 기입', prog.twoHouseholdsRewarded));
      questLines.push(line('Full House 족보 기입', s['fullhouse']?.score > 0));
      break;

    case 'holdout':
      if (prog.holdoutRewarded) status = 'completed';
      else if (s['fullhouse'] !== undefined && !prog.holdoutRewarded) status = 'failed';
      questLines.push(line('9턴 이후에 Full House 기입', prog.holdoutRewarded));
      break;

    case 'cautious-straight':
      if (prog.cautiousRewarded) status = 'completed';
      else if (prog.cautiousFailed) status = 'failed';
      questLines.push(line('S. Straight를 L. Straight 보다 먼저 기입', s['s-straight'] !== undefined && !prog.cautiousFailed));
      questLines.push(line('L. Straight 기입', prog.cautiousRewarded));
      break;

    case 'every-little':
      const elCount = prog.everyLittleCount || 0;
      if (prog.everyLittleRewarded) status = 'completed';
      questLines.push(line(`1의 눈을 포함하여 족보 기입 (${elCount}/7)`, elCount >= 7));
      break;

    case 'copycat':
      if (prog.copycatRewarded) status = 'completed';
      const cCount = prog.copycatCount || 0;
      if (prog.copycatSpecialCleared) {
        questLines.push(line('이전 턴에 상대방이 기입한 족보와 동일한 족보 기입 (조건 달성!)', true));
      } else {
        questLines.push(line(`이전 턴에 상대방이 기입한 족보와 동일한 족보 기입 (${cCount}/3)`, prog.copycatRewarded));
      }
      break;

    case 'doubling':
      if (prog.doublingRewarded) status = 'completed';
      questLines.push(line(`동일한 점수로 족보를 두 번 등록 (${prog.doublingRewarded ? '1/1' : '0/1'})`, prog.doublingRewarded));
      break;

    case 'nozdormu':
      if (prog.nozdormuRewarded) status = 'completed';
      const targetR = prog.nozdormuTargetRound || (currentRound <= 5 ? 5 : (currentRound <= 8 ? 8 : 12));
      const rem = Math.max(0, targetR - currentRound + 1);
      questLines.push(line(`턴 타이머가 15초인 상태로 플레이하기 (${rem}턴 남음!)`, prog.nozdormuRewarded));
      break;

    case 'yacht-bank':
      const bankSt = yachtBankState[player] || { turnsLeft: 3, accumulatedScore: 0, completed: false };
      const isDone = bankSt.completed || (bankSt.initialized && bankSt.turnsLeft === 0);
      if (isDone) status = 'completed';
      questLines.push(line(`족보를 등록하기 전 킵 존에 주사위를 넣어 보너스 점수를 적립하세요. (${bankSt.turnsLeft}턴 남음!)`, isDone));
      break;

    case 'bounty-hunter':
      const bhProg = bountyHunterProgress[p] || { count: 0, penaltyCount: 0 };
      const isCompleted = bhProg.count >= 3;
      if (isCompleted) {
        status = 'completed';
        questLines.push(line(`타겟으로 지정된 족보를 3회 기입하기 (${bhProg.count}/3)`, true));
      } else {
        const targetName = bountyHunterTarget[p] ? getCategoryDisplayName(bountyHunterTarget[p], p) : '미지정';
        questLines.push(line(`타겟으로 지정된 족보를 3회 기입하기 (${bhProg.count}/3)<br>└ 현재 타겟: <strong style="color: #d4af37;">${targetName}</strong>`, false));
      }
      break;

    case 'prophet': {
      const prophet = authoritativeGameState?.prophetState?.[p] || prophetState[p] || { remaining: 0, numbers: [], successes: 0 };
      if (prophet.remaining <= 0) status = 'completed';
      const numbers = prophet.numbers.length ? prophet.numbers.join(', ') : '대기 중';
      questLines.push(line(`제시 숫자 [${numbers}]와 같은 점수 기입 (${prophet.remaining}턴 남음)`, prophet.remaining <= 0));
      break;
    }
  }

  let resultHTML = '';
  if (status === 'completed') {
    resultHTML += '<div style="color: #D4AF37; font-weight: bold; margin-top: 2px;">퀘스트 성공</div>';
  } else if (status === 'failed') {
    resultHTML += '<div style="color: #e74c3c; font-weight: bold; margin-top: 2px;">퀘스트 실패</div>';
  } else {
    resultHTML += '<div style="color: #3498db; font-weight: bold; margin-top: 2px;">퀘스트 진행 중</div>';
  }

  resultHTML += '<hr style="margin: 4px 0 8px 0; border: none; border-top: 1px dashed #ccc;">';
  resultHTML += questLines.join('');

  return resultHTML;
}


// -----------------------------------------------------
let isViewingOpponentAugments = false;

function getAugmentSidebarTargetPlayer(explicitPlayer = null) {
  let basePlayer;
  if (window.isMultiplayer) {
    // 온라인 멀티플레이 모드: 턴 전환/인자 전달과 상관없이 항상 내 클라이언트(window.myPlayerIndex) 기준 고정
    basePlayer = window.myPlayerIndex || 1;
  } else {
    // 핫시트 모드: 명시적 인자 또는 현재 턴 플레이어(currentPlayer) 기준 턴 스위칭
    basePlayer = explicitPlayer || (typeof currentPlayer !== 'undefined' ? currentPlayer : 1);
  }

  if (isViewingOpponentAugments) {
    return basePlayer === 1 ? 2 : 1;
  }
  return basePlayer;
}

window.updateAugmentSidebar = function (player) {
  const targetPlayer = getAugmentSidebarTargetPlayer(player);
  const isOpponent = isViewingOpponentAugments;

  const btnToggle = document.getElementById('btn-toggle-opponent-augments');
  const labelTarget = document.getElementById('aug-view-target-label');
  const titleElem = document.querySelector('.aug-title-text');

  if (btnToggle) {
    if (isOpponent) {
      btnToggle.classList.add('active');
      btnToggle.setAttribute('title', '이전 증강 보기');
    } else {
      btnToggle.classList.remove('active');
      btnToggle.setAttribute('title', '상대방 증강 보기');
    }
  }
  if (!window.isMultiplayer) {
    if (titleElem) {
      titleElem.textContent = `Augments (P${targetPlayer})`;
    }
    if (labelTarget) {
      labelTarget.textContent = '';
    }
  } else {
    if (titleElem) {
      titleElem.textContent = 'Augments';
    }
    if (labelTarget) {
      labelTarget.textContent = isOpponent ? '(상대)' : '';
    }
  }

  const augments = getPlayerAugments(targetPlayer);
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`aug-slot-${i}`);
    if (!slot) continue;

    if (i < augments.length) {
      const augmentId = augments[i];
      const augment = augmentDefinitions[augmentId];
      if (!augment) continue;
      const augInfo = augmentData.find(a => a.augmentId === augmentId) ||
        augmentData.find(a => a.name.includes(augment.name) || (a.mark && augment.enName && a.mark === augment.enName)) || {};
      const svgIcon = getVariantSvg(augmentId);
      let description = augInfo.description || augment.name + ' 증강이 적용되었습니다.';

      let extraHTML = '';
      if (augment.isQuest && typeof getQuestProgressText === 'function') {
        extraHTML = `<div class="aug-quest-container" style="margin-top: auto; width: 100%; padding-top: 6px;">${getQuestProgressText(targetPlayer, augmentId)}</div>`;
      } else if (augmentId === 'momentum') {
        const mState = momentumState[targetPlayer] || 'ready';
        if (mState === 'active') {
          extraHTML = `<div style="margin-top: auto; width: 100%; padding-top: 6px; color: #27ae60; font-weight: bold; text-align: left;">이번 턴에 발동합니다!</div>`;
        } else if (mState === 'used') {
          const gained = momentumGainedScore[targetPlayer] || 0;
          extraHTML = `<div style="margin-top: auto; width: 100%; padding-top: 6px; color: #888; font-size: 0.85em; font-style: italic; text-align: left;">이 증강은 소모되었습니다 (${gained}점 획득함)</div>`;
        }
      } else if (['lucky-sevens', 'perfect-squares', 'gambler', 'blackjack-21', 'high-dice'].includes(augmentId)) {
        const allDice = [...keptDice, ...activeDice];
        const currentDiceSum = allDice.length > 0 ? allDice.reduce((a, b) => a + b, 0) : 0;
        extraHTML = `<div class="aug-sum-container" style="margin-top: auto; width: 100%; padding-top: 6px; font-size: 0.9em; text-align: left;"><strong><u>현재 눈</u></strong>: ${currentDiceSum}</div>`;
      } else if (augmentId === 'table-flip') {
        const isUsed = playerTableFlipUsed[targetPlayer];
        extraHTML = `
          <div class="table-flip-container" style="margin-top: auto; width: 100%; padding-top: 6px; display: flex; align-items: center; gap: 8px;">
            <button class="btn-table-flip ${isUsed ? 'used' : ''}">
              ${isUsed ? '판 뒤집음' : '판 뒤집기!'}
            </button>
            <span class="table-flip-warning" style="display: none;">이미 판을 한 번 뒤집었습니다!</span>
          </div>
        `;
      } else if (augmentId === 'equivalent-exchange') {
        const usesLeft = equivalentExchangeUses[targetPlayer] !== undefined ? equivalentExchangeUses[targetPlayer] : 3;
        extraHTML = `<div class="ee-uses-container" style="margin-top: auto; width: 100%; padding-top: 6px; font-size: 0.9em; text-align: left; font-weight: bold; color: #c084fc;">${usesLeft}번 남음!</div>`;
      } else if (['coin-toss', 'gambit', 'double-down', 'dice-alchemy'].includes(augmentId)) {
        const labels = {
          'coin-toss': '코인 토스!',
          gambit: '갬빗 시도!',
          'double-down': '더블 다운!',
          'dice-alchemy': '연금술 사용!'
        };
        const used = augmentId === 'coin-toss' ? (authoritativeGameState?.coinTossState?.[targetPlayer]?.used ?? coinTossState[targetPlayer]?.used)
          : augmentId === 'gambit' ? (authoritativeGameState?.gambitState?.[targetPlayer] ?? gambitState[targetPlayer]) !== 'ready'
            : augmentId === 'double-down' ? (authoritativeGameState?.doubleDownState?.[targetPlayer] ?? doubleDownState[targetPlayer]) !== 'ready'
              : (authoritativeGameState?.diceAlchemyUsed?.[targetPlayer] ?? diceAlchemyUsed[targetPlayer]);
        const buttonClasses = `btn-table-flip btn-new-augment-action ${used ? 'used' : ''}`;
        extraHTML = `<button class="${buttonClasses}" data-augment-action="${augmentId}" ${used ? 'disabled' : ''}>${used ? '사용 완료' : labels[augmentId]}</button>`;
      } else if (augmentId === 'piggy-bank') {
        const piggy = authoritativeGameState?.piggyBankState?.[targetPlayer] || piggyBankState[targetPlayer] || { balance: 0, payouts: 0 };
        extraHTML = `<div style="margin-top:auto;font-weight:bold;">저금 ${piggy.balance}/12 · 인출 ${piggy.payouts}회</div>`;
      } else if (augmentId === 'duel') {
        const duel = authoritativeGameState?.duelState?.[targetPlayer] || duelState[targetPlayer];
        const duelStatus = !duel?.resolved
          ? '결투 중!'
          : duel.ownerScore > duel.opponentScore
            ? '결투 승리!'
            : duel.ownerScore < duel.opponentScore ? '결투 패배' : '결투 무승부';
        extraHTML = `<div style="margin-top:auto;font-weight:bold;">${duelStatus}</div>`;
      } else if (augmentId === 'random-box') {
        const awarded = authoritativeGameState?.randomBoxAward?.[targetPlayer] || randomBoxAward[targetPlayer];
        const awardedName = augmentDefinitions[awarded]?.name || '추첨 대기';
        extraHTML = `<div style="margin-top:auto;font-weight:bold;">획득: ${awardedName}</div>`;
      }

      slot.classList.add('filled');
      if (augmentId === 'momentum' && momentumState[targetPlayer] === 'used') {
        slot.style.opacity = '0.65';
      } else {
        slot.style.opacity = '1';
      }

      slot.innerHTML = `
        <div class="aug-slot-filled" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
          <div class="aug-slot-header">${svgIcon} <span class="aug-slot-name">${augInfo.name || augment.name}</span></div>
          <div class="aug-slot-desc" style="flex: 1; overflow-y: auto; min-height: 0;">${description}</div>
          ${extraHTML}
        </div>
      `;

      if (augmentId === 'table-flip') {
        const btnFlip = slot.querySelector('.btn-table-flip');
        const warnText = slot.querySelector('.table-flip-warning');

        if (btnFlip) {
          btnFlip.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isMyTurn = !window.isMultiplayer || targetPlayer === window.myPlayerIndex;
            if (!isMyTurn || targetPlayer !== currentPlayer) return;

            if (playerTableFlipUsed[targetPlayer]) {
              if (warnText) {
                const shakeAnims = ['shake3d-1', 'shake3d-2', 'shake3d-3', 'shake3d-4'];
                const randomShake = shakeAnims[Math.floor(Math.random() * shakeAnims.length)];
                warnText.style.display = 'inline-block';
                warnText.style.animation = 'none';
                void warnText.offsetWidth; // reflow
                warnText.style.animation = `${randomShake} 0.5s ease-in-out`;
                if (window.tableFlipWarnTimeout) clearTimeout(window.tableFlipWarnTimeout);
                window.tableFlipWarnTimeout = setTimeout(() => {
                  warnText.style.display = 'none';
                }, 2000);
              }
              return;
            }

            if (rollsLeft >= 3 || !diceEngine || diceEngine.physicsActive) return;

            if (isAuthoritativeOnlineMatch()) {
              btnFlip.disabled = true;
              networkEngine.sendMessage({ type: 'game_table_flip' });
              return;
            }

            if (isLocalAugmentProgressPlayer(targetPlayer)) {
              const achievementState = augmentProgressSession.achievementState;
              achievementState.tableFlipDiceCount = diceEngine.diceArray.filter((die) => !die.isKept).length;
              achievementState.flags.tableFlipLateBehind = currentRound >= 9 && Boolean(achievementState.flags.tableFlipBehindAtRound9);
            }
            playerTableFlipUsed[targetPlayer] = true;
            btnFlip.classList.add('used');
            btnFlip.textContent = '판 뒤집음';

            // 5시 방향 주먹 내리침 덜컹 연출 및 판 뒤집기 타격음 재생 (약 0.07초 타격점 offset 스킵 재생)
            if (diceEngine) {
              diceEngine.playCardboardHitSound(0.07, 0.8);
            }
            const diceBoardElem = document.getElementById('dice-board-area');
            if (diceBoardElem) {
              diceBoardElem.classList.remove('fist-impact-anim');
              void diceBoardElem.offsetWidth;
              diceBoardElem.classList.add('fist-impact-anim');
              setTimeout(() => {
                diceBoardElem.classList.remove('fist-impact-anim');
              }, 750);
            }

            pauseTurnTimer();
            els.btnRoll.disabled = true;

            if (window.isMultiplayer && networkEngine) {
              networkEngine.sendMessage({ type: 'table_flip', player: targetPlayer });
            }

            addGameLog({ type: 'system', message: `[Table Flip] Player ${targetPlayer}가 판 뒤집기를 사용하여 주사위를 솟구쳐 올렸습니다!` }, 'system', window.isMultiplayer, targetPlayer);

            const flipConfigs = diceEngine.diceArray.map((die) => ({
              ...die.config,
              type: die.config?.type || 'normal'
            }));
            const flipRoll = await rollLocalDice(flipConfigs, { action: 'tableFlip' });
            if (flipRoll.source === 'cancelled') return;

            diceEngine.diceArray.forEach(die => die.isKept = false);
            keptDice = [];
            activeDice = diceEngine.diceArray.filter(d => d.config?.type !== 'weird').map(d => d.value).sort((a, b) => a - b);

            addGameLog({ type: 'roll-result', player: targetPlayer, meta: { values: activeDice } }, 'roll-result', window.isMultiplayer, targetPlayer);
            diceEngine.arrangeAll(true);

            updateScorePreviews();

            resumeTurnTimer();
            if (diceEngine) diceEngine.isRollSettling = false;
            updateRollsUI();
          });
        }
      }
      const actionButton = slot.querySelector('.btn-new-augment-action');
      if (actionButton) {
        actionButton.addEventListener('click', (event) => {
          event.stopPropagation();
          if (targetPlayer !== currentPlayer) return;
          if (isAuthoritativeOnlineMatch()) {
            if (targetPlayer !== Number(window.myPlayerIndex)) return;
            actionButton.disabled = true;
            networkEngine.sendMessage({ type: 'game_augment_action', augmentId: actionButton.dataset.augmentAction });
          } else if (applyLocalAugmentAction(targetPlayer, actionButton.dataset.augmentAction)) {
            actionButton.disabled = true;
          }
        });
      }
    } else {
      slot.classList.remove('filled');
      let roundText = i === 0 ? "1턴" : (i === 1 ? "6턴" : "9턴");
      const emptyText = isOpponent ? `${roundText}에 선택된 증강입니다.` : `${roundText}에 증강을 선택할 수 있습니다.`;
      slot.innerHTML = `
        <div class="aug-empty-icon">
          <svg viewBox="0 0 24 24" width="1em" height="1em">
            <path d="M8 9 V7 a4 4 0 0 1 8 0 V9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="5" y="9" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <div class="aug-empty-text">${emptyText}</div>
      `;
    }
  }
};

uiEventControllers.gameplay.bind(document.getElementById('btn-toggle-opponent-augments'), 'click', () => {
  isViewingOpponentAugments = !isViewingOpponentAugments;
  if (typeof updateAugmentSidebar === 'function') {
    updateAugmentSidebar();
  }
});

window.applyAugment = function (player, augmentId, isRemote = false) {
  const plan = createAugmentApplicationPlan({
    definitions: augmentDefinitions,
    augmentId,
    activeAugments: activeAugments[player],
    scores: scores[player],
    currentRound,
    upperBonusThreshold: upperBonusThreshold[player]
  });
  if (plan.status !== 'ready') return;
  const augment = plan.definition;
  const targetCat = plan.target;

  // 이미 해당 족보 슬롯에 동일한 증강이 적용된 경우 중복 실행 및 중복 로그 생성 방지
  if (!isRemote && window.isMultiplayer && networkEngine) {
    networkEngine.sendMessage({
      type: 'apply_augment',
      player,
      augmentId
    });
  }

  // 이미 기입된 족보 칸을 덮어씌워 선택한 경우 점수 삭제 및 추가 턴 부여
  if (plan.clearsScore) {
    delete scores[player][targetCat];
    extraTurns[player] = (extraTurns[player] || 0) + 1;

    const catName = getCategoryDisplayName(targetCat, player);
    addGameLog({
      type: 'system',
      message: `${getPlayerLabel(player)}의 이미 기입된 [${catName}] 족보가 공백으로 초기화되었으며, 추가 턴(+1턴)을 획득했습니다!`
    }, 'system', window.isMultiplayer, player);
  }

  activeAugments[player][targetCat] = augmentId;

  if (plan.resetEquivalentExchange) {
    equivalentExchangeUses[player] = 3;
    equivalentExchangePenalty[player] = 0;
  }

  const augInfo = augmentData.find(a => a.name.includes(augment.name) || (a.mark && augment.enName && a.mark === augment.enName)) || {};
  addGameLog({ type: 'augment-action', player, meta: { augmentId, name: augInfo.name || augment.name } }, 'augment-action', window.isMultiplayer, player);

  // 더블 라지 스트레이트 등 특수 효과 즉시 적용
  if (plan.upperBonusThreshold !== null) upperBonusThreshold[player] = plan.upperBonusThreshold;

  if (plan.nozdormuTargetRound !== null) {
    if (!questProgress[player]) questProgress[player] = {};
    if (!questProgress[player].nozdormuTargetRound) {
      questProgress[player].nozdormuTargetRound = plan.nozdormuTargetRound;
    }
  }

  if (plan.resetBountyHunter) {
    bountyHunterProgress[player] = { count: 0, penaltyCount: 0 };
    bountyHunterTarget[player] = null;
    bountyHunterAcquiredRound[player] = currentRound;
  }

  if (plan.resetNoTime) {
    Object.assign(questProgress[player], {
      noTimeCount: 0,
      noTimeFailed: false,
      noTimeRewarded: false
    });
  }

  if (plan.resetDuel) {
    duelState[player] = { round: currentRound, ownerScore: null, opponentScore: null, resolved: false };
  }

  if (plan.resetRandomBox) randomBoxAward[player] = null;

  if (plan.resetProphet) {
    prophetState[player] = { remaining: 3, numbers: [], successes: 0 };
  }

  if (plan.resetPiggyBank) {
    piggyBankState[player] = { balance: 0, payouts: 0 };
  }

  if (plan.checkDoubling) {
    updateQuestProgress(player, null, null);
  }

  if (plan.recordPromotionRound) {
    promotionAcquiredRound[player] = currentRound;
  }

  if (plan.resetYachtBank) {
    yachtBankState[player] = { turnsLeft: 3, accumulatedScore: 0, initialized: false, completed: false };
  }

  // 족보 제목 UI 변경 (선택된 플레이어 방향만)
  const targetTh = document.getElementById(player === 1 ? `cat-title-left-${augment.target}` : `cat-title-right-${augment.target}`);

  if (targetTh) {
    const svgIcon = getVariantSvg(augmentId);
    targetTh.innerHTML = `${svgIcon} ${augment.enName}`;
    targetTh.classList.add('modification-target-highlight');
  }

  // 좌측 증강 섹션(UI) 업데이트
  updateAugmentSidebar(player);

  // 점수판 리렌더링 (보너스 등 업데이트)
  updateScoreboard();
  if (rollsLeft < 3) {
    // 굴려진 주사위가 있으면 미리보기 갱신
    updateScorePreviews();
  }
};

// 기존 클라이언트 호출 호환용 별칭. 서버 이벤트 이름은 마이그레이션 기간 동안 유지함.

const executePrevTurn = () => {
  const totalCount = getActivePlayerCount();
  if (currentPlayer > 1) {
    currentPlayer--;
  } else {
    if (currentRound > 1) {
      currentPlayer = totalCount;
      currentRound--;
    } else return;
  }
  startTurn();
};

const executeNextTurn = () => {
  applyTurnTransition(resolveTurnAdvance({
    currentPlayer,
    currentRound,
    playerCount: getActivePlayerCount(),
    isExtraTurnPhase,
    extraTurns,
    hasRemainingCategory: hasUnfilledCategory,
    isPlayerEligible: (player) => !forfeitedPlayers[player]
  }));
};

window.debugNextTurnHandler = executeNextTurn;
window.debugPrevTurnHandler = executePrevTurn;

setupDebugTools({
  applyAugment: window.applyAugment,
  prevTurn: () => {
    if (window.isMultiplayer) {
      networkEngine.sendMessage({ type: 'ingame_message', subType: 'debug_prev_turn' });
    }
    executePrevTurn();
  },
  nextTurn: () => {
    if (window.isMultiplayer) {
      networkEngine.sendMessage({ type: 'ingame_message', subType: 'debug_next_turn' });
    }
    executeNextTurn();
  },
  applyDice: (values) => {
    diceEngine.forceValues(values);

    keptDice = [];
    activeDice = [...values].sort((a, b) => a - b);

    rollsLeft--;
    updateRollsUI();
    if (gameMode !== 'hotseat' && gameMode !== 'augmented-hotseat') {
      triggerOpponentTurn();
    } else {
      els.gameStatus.textContent = `P${currentPlayer} 족보 선택 대기 중...`;
      if (rollsLeft <= 0) {
        els.btnRoll.disabled = true;
        diceEngine.allowKeep = false;
      }
    }

    updateScorePreviews();
  },
  resetAugmentProgress: async () => {
    const user = getCurrentUser();
    if (!user?.uid) throw new Error('로그인 정보가 없음.');
    await resetAugmentProgress(user.uid);
  }
});

function resetAvatarUI() {
  const container = document.getElementById('profile-avatar-container');
  if (container) {
    container.style.backgroundImage = 'none';
    container.style.backgroundSize = '';
    container.style.backgroundPosition = '';
  }
  const canvas = document.getElementById('profile-avatar-canvas');
  if (canvas) canvas.style.display = 'none';
}

function renderAvatar(url, cropData, onComplete) {
  const container = document.getElementById('profile-avatar-container');
  if (!container || !url || !cropData) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }
  const canvas = document.getElementById('profile-avatar-canvas');
  if (canvas) canvas.style.display = 'none'; // 캔버스는 이제 사용 안 함 (정지된 이미지 방지)

  const containerWidth = 120; // CSS 사이즈 기준

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    const scale = containerWidth / cropData.width;
    const bgWidth = img.width * scale;
    const bgHeight = img.height * scale;
    const bgPosX = -cropData.x * scale;
    const bgPosY = -cropData.y * scale;

    container.style.backgroundImage = `url(${url})`;
    container.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    container.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
    container.style.backgroundRepeat = 'no-repeat';

    if (typeof onComplete === 'function') onComplete();
  };
  img.onerror = () => {
    if (typeof onComplete === 'function') onComplete();
  };
  img.src = url;
}

profileEditor = createProfileEditor({
  getCurrentUser,
  updateUserAvatar,
  renderAvatar,
  renderProfileAvatar: renderHistoryAvatar,
  updateProfileCache: updateCachedProfileData
});

// -----------------------------------------------------
initGameMenu({
  els,
  onProfileClosed: resetProfileModal
});
