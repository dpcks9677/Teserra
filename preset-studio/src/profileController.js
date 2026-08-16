import defaultAugmentsData from './augments.json';
import { getCurrentUser, getUserFromDB, getUserMatchesFromDB, incrementProfileViews, updateUserStatusMsg, normalizeUserUid, searchUsersByNickname } from './authEngine.js';
import { getProfileModeStats, getTopAugments } from './profileStats.js';
import { renderProfileRatingGraph } from './profileRatingGraph.js';
import { getAugmentedDicesIconSvg, getDicesIconSvg, getVariantSvg } from './svgIcons.js';
import { els } from './appShell.js';
import { escapeHtml } from './htmlUtils.js';
import { openGameModal } from './gameMenu.js';
import { createUiEventController } from './game/client/uiEventController.js';
import { setProfileEditorEditable } from './profileEditor.js';

const augmentData = defaultAugmentsData || [];
const profileUiEvents = createUiEventController();

const profileDataCache = new Map();

async function getCachedProfileData(uid, force = false) {
  if (!uid || uid.startsWith('guest')) return null;
  const cleanProfileUid = uid.split('_')[0];
  if (!force && profileDataCache.has(cleanProfileUid)) return profileDataCache.get(cleanProfileUid);
  const data = await getUserFromDB(cleanProfileUid);
  if (data) profileDataCache.set(cleanProfileUid, data);
  return data;
}

export async function refreshUserHistory(uid, historyCard = document.querySelector('#profile-content > .history-card'), isCurrent = () => true) {
  if (!historyCard || !uid) return;

  const matches = await getUserMatchesFromDB(uid);
  const profileIds = [...new Set(matches.flatMap(match => Object.values(match.players || {}))
    .map(player => player?.uid)
    .filter(playerUid => playerUid && !playerUid.startsWith('guest'))
    .map(playerUid => playerUid.split('_')[0]))];
  const profiles = new Map(await Promise.all(profileIds.map(async profileUid => [profileUid, await getCachedProfileData(profileUid)])));
  if (!isCurrent()) return;

  matches.forEach(match => {
    Object.values(match.players || {}).forEach(player => {
      const profile = profiles.get(player?.uid?.split('_')[0]);
      if (profile) {
        player.avatarUrl = profile.avatarUrl || null;
        player.cropData = profile.cropData || null;
      }
    });
  });
  renderHistoryCard(historyCard, matches, uid);
}

export function renderHistoryAvatar(element, avatarUrl, cropData) {
  if (!element || !avatarUrl) return;

  element.style.backgroundImage = `url('${avatarUrl}')`;
  element.style.backgroundRepeat = 'no-repeat';
  if (!cropData?.width || !Number.isFinite(cropData.x) || !Number.isFinite(cropData.y)) {
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    return;
  }

  const image = new Image();
  image.onload = () => {
    const scale = (element.clientWidth || 24) / cropData.width;
    element.style.backgroundSize = `${image.width * scale}px ${image.height * scale}px`;
    element.style.backgroundPosition = `${-cropData.x * scale}px ${-cropData.y * scale}px`;
  };
  image.src = avatarUrl;
}

function getHistoryAvatarHtml(player, style = '') {
  const uid = normalizeUserUid(player?.uid);
  if (!uid) return `<div class="history-avatar-mini" style="${style}"></div>`;
  return `
    <button class="history-avatar-profile-btn" type="button" data-profile-uid="${escapeHtml(uid)}" aria-label="${escapeHtml(player?.nickname || '플레이어')} 프로필 보기">
      <span class="history-avatar-mini" style="${style}"></span>
    </button>
  `;
}

