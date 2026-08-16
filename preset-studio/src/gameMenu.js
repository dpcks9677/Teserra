import defaultAugmentsData from './augments.json';
import { getCurrentUser, getUserFromDB } from './authEngine.js';
import {
  calculateAdoptionRate,
  getAugmentAchievementDefinitions,
  getAugmentTelemetryDefinitions,
  getAchievementProgress,
  getAugmentStats
} from './augmentProgress.js';
import { renderAchievementList } from './achievementUI.js';
import { getAugmentedDicesIconSvg, getDicesIconSvg, getVariantSvg } from './svgIcons.js';
import { escapeHtml } from './htmlUtils.js';

export function openGameModal(modal) {
  modal?.classList.remove('hidden');
}

export function getAugmentCategoryName(augment) {
  if (augment.type === 'Quest') return '퀘스트';
  if (augment.type === 'Enhancement') return '강화';
  if (augment.type === 'Modification') return '변형';
  if (augment.id >= 1 && augment.id <= 26) return '변형';
  if (augment.id >= 27 && augment.id <= 36) return '퀘스트';
  if (augment.id >= 37 && augment.id <= 46) return '강화';
  return '기타';
}

export function getAugmentCategoryEnName(augment, singleLine = false) {
  if (augment.type?.includes('Phase 1')) {
    return singleLine ? 'Quest / Phase 1' : 'Quest<br>Phase 1';
  }
  if (augment.augmentId === 'yacht-bank' || (augment.types?.includes('Modification') && augment.types.includes('Quest'))) {
    return singleLine ? 'Modification / Quest' : 'Modification<br>Quest';
  }
  const category = getAugmentCategoryName(augment);
  if (category === '변형') return 'Modification';
  if (category === '퀘스트') return 'Quest';
  if (category === '강화') return 'Enhancement';
  return category;
}

export function getAugmentBadgeClass(category) {
  if (category === '변형') return 'cat-modification';
  if (category === '퀘스트') return 'cat-quest';
  if (category === '강화') return 'cat-enhancement';
  return '';
}

