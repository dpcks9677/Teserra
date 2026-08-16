import { specialAchievementDefinitions } from './augmentAchievements.js';

export const MASTERY_TARGET = 10;
export const augmentTelemetryDefinitions = {
  'table-flip': [
    { key: 'uses', label: '판 뒤집기 사용 횟수', unit: '회' }
  ],
  'yacht-bank': [
    { key: 'bankedScore', label: '누적 저금 점수', unit: '점' }
  ]
};

const modificationAugmentIds = new Set([
  'lucky-sevens', 'perfect-squares', 'anti-ace-deuces', 'anti-four-threes', 'prime-numbers',
  'anti-six-fours', 'anti-six-fives', 'anti-five-sixes', 'gambler', 'three-of-a-kind',
  'four-by-four', 'tiny-house', 'two-pair', 'head-and-tail', 'evens', 'odds',
  'double-large-straight', 'prime-collection', 'duplex-house', 'mountain', 'high-dice',
  '2nd-choice', 'fibonacci-numbers', 'reverse-choice', 'yacht-bank', 'blackjack-21'
]);
const questAugmentIds = new Set([
  'yacht-bank', 'fast-straight', 'no-time-to-waste', 'step-by-step', 'two-households',
  'holdout', 'cautious-straight', 'every-little', 'copycat', 'doubling', 'nozdormu', 'bounty-hunter', 'prophet'
]);
const diceAugmentIds = new Set([
  'weighted-dice', 'golden-die', '8-sided', 'strange-die', 'promotion-die', 'couple-dice', 'sevens-dice'
]);

export function getAugmentTelemetryDefinitions(augmentId) {
  return [
    ...(modificationAugmentIds.has(augmentId) ? [
      { key: 'scoreRecords', label: '족보 등록 횟수', unit: '회' },
      { key: 'scratches', label: '스크래치 횟수', unit: '회' }
    ] : []),
    ...(questAugmentIds.has(augmentId) ? [
      { key: 'questSuccesses', label: '퀘스트 성공 횟수', unit: '회' },
      { key: 'questFailures', label: '퀘스트 실패 횟수', unit: '회' }
    ] : []),
    ...(diceAugmentIds.has(augmentId) ? [
      { key: 'diceRolls', label: '주사위 굴림 횟수', unit: '회' },
      { key: 'diceScoreRecords', label: '주사위 사용 족보 등록 횟수', unit: '회' }
    ] : []),
    ...(augmentTelemetryDefinitions[augmentId] || [])
  ];
}

export function createAugmentProgressSession(sessionId = crypto.randomUUID()) {
  return {
    sessionId,
    draftReceipts: new Set(),
    appearances: {},
    selections: {},
    metrics: {},
    achievements: {},
    flags: {},
    achievementState: { flags: {}, straightPatterns: {}, lastStraight: null },
    saved: false
  };
}

export function recordAugmentOffer(session, augmentIds, receiptKey = '') {
  if (!session || session.saved) return;
  if (receiptKey && session.draftReceipts.has(receiptKey)) return;
  if (receiptKey) session.draftReceipts.add(receiptKey);
  new Set(augmentIds.filter(Boolean)).forEach((augmentId) => {
    session.appearances[augmentId] = (session.appearances[augmentId] || 0) + 1;
  });
}

export function recordAugmentSelection(session, augmentId) {
  if (!session || session.saved || !augmentId) return;
  if (session.selections[augmentId]) return;
  session.selections[augmentId] = 1;
}

export function recordAugmentMetric(session, augmentId, metricKey, amount = 1) {
  const allowed = getAugmentTelemetryDefinitions(augmentId).some((metric) => metric.key === metricKey);
  if (!session || session.saved || !allowed || !Number.isFinite(amount)) return;
  session.metrics[augmentId] ||= {};
  session.metrics[augmentId][metricKey] = (session.metrics[augmentId][metricKey] || 0) + amount;
}

export function recordAchievementProgress(session, achievementId, amount = 1, mode = 'add') {
  if (!session || session.saved || !achievementId || !Number.isFinite(amount)) return;
  const current = session.achievements[achievementId] || 0;
  session.achievements[achievementId] = mode === 'max' ? Math.max(current, amount) : current + amount;
}

export function createMasteryDefinition(augment) {
  return {
    id: `augment-mastery:${augment.augmentId}`,
    augmentId: augment.augmentId,
    name: `${augment.name} 마스터리`,
    description: `${augment.name}을(를) 선택하고 게임을 10번 완료하세요.`,
    target: MASTERY_TARGET
  };
}

export function getAugmentAchievementDefinitions(augment) {
  return [createMasteryDefinition(augment), ...(specialAchievementDefinitions[augment.augmentId] || [])];
}

export function getAchievementDefinition(achievementId) {
  for (const definitions of Object.values(specialAchievementDefinitions)) {
    const definition = definitions.find((item) => item.id === achievementId);
    if (definition) return definition;
  }
  return null;
}

export function getAugmentStats(userData, augmentId) {
  return userData?.stats?.augmentStats?.[augmentId] || {
    appearances: 0,
    selections: 0,
    completedSelections: 0,
    metrics: {}
  };
}

export function getAchievementProgress(userData, achievementId) {
  const progress = userData?.achievements?.[achievementId] || {};
  return {
    ...progress,
    current: progress.current ?? progress.progress ?? 0,
    completedAt: progress.completedAt || null
  };
}

export function calculateAdoptionRate(stats) {
  if (!stats.appearances) return 0;
  return Math.min(100, (stats.selections / stats.appearances) * 100);
}