function renderHistoryCard(container, matches, myUid) {
  container.innerHTML = '';

  const matchCount = matches ? matches.length : 0;

  // Header: 경기 기록 (n) & 새로고침 버튼
  const header = document.createElement('div');
  header.className = 'history-header';
  header.innerHTML = `
    <span>경기 기록 (${matchCount})</span>
    <button class="btn-history-refresh" type="button" title="경기 기록 새로고침" aria-label="경기 기록 새로고침">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
        <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 1.2A10 10 0 0 0 22.5 12.5"/>
      </svg>
    </button>
  `;
  container.appendChild(header);

  const btnRefresh = header.querySelector('.btn-history-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.transform = 'rotate(360deg)';
      void refreshUserHistory(myUid, container);
    });
  }

  if (!matches || matches.length === 0) {
    const emptyElem = document.createElement('div');
    emptyElem.className = 'history-empty-text';
    emptyElem.textContent = '게임 기록이 없습니다.';
    container.appendChild(emptyElem);
    return;
  }

  // Table Header
  const tableHeader = document.createElement('div');
  tableHeader.className = 'history-table-header';
  tableHeader.innerHTML = `
    <div class="col-mode">모드</div>
    <div class="col-players">플레이어</div>
    <div class="col-score">점수</div>
    <div class="col-result">결과</div>
    <div class="col-date">날짜</div>
  `;
  container.appendChild(tableHeader);

  // List Container
  const listContainer = document.createElement('div');
  listContainer.className = 'history-match-list';

  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'history-match-item';


    // 1. 모드 아이콘
    const isAugmented = match.mode === 'augmented' || match.mode === 'augmented-hotseat';
    const modeIconHtml = isAugmented ? getAugmentedDicesIconSvg() : getDicesIconSvg();
    const modeName = isAugmented ? '증강' : '일반';

    // 2. 플레이어 수집
    let playerList = [];
    if (match.players) {
      if (Array.isArray(match.players)) {
        playerList = match.players;
      } else {
        playerList = Object.values(match.players);
      }
    }

    // 과거 데이터 호환용 isForfeited 추정 및 playLogs 분석
    const hasLogForfeit = (match.playLogs || []).some(log => {
      const msg = typeof log === 'string' ? log : (log?.message || log?.text || '');
      return msg.includes('기권') || msg.includes('포기') || msg.includes('몰수') || msg.includes('퇴장');
    });

    // 각 플레이어별 isForfeited 판단 (직접 기록된 isForfeited -> playLogs 기록 -> 완료 족보 수 부족 여부)
    playerList.forEach(p => {
      if (p.isForfeited === undefined) {
        if (hasLogForfeit) {
          // playLogs에 기권 문구가 있는 경우, 점수가 현저히 적거나 족보 완료 개수가 적은 쪽을 기권자로 추정
          const filledCatsCount = p.scores ? Object.keys(p.scores).length : 0;
          if (filledCatsCount < 12) {
            p.isForfeited = true;
          }
        }
      }
    });

    const getCleanUidVal = (val) => normalizeUserUid(val) || val;
    const cleanMyUid = getCleanUidVal(myUid);

    let myPlayer = playerList.find(p => p && p.uid && getCleanUidVal(p.uid) === cleanMyUid);
    if (!myPlayer) {
      const curUserObj = getCurrentUser();
      const myNick = curUserObj?.displayName || els.myNickname?.textContent;
      if (myNick) {
        myPlayer = playerList.find(p => p.nickname === myNick);
      }
    }
    if (!myPlayer) {
      myPlayer = playerList[0];
    }
    const otherPlayers = playerList.filter(p => p !== myPlayer);
    const primaryOpponent = otherPlayers[0] || { nickname: '상대방', avatarUrl: null };
    const extraCount = otherPlayers.length > 1 ? otherPlayers.length - 1 : 0;

    const myAvatarStyle = '';
    const oppAvatarStyle = '';

    let oppHtml = `<span class="history-player-name">${escapeHtml(primaryOpponent.nickname || 'Guest')}</span>`;

    if (extraCount > 0) {
      oppHtml += ` <span class="history-player-extra" title="플레이어 목록 펼치기">+${extraCount}</span>`;
    }

    // 3. 점수 정보
    const myScore = myPlayer?.totalScore ?? (myPlayer?.score ?? 0);
    const oppScore = primaryOpponent?.totalScore ?? (primaryOpponent?.score ?? 0);

    const myForfeited = Boolean(myPlayer?.isForfeited);
    const oppForfeited = Boolean(primaryOpponent?.isForfeited);

    let myNameHtml = myPlayer?.nickname || '나';
    const myScoreStyle = myForfeited ? 'text-decoration: line-through; color: #888;' : '';
    const oppScoreStyle = oppForfeited ? 'text-decoration: line-through; color: #888;' : '';

    // 4. 결과 뱃지 (승리/패배)
    let computedWinnerUid = match.winnerUid;

    // 기권자가 있는 경우: 과거 데이터에서 winnerUid가 잘못 기록되었을 수 있으므로 항상 재판정
    if (myForfeited || oppForfeited) {
      if (myForfeited && !oppForfeited) {
        computedWinnerUid = primaryOpponent.uid;
      } else if (!myForfeited && oppForfeited) {
        computedWinnerUid = myUid;
      }
      // 둘 다 기권한 경우는 DB의 winnerUid 유지
    } else if (!computedWinnerUid || computedWinnerUid === 'none') {
      // 기권 없이 winnerUid도 없는 과거 데이터 → 무승부 처리
      computedWinnerUid = 'draw';
    }

    let resultBadgeHtml = '<span class="badge-draw">무승부</span>';
    if (computedWinnerUid && computedWinnerUid !== 'draw' && computedWinnerUid !== 'none') {
      const cleanWinnerUid = getCleanUidVal(computedWinnerUid);
      if (cleanWinnerUid === cleanMyUid) {
        resultBadgeHtml = '<span class="badge-win">승리</span>';
      } else {
        resultBadgeHtml = '<span class="badge-loss">패배</span>';
      }
    }


    // 5. 날짜 포맷 (YY.MM.DD)
    let dateStr = '-';
    if (match.timestamp) {
      const d = match.timestamp.toDate ? match.timestamp.toDate() : new Date(match.timestamp);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateStr = `${yy}.${mm}.${dd}`;
    }

    // 추가 플레이어 (3번째 이상) HTML 구성
    const restOpponents = otherPlayers.slice(1);
    let extraPlayersHtml = '';
    let extraScoresHtml = '';
    if (extraCount > 0) {
      restOpponents.forEach(op => {
        const opAvStyle = '';
        const opScore = op?.totalScore ?? (op?.score ?? 0);
        const isOpForfeited = Boolean(op?.isForfeited);
        const opScoreStyle = isOpForfeited ? 'text-decoration: line-through; color: #888;' : '';
        const opForfeitLabel = '';

        extraPlayersHtml += `
          <div class="history-player-row history-extra-row">
            ${getHistoryAvatarHtml(op, opAvStyle)}
            <span class="history-player-name">${escapeHtml(op.nickname || 'Guest')}${opForfeitLabel}</span>
          </div>
        `;
        extraScoresHtml += `
          <div class="history-score-row history-extra-row" style="${opScoreStyle}">${opScore}</div>
        `;
      });
    }

    item.innerHTML = `
      <div class="history-match-main">
        <div class="history-mode-col">
          ${modeIconHtml}
          <span>${modeName}</span>
        </div>
          <div class="history-players-col">
          <div class="history-player-row me">
            ${getHistoryAvatarHtml(myPlayer, myAvatarStyle)}
            <span class="history-player-name">${escapeHtml(myNameHtml)}</span>
          </div>
          <div class="history-player-row">
            ${getHistoryAvatarHtml(primaryOpponent, oppAvatarStyle)}
            ${oppHtml}
          </div>
          ${extraPlayersHtml}
        </div>
        <div class="history-score-col">
          <div class="history-score-row me" style="${myScoreStyle}">${myScore}</div>
          <div class="history-score-row" style="${oppScoreStyle}">${oppScore}</div>
          ${extraScoresHtml}
        </div>
        <div class="history-result-col">
          ${resultBadgeHtml}
        </div>
        <div class="history-date-col">
          ${dateStr}
        </div>
      </div>
    `;

    [myPlayer, primaryOpponent, ...restOpponents].forEach((player, index) => {
      renderHistoryAvatar(item.querySelectorAll('.history-avatar-mini')[index], player?.avatarUrl, player?.cropData);
    });
    bindHistoryProfileButtons(item);

    if (extraCount > 0) {
      const extraBtn = item.querySelector('.history-player-extra');
      if (extraBtn) {
        extraBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const extraRows = item.querySelectorAll('.history-extra-row');
          const isOpen = extraBtn.classList.toggle('open');
          extraRows.forEach(row => {
            row.classList.toggle('open', isOpen);
          });
          extraBtn.title = isOpen ? '플레이어 목록 접기' : '플레이어 목록 펼치기';
        });
      }
    }

    listContainer.appendChild(item);
  });

  container.appendChild(listContainer);
}