export function initGameMenu({ els, onProfileClosed }) {
  const augments = defaultAugmentsData || [];
  let category = 'all';
  let selectedAugment = null;
  let indexScrollTop = 0;

  const closeModal = (modal) => {
    modal?.classList.add('hidden');
    if (modal === els.modalProfile) onProfileClosed();
  };

  const closeAllModals = () => {
    [els.modalSettings, els.modalAchievements, els.modalCompendium, els.modalProfile, els.modalHelp]
      .forEach((modal) => modal?.classList.add('hidden'));
    onProfileClosed();
  };

  const getCurrentProgressData = async () => {
    const user = getCurrentUser();
    return user?.uid ? (await getUserFromDB(user.uid) || {}) : {};
  };

  const getAugmentIcon = (augmentId) => getVariantSvg(augmentId) || '';
  const getAugmentCardHtml = (augment, singleLineTag = false) => {
    const unavailable = augment.isAvailable === false;
    const description = augment.description || `${augment.name} 증강이 적용됩니다.`;
    return `
      <div class="modal-compendium-type-text${singleLineTag ? ' is-single-line' : ''}">${getAugmentCategoryEnName(augment, singleLineTag)}</div>
      ${unavailable ? '<div class="modal-compendium-unavailable">리워크 예정</div>' : ''}
      <div class="aug-slot-header">
        ${getAugmentIcon(augment.augmentId)}
        <span class="aug-slot-name">${escapeHtml(augment.name)}</span>
      </div>
      <div class="aug-slot-desc">${description}</div>
    `;
  };

  const showIndex = (restoreScroll = true) => {
    selectedAugment = null;
    document.getElementById('modal-compendium-index')?.classList.remove('hidden');
    document.getElementById('modal-compendium-detail')?.classList.add('hidden');
    const title = document.getElementById('modal-compendium-title');
    if (title) title.textContent = '증강 도감';
    requestAnimationFrame(() => {
      const body = document.getElementById('modal-compendium-body');
      if (body) body.scrollTop = restoreScroll ? indexScrollTop : 0;
    });
  };

  const showDetail = async (augment) => {
    selectedAugment = augment;
    indexScrollTop = document.getElementById('modal-compendium-body')?.scrollTop || 0;
    const index = document.getElementById('modal-compendium-index');
    const detail = document.getElementById('modal-compendium-detail');
    const augmentCard = document.getElementById('compendium-detail-augment');
    const statList = document.getElementById('compendium-stat-list');
    const achievementList = document.getElementById('compendium-achievement-list');
    if (!detail || !augmentCard || !statList || !achievementList) return;

    index?.classList.add('hidden');
    detail.classList.remove('hidden');
    augmentCard.className = `modal-compendium-item compendium-detail-augment${augment.isAvailable === false ? ' is-unavailable' : ''}`;
    augmentCard.innerHTML = getAugmentCardHtml(augment, true);
    const title = document.getElementById('modal-compendium-title');
    if (title) title.textContent = augment.name;

    const userData = await getCurrentProgressData();
    if (selectedAugment !== augment) return;
    const stats = getAugmentStats(userData, augment.augmentId);
    const adoptionRate = calculateAdoptionRate(stats);
    statList.innerHTML = `
      <dt>등장 횟수</dt><dd>${stats.appearances || 0}회</dd>
      <dt>채택 횟수</dt><dd>${stats.selections || 0}회</dd>
      <dt>채용률</dt><dd>${adoptionRate.toFixed(1)}%</dd>
      ${getAugmentTelemetryDefinitions(augment.augmentId).map((metric) =>
        `<dt>${escapeHtml(metric.label)}</dt><dd>${stats.metrics?.[metric.key] || 0}${metric.unit}</dd>`
      ).join('')}
    `;
    renderAchievementList(achievementList, getAugmentAchievementDefinitions(augment).map((definition) => ({
      definition,
      progress: getAchievementProgress(userData, definition.id),
      iconHtml: getAugmentIcon(augment.augmentId)
    })));
    document.getElementById('btn-compendium-back')?.focus();
  };

  const renderAchievements = async () => {
    const container = document.getElementById('modal-achievements-list');
    if (!container) return;
    const userData = await getCurrentProgressData();
    const entries = augments.flatMap((augment) =>
      getAugmentAchievementDefinitions(augment).map((definition) => ({
        definition,
        progress: getAchievementProgress(userData, definition.id),
        iconHtml: getAugmentIcon(augment.augmentId)
      }))
    );
    renderAchievementList(container, entries);
    const completed = entries.filter(({ definition, progress }) =>
      Boolean(progress.completedAt) || Number(progress.current) >= definition.target
    ).length;
    const summaryText = document.getElementById('modal-achievements-summary-text');
    const summaryFill = document.getElementById('modal-achievements-summary-fill');
    if (summaryText) summaryText.textContent = `${completed}/${entries.length} 완료함`;
    if (summaryFill?.parentElement) {
      summaryFill.style.width = `${entries.length ? (completed / entries.length) * 100 : 0}%`;
      summaryFill.parentElement.setAttribute('aria-valuenow', String(completed));
      summaryFill.parentElement.setAttribute('aria-valuemax', String(entries.length));
    }
  };

  const renderAugments = (filter = 'all') => {
    const list = document.getElementById('modal-compendium-list');
    if (!list) return;
    list.innerHTML = '';
    const filtered = augments.filter((augment) => {
      if (filter === 'all') return true;
      if (augment.augmentId === 'yacht-bank' || (augment.types?.includes('Modification') && augment.types.includes('Quest'))) {
        return filter === '변형' || filter === '퀘스트';
      }
      return getAugmentCategoryName(augment) === filter;
    });
    if (!filtered.length) {
      list.innerHTML = '<p class="modal-placeholder-text">해당 카테고리의 증강이 없습니다.</p>';
      return;
    }
    filtered.forEach((augment) => {
      const item = document.createElement('button');
      item.className = `augment-option modal-compendium-item${augment.isAvailable === false ? ' is-unavailable' : ''}`;
      item.type = 'button';
      item.setAttribute('aria-label', `${augment.name} 상세 정보 보기`);
      item.innerHTML = getAugmentCardHtml(augment);
      item.addEventListener('click', () => void showDetail(augment));
      list.appendChild(item);
    });
  };

  els.btnMenuSettings?.addEventListener('click', () => openGameModal(els.modalSettings));
  els.btnMenuAchievements?.addEventListener('click', async () => {
    openGameModal(els.modalAchievements);
    await renderAchievements();
  });
  els.btnMenuCompendium?.addEventListener('click', () => {
    openGameModal(els.modalCompendium);
    showIndex();
    renderAugments(category);
  });
  els.btnMenuHelp?.addEventListener('click', () => openGameModal(els.modalHelp));

  document.getElementById('btn-compendium-back')?.addEventListener('click', () => {
    showIndex(false);
    document.querySelector('.modal-compendium-item')?.focus();
  });
  document.querySelectorAll('.modal-compendium-tab-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      document.querySelectorAll('.modal-compendium-tab-btn').forEach((item) => item.classList.remove('active'));
      event.currentTarget.classList.add('active');
      category = event.currentTarget.getAttribute('data-category');
      renderAugments(category);
    });
  });
  document.querySelectorAll('.game-modal-close').forEach((button) => {
    button.addEventListener('click', (event) => closeModal(document.getElementById(event.currentTarget.getAttribute('data-target'))));
  });
  document.querySelectorAll('.game-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.modalCompendium?.classList.contains('hidden') && selectedAugment) showIndex();
    else closeAllModals();
  });

  const normalHelpIcon = document.getElementById('help-icon-norm');
  const augmentHelpIcon = document.getElementById('help-icon-aug');
  if (normalHelpIcon) normalHelpIcon.innerHTML = getDicesIconSvg();
  if (augmentHelpIcon) augmentHelpIcon.innerHTML = getAugmentedDicesIconSvg();
  const helpDetail = document.getElementById('modal-help-detail');
  const openHelpDetail = (title, body) => {
    closeModal(els.modalHelp);
    const titleElement = document.getElementById('help-detail-title');
    const bodyElement = document.getElementById('help-detail-text');
    if (titleElement) titleElement.textContent = title;
    if (bodyElement) bodyElement.textContent = body;
    openGameModal(helpDetail);
  };
  document.getElementById('btn-help-norm-guide')?.addEventListener('click', () =>
    openHelpDetail('요트 다이스 가이드', '요트 다이스 가이드 내용이 여기에 추가될 예정입니다.'));
  document.getElementById('btn-help-aug-guide')?.addEventListener('click', () =>
    openHelpDetail('증강 요트 다이스 가이드', '증강 요트 다이스 가이드 내용이 여기에 추가될 예정입니다.'));
  document.getElementById('btn-help-detail-back')?.addEventListener('click', () => {
    closeModal(helpDetail);
    openGameModal(els.modalHelp);
  });
  document.getElementById('btn-help-detail-close')?.addEventListener('click', () => closeModal(helpDetail));
}