const profilePreviewCard = document.getElementById('profile-preview-card');
let profilePreviewTimer = null;
let profilePreviewUid = null;
let profileModalTargetUid = null;
let profileEditing = false;
let profileSearchRequest = 0;
let profileSearchTimer = null;
let profileSearchReturnAvailable = false;
let profileSearchReturnResults = [];

function hideProfilePreview(delay = 0) {
  clearTimeout(profilePreviewTimer);
  profilePreviewTimer = setTimeout(() => {
    profilePreviewUid = null;
    profilePreviewCard?.classList.add('hidden');
  }, delay);
}

async function showProfilePreview(button) {
  const uid = button?.dataset.profileUid;
  if (!uid || !profilePreviewCard) return;
  profilePreviewUid = uid;
  clearTimeout(profilePreviewTimer);
  profilePreviewTimer = setTimeout(async () => {
    const data = await getCachedProfileData(uid);
    if (!data || !button.isConnected || profilePreviewUid !== uid) return;
    document.getElementById('profile-preview-name').textContent = data.nickname || 'Player';
    document.getElementById('profile-preview-status').textContent = data.statusMsg || '';
    const previewAvatar = document.getElementById('profile-preview-avatar');
    if (previewAvatar) {
      previewAvatar.style.backgroundImage = '';
      previewAvatar.style.backgroundSize = '';
      previewAvatar.style.backgroundPosition = '';
      renderHistoryAvatar(previewAvatar, data.avatarUrl, data.cropData);
    }
    profilePreviewCard.classList.remove('hidden');
    const rect = button.getBoundingClientRect();
    const cardWidth = 260;
    const cardHeight = profilePreviewCard.offsetHeight || 84;
    const left = Math.min(window.innerWidth - cardWidth - 12, Math.max(12, rect.left + rect.width / 2 - cardWidth / 2));
    const below = rect.bottom + 10;
    const top = below + cardHeight <= window.innerHeight - 12 ? below : Math.max(12, rect.top - cardHeight - 10);
    profilePreviewCard.style.left = `${left}px`;
    profilePreviewCard.style.top = `${top}px`;
  }, 180);
}

function bindHistoryProfileButtons(root) {
  root.querySelectorAll('.history-avatar-profile-btn').forEach((button) => {
    button.addEventListener('pointerenter', () => void showProfilePreview(button));
    button.addEventListener('pointerleave', () => hideProfilePreview(140));
    button.addEventListener('focus', () => void showProfilePreview(button));
    button.addEventListener('blur', () => hideProfilePreview(140));
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      hideProfilePreview();
      void openProfileModal(button.dataset.profileUid);
    });
  });
}

profileUiEvents.bind(profilePreviewCard, 'pointerenter', () => clearTimeout(profilePreviewTimer));
profileUiEvents.bind(profilePreviewCard, 'pointerleave', () => hideProfilePreview(100));

function formatProfileDate(value) {
  if (!value) return '-';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function setProfileEditing(editing) {
  profileEditing = editing;
  setProfileEditorEditable(editing);
  const status = document.getElementById('profile-modal-status');
  const input = document.getElementById('profile-modal-status-input');
  const button = document.getElementById('btn-profile-edit');
  const avatar = document.getElementById('profile-modal-avatar');
  status?.classList.toggle('hidden', editing);
  input?.classList.toggle('hidden', !editing);
  avatar?.classList.toggle('editing', editing);
  avatar?.querySelector('.avatar-edit-overlay')?.classList.toggle('hidden', !editing);
  if (button) button.textContent = editing ? '저장' : '프로필 편집';
  if (editing && input) {
    input.value = status?.textContent || '';
    input.focus();
  }
}

function setProfileModalLoading(loading, failed = false) {
  document.querySelectorAll('#modal-profile .profile-modal-card, #profile-modal-history')
    .forEach((card) => card.classList.toggle('is-loading', loading));
  if (!loading && !failed) return;
  document.getElementById('profile-modal-title').textContent = '프로필';
  document.getElementById('profile-modal-name').textContent = failed ? '프로필을 불러올 수 없습니다.' : '불러오는 중...';
  document.getElementById('profile-modal-status').textContent = '';
  const avatar = document.getElementById('profile-modal-avatar');
  if (avatar) {
    avatar.style.backgroundImage = '';
    avatar.style.backgroundSize = '';
    avatar.style.backgroundPosition = '';
  }
  document.getElementById('btn-profile-edit')?.classList.add('hidden');
  document.getElementById('btn-my-profile')?.classList.add('hidden');
}

function renderProfileModal(userData, targetUid) {
  const currentUser = getCurrentUser();
  const isMine = Boolean(currentUser?.uid && currentUser.uid === targetUid);
  const nickname = userData.nickname || 'Player';
  const status = userData.statusMsg || '';
  setProfileModalLoading(false);
  const title = document.getElementById('profile-modal-title');
  if (title) title.textContent = isMine ? '내 프로필' : '유저 프로필';
  document.getElementById('profile-modal-name').textContent = nickname;
  document.getElementById('profile-modal-status').textContent = status;

  const editButton = document.getElementById('btn-profile-edit');
  editButton?.classList.toggle('hidden', !isMine);
  const myProfileButton = document.getElementById('btn-my-profile');
  myProfileButton?.classList.toggle('hidden', isMine);
  if (myProfileButton && !isMine) {
    const buttonLabel = profileSearchReturnAvailable ? '뒤로가기' : '내 프로필';
    myProfileButton.textContent = buttonLabel;
    myProfileButton.setAttribute('aria-label', buttonLabel);
  }
  setProfileEditing(false);

  const avatar = document.getElementById('profile-modal-avatar');
  if (avatar) {
    avatar.style.backgroundImage = '';
    avatar.style.backgroundSize = '';
    avatar.style.backgroundPosition = '';
    renderHistoryAvatar(avatar, userData.avatarUrl, userData.cropData);
  }

  const modeStats = getProfileModeStats(userData);
  document.getElementById('profile-rating-augmented').textContent = String(modeStats.augmented.rating);
  document.getElementById('profile-rating-normal').textContent = String(modeStats.normal.rating);
  document.querySelectorAll('.profile-rating-chart').forEach((chart) => {
    renderProfileRatingGraph(chart, userData, chart.dataset.ratingMode);
  });
  document.getElementById('profile-highest-score').textContent = String(modeStats.normal.highestScore);
  document.getElementById('profile-highest-score-date').textContent = formatProfileDate(modeStats.normal.highestScoreAt);
  document.getElementById('profile-upper-bonus-count').textContent = `${modeStats.normal.upperBonusCount}회`;
  document.getElementById('profile-yacht-count').textContent = `${modeStats.normal.yachtCount}회`;
  document.getElementById('profile-mode-icon-augmented').innerHTML = getAugmentedDicesIconSvg();
  document.getElementById('profile-mode-icon-normal').innerHTML = getDicesIconSvg();

  const topAugments = getTopAugments(userData, augmentData);
  const topList = document.getElementById('profile-top-augments');
  if (topList) {
    topList.innerHTML = topAugments.length
      ? topAugments.map((item) => `
        <li>
          <span class="profile-top-augment-icon">${getVariantSvg(item.id) || ''}</span>
          <span class="profile-top-augment-meta">
            <strong>${escapeHtml(item.name)}</strong>
            <span aria-hidden="true">/</span>
            <span>${item.count}회</span>
          </span>
        </li>
      `).join('')
      : '<li class="is-empty">기록 없음</li>';
  }
}

async function openProfileModal(targetUid) {
  const uid = normalizeUserUid(targetUid);
  if (!uid || !els.modalProfile) return;
  profileModalTargetUid = uid;
  openGameModal(els.modalProfile);
  setProfileModalLoading(true);
  const history = document.getElementById('profile-modal-history');
  if (history) history.innerHTML = '<div class="history-empty-text">프로필을 불러오는 중...</div>';

  const userData = await getCachedProfileData(uid);
  if (profileModalTargetUid !== uid) return;
  if (!userData) {
    setProfileModalLoading(false, true);
    if (history) history.innerHTML = '<div class="history-empty-text">프로필을 불러올 수 없습니다.</div>';
    return;
  }
  renderProfileModal(userData, uid);
  const currentUser = getCurrentUser();
  const viewKey = `ad_profile_viewed:${uid}`;
  if (currentUser?.uid !== uid && sessionStorage.getItem(viewKey) !== '1') {
    sessionStorage.setItem(viewKey, '1');
    void incrementProfileViews(uid);
  }
  await refreshUserHistory(uid, history, () => profileModalTargetUid === uid);
}

function openMyProfile() {
  const user = getCurrentUser();
  if (!user?.uid) return;
  resetProfileModal();
  void openProfileModal(user.uid);
}

profileUiEvents.bind(document.getElementById('btn-open-profile'), 'click', openMyProfile);

function returnToProfileSearch() {
  if (!profileSearchReturnAvailable) return;
  profileSearchReturnAvailable = false;
  profileSearchResultsSection?.classList.add('hidden');
  profileSearchGrid?.classList.add('is-searching');
  profileSearchScreen?.classList.remove('hidden');
  renderProfileSearchResults(profileSearchReturnResults, profileSearchScreenResults);
  if (profileSearchScreenStatus) profileSearchScreenStatus.textContent = '';
  const button = document.getElementById('btn-my-profile');
  if (button) {
    button.textContent = '내 프로필';
    button.setAttribute('aria-label', '내 프로필');
  }
}

profileUiEvents.bind(document.getElementById('btn-my-profile'), 'click', () => {
  if (profileSearchReturnAvailable) returnToProfileSearch();
  else openMyProfile();
});

profileUiEvents.bind(document.getElementById('btn-profile-edit'), 'click', async () => {
  const user = getCurrentUser();
  if (!user?.uid || user.uid !== profileModalTargetUid) return;
  if (!profileEditing) {
    setProfileEditing(true);
    return;
  }
  const input = document.getElementById('profile-modal-status-input');
  const newMessage = input?.value.trim().substring(0, 30) || '';
  if (!newMessage) {
    alert('소개말을 입력해주세요.');
    return;
  }
  if (!await updateUserStatusMsg(user.uid, newMessage)) {
    alert('소개말 업데이트에 실패했습니다.');
    return;
  }
  const sidebarStatus = document.getElementById('profile-status-msg');
  if (sidebarStatus) sidebarStatus.textContent = newMessage;
  document.getElementById('profile-modal-status').textContent = newMessage;
  localStorage.setItem('ad_status_msg', newMessage);
  const cached = profileDataCache.get(user.uid) || {};
  profileDataCache.set(user.uid, { ...cached, statusMsg: newMessage });
  setProfileEditing(false);
});

const profileSearchInput = document.getElementById('profile-search-input');
const profileSearchStatus = document.getElementById('profile-search-status');
const profileSearchResults = document.getElementById('profile-search-results');
const profileSearchResultsSection = document.getElementById('profile-search-results-section');
const profileSearchGrid = document.querySelector('.profile-modal-grid');
const profileSearchScreen = document.getElementById('profile-search-results-screen');
const profileSearchScreenStatus = document.getElementById('profile-search-screen-status');
const profileSearchScreenResults = document.getElementById('profile-search-screen-results');

function renderProfileSearchResults(results, container) {
  if (!container) return;
  container.innerHTML = results.map((profile) => `
    <button class="profile-search-result" type="button" data-profile-uid="${escapeHtml(profile.uid)}">
      <span class="profile-search-result-avatar" aria-hidden="true"></span>
      <span class="profile-search-result-info">
        <strong>${escapeHtml(profile.nickname || 'Player')}</strong>
        <span class="profile-search-result-status" title="${escapeHtml(profile.statusMsg || '')}">${escapeHtml(profile.statusMsg || '')}</span>
      </span>
    </button>
  `).join('');
  container.querySelectorAll('.profile-search-result').forEach((button, index) => {
    const profile = results[index];
    renderHistoryAvatar(button.querySelector('.profile-search-result-avatar'), profile.avatarUrl, profile.cropData);
    button.addEventListener('click', () => {
      profileSearchReturnAvailable = true;
      profileSearchReturnResults = results;
      profileSearchResultsSection?.classList.add('hidden');
      profileSearchScreen?.classList.add('hidden');
      profileSearchGrid?.classList.remove('is-searching');
      void openProfileModal(button.dataset.profileUid);
    });
  });
}

async function runProfileSearch(fullScreen = false) {
  const keyword = profileSearchInput?.value.trim() || '';
  const requestId = ++profileSearchRequest;
  if (fullScreen) {
    clearTimeout(profileSearchTimer);
    profileSearchReturnAvailable = false;
    profileSearchReturnResults = [];
    profileSearchResultsSection?.classList.add('hidden');
    document.getElementById('btn-profile-edit')?.classList.add('hidden');
    const button = document.getElementById('btn-my-profile');
    button?.classList.remove('hidden');
    if (button) {
      button.textContent = '내 프로필';
      button.setAttribute('aria-label', '내 프로필');
    }
  }
  if (!keyword) {
    if (profileSearchStatus) profileSearchStatus.textContent = '닉네임을 입력해주세요.';
    if (profileSearchResults) profileSearchResults.innerHTML = '';
    if (profileSearchScreenResults) profileSearchScreenResults.innerHTML = '';
    profileSearchScreen?.classList.add('hidden');
    profileSearchGrid?.classList.remove('is-searching');
    profileSearchResultsSection?.classList.add('hidden');
    return;
  }
  if (profileSearchStatus) profileSearchStatus.textContent = '검색 중...';
  if (profileSearchResults) profileSearchResults.innerHTML = '';
  if (profileSearchScreenResults) profileSearchScreenResults.innerHTML = '';
  try {
    const results = await searchUsersByNickname(keyword, { limitResults: fullScreen ? null : 20 });
    if (requestId !== profileSearchRequest) return;
    if (fullScreen) {
      profileSearchGrid?.classList.add('is-searching');
      profileSearchScreen?.classList.remove('hidden');
      renderProfileSearchResults(results, profileSearchScreenResults);
      if (profileSearchScreenStatus) profileSearchScreenStatus.textContent = results.length ? '' : '검색 결과가 없습니다.';
    } else {
      profileSearchResultsSection?.classList.remove('hidden');
      renderProfileSearchResults(results.slice(0, 4), profileSearchResults);
      if (profileSearchStatus) profileSearchStatus.textContent = results.length ? '' : '검색 결과가 없습니다.';
    }
  } catch {
    if (requestId !== profileSearchRequest) return;
    if (fullScreen) {
      profileSearchGrid?.classList.add('is-searching');
      profileSearchScreen?.classList.remove('hidden');
      if (profileSearchScreenStatus) profileSearchScreenStatus.textContent = '검색에 실패했습니다. 잠시 후 다시 시도해주세요.';
    } else if (profileSearchStatus) profileSearchStatus.textContent = '검색에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
}

profileUiEvents.bind(document.getElementById('btn-profile-search-submit'), 'click', () => void runProfileSearch(true));
profileUiEvents.bind(profileSearchInput, 'input', () => {
  clearTimeout(profileSearchTimer);
  profileSearchTimer = setTimeout(() => void runProfileSearch(), 180);
});
profileUiEvents.bind(profileSearchInput, 'keydown', (event) => {
  if (event.key === 'Enter') void runProfileSearch(true);
});

profileUiEvents.bind(document.getElementById('profile-modal-status-input'), 'keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('btn-profile-edit')?.click();
});

export function cacheProfileData(uid, data) {
  if (uid && data) profileDataCache.set(uid, data);
}

export function deleteCachedProfileData(uid) {
  profileDataCache.delete(uid);
}

export function updateCachedProfileData(uid, values) {
  profileDataCache.set(uid, { ...(profileDataCache.get(uid) || {}), ...values });
}

export function isProfileEditing() {
  return profileEditing;
}

export function resetProfileModal() {
  profileModalTargetUid = null;
  profileSearchRequest += 1;
  clearTimeout(profileSearchTimer);
  if (profileSearchInput) profileSearchInput.value = '';
  if (profileSearchStatus) profileSearchStatus.textContent = '';
  if (profileSearchResults) profileSearchResults.innerHTML = '';
  if (profileSearchScreenResults) profileSearchScreenResults.innerHTML = '';
  if (profileSearchScreenStatus) profileSearchScreenStatus.textContent = '';
  profileSearchReturnAvailable = false;
  profileSearchReturnResults = [];
  profileSearchScreen?.classList.add('hidden');
  profileSearchGrid?.classList.remove('is-searching');
  profileSearchResultsSection?.classList.add('hidden');
  setProfileEditing(false);
}

export function disposeProfileController() {
  clearTimeout(profilePreviewTimer);
  clearTimeout(profileSearchTimer);
  profileUiEvents.dispose();
  setProfileEditorEditable(false);
}
