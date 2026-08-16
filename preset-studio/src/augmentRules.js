export const AUGMENT_CONFLICTS = Object.freeze({
  'table-flip': Object.freeze(['8-sided']),
  'strange-die': Object.freeze(['8-sided']),
  '8-sided': Object.freeze(['table-flip', 'strange-die'])
});

export function hasAugmentConflict(ownedIds, candidateId) {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds || []);
  return (AUGMENT_CONFLICTS[candidateId] || []).some((augmentId) => owned.has(augmentId));
}

export function canAcquireAugment(ownedIds, candidateId) {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds || []);
  return !owned.has(candidateId) && !hasAugmentConflict(owned, candidateId);
}

const LOWER_CATEGORIES = new Set(['choice', '4oak', 'fullhouse', 's-straight', 'l-straight', 'yacht']);
const UPPER_CATEGORIES = Object.freeze(['aces', 'deuces', 'threes', 'fours', 'fives', 'sixes']);

export function getAugmentScoreValue(value) {
  return typeof value === 'object'
    ? (Number(value?.score) || 0) + (Number(value?.bonus) || 0)
    : Number(value) || 0;
}

export function createProphetCandidates({
  categoryIds,
  scores = {},
  activeAugments = {},
  calculateScores,
  scoreContext = {},
  minimumCount = 3
}) {
  const emptyCategories = categoryIds.filter((categoryId) => scores[categoryId] === undefined);
  const candidates = new Set();
  const dice = Array(5).fill(1);

  const visit = (index) => {
    if (index === dice.length) {
      const possible = calculateScores(dice, activeAugments, scoreContext);
      for (const categoryId of emptyCategories) {
        const value = getAugmentScoreValue(possible[categoryId]);
        if (value >= 1 && value <= 30) candidates.add(value);
      }
      return;
    }
    for (let value = 1; value <= 6; value += 1) {
      dice[index] = value;
      visit(index + 1);
    }
  };

  visit(0);
  for (let value = 1; candidates.size < minimumCount && value <= 30; value += 1) {
    candidates.add(value);
  }
  return [...candidates];
}

function normalizeAugmentDefinitions(definitions) {
  if (Array.isArray(definitions)) {
    return definitions.map((definition) => [definition.augmentId || definition.id, definition]);
  }
  return Object.entries(definitions || {});
}

export function getRandomBoxCandidates({ definitions, ownedIds, unavailableIds = [] }) {
  const unavailable = unavailableIds instanceof Set ? unavailableIds : new Set(unavailableIds);
  return normalizeAugmentDefinitions(definitions)
    .filter(([augmentId, definition]) => (
      augmentId
      && augmentId !== 'random-box'
      && definition?.isAvailable !== false
      && definition?.isQuest !== true
      && definition?.type !== 'Quest'
      && !unavailable.has(augmentId)
      && canAcquireAugment(ownedIds, augmentId)
    ))
    .map(([augmentId]) => augmentId);
}

export function selectRandomBoxAward(candidates, selectedIndex) {
  if (!candidates.length) return null;
  const index = Number(selectedIndex);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) return null;
  return candidates[index];
}

export function createAugmentApplicationPlan({
  definitions,
  augmentId,
  activeAugments = {},
  scores = {},
  currentRound = 1,
  upperBonusThreshold = 63
}) {
  const definition = definitions?.[augmentId];
  if (!definition) return Object.freeze({ status: 'invalid', augmentId });

  const target = definition.target;
  if (activeAugments[target] === augmentId) {
    return Object.freeze({ status: 'duplicate', augmentId, target, definition });
  }

  return Object.freeze({
    status: 'ready',
    augmentId,
    target,
    definition,
    clearsScore: scores[target] !== undefined,
    upperBonusThreshold: augmentId === 'double-large-straight'
      ? 60
      : augmentId === 'random-box'
        ? Math.min(Number(upperBonusThreshold) || 63, 58)
        : null,
    nozdormuTargetRound: augmentId === 'nozdormu'
      ? (currentRound <= 5 ? 5 : currentRound <= 8 ? 8 : 12)
      : null,
    resetEquivalentExchange: augmentId === 'equivalent-exchange',
    resetYachtBank: augmentId === 'yacht-bank',
    resetNoTime: augmentId === 'no-time-to-waste',
    resetBountyHunter: augmentId === 'bounty-hunter',
    resetDuel: augmentId === 'duel',
    resetRandomBox: augmentId === 'random-box',
    resetProphet: augmentId === 'prophet',
    resetPiggyBank: augmentId === 'piggy-bank',
    checkDoubling: augmentId === 'doubling',
    recordPromotionRound: augmentId === 'promotion-die'
  });
}

function addQuestReward(progress, rewards, id, rewardedKey, points) {
  progress[rewardedKey] = true;
  progress.questBonus = (progress.questBonus || 0) + points;
  rewards.push({ id, points });
}

function isFullHouse(diceValues) {
  const counts = Object.values(diceValues.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {})).sort((left, right) => right - left);
  return (counts[0] >= 3 && counts[1] >= 2) || counts[0] >= 5;
}

export function createQuestProgressPlan({
  augmentIds = [],
  progress = {},
  category = null,
  score = null,
  scores = {},
  categoryIds = Object.keys(scores),
  opponentScores = {},
  scoringDiceValues = [],
  currentRound = 1,
  isFirstRollScore = false,
  noTimeProgressField = 'noTimeRemaining',
  fastStraightSatisfied = false,
  copycatScoreValue = getAugmentScoreValue(score),
  copycatOpponentScoreValue = getAugmentScoreValue(opponentScores[category]),
  bountyTarget = null,
  bountyProgress = null,
  prophetState = null,
  clearProphetNumbers = false,
  evaluateNozdormu = false
}) {
  const owned = augmentIds instanceof Set ? augmentIds : new Set(augmentIds);
  const nextProgress = { ...progress };
  const nextBounty = bountyProgress ? { ...bountyProgress } : bountyProgress;
  const nextProphet = prophetState
    ? { ...prophetState, numbers: [...(prophetState.numbers || [])] }
    : prophetState;
  const rewards = [];
  const facts = {};

  if (owned.has('every-little') && !nextProgress.everyLittleRewarded) {
    nextProgress.everyLittleCount = (nextProgress.everyLittleCount || 0)
      + scoringDiceValues.filter((value) => value === 1).length;
    if (nextProgress.everyLittleCount >= 7) {
      addQuestReward(nextProgress, rewards, 'every-little', 'everyLittleRewarded', 15);
    }
  }

  if (
    owned.has('fast-straight')
    && !nextProgress.fastStraightRewarded
    && currentRound <= 8
    && fastStraightSatisfied
  ) {
    addQuestReward(nextProgress, rewards, 'fast-straight', 'fastStraightRewarded', 15);
  }

  if (category && owned.has('no-time-to-waste') && !nextProgress.noTimeRewarded && !nextProgress.noTimeFailed) {
    if (!isFirstRollScore) {
      nextProgress.noTimeFailed = true;
    } else if (noTimeProgressField === 'noTimeCount') {
      nextProgress.noTimeCount = (nextProgress.noTimeCount || 0) + 1;
      if (nextProgress.noTimeCount >= 3) {
        addQuestReward(nextProgress, rewards, 'no-time-to-waste', 'noTimeRewarded', 15);
      }
    } else {
      nextProgress.noTimeRemaining = Math.max(0, (nextProgress.noTimeRemaining ?? 3) - 1);
      if (nextProgress.noTimeRemaining === 0) {
        addQuestReward(nextProgress, rewards, 'no-time-to-waste', 'noTimeRewarded', 15);
      }
    }
  }

  if (owned.has('step-by-step') && !nextProgress.stepRewarded && !nextProgress.stepFailed && UPPER_CATEGORIES.includes(category)) {
    if (category === UPPER_CATEGORIES[nextProgress.stepCount || 0]) {
      nextProgress.stepCount = (nextProgress.stepCount || 0) + 1;
      if (nextProgress.stepCount === UPPER_CATEGORIES.length) {
        nextProgress.stepRewarded = true;
        rewards.push({ id: 'step-by-step', points: 0 });
      }
    } else {
      nextProgress.stepFailed = true;
    }
  }

  if (owned.has('two-households') && !nextProgress.twoHouseholdsRewarded) {
    if (category === 'choice' && isFullHouse(scoringDiceValues)) {
      nextProgress.twoHouseholdsChoiceDone = true;
      const baseScore = typeof score === 'object' ? Number(score?.score) || 0 : Number(score) || 0;
      facts.twoHouseholdsChoiceAtLeast20 = baseScore >= 20;
    }
    if (nextProgress.twoHouseholdsChoiceDone && getAugmentScoreValue(scores.fullhouse) > 0) {
      addQuestReward(nextProgress, rewards, 'two-households', 'twoHouseholdsRewarded', 10);
    }
  }

  if (
    owned.has('holdout')
    && !nextProgress.holdoutRewarded
    && category === 'fullhouse'
    && currentRound >= 9
    && getAugmentScoreValue(score) > 0
  ) {
    addQuestReward(nextProgress, rewards, 'holdout', 'holdoutRewarded', 7);
  }

  if (owned.has('cautious-straight') && !nextProgress.cautiousRewarded && !nextProgress.cautiousFailed && category === 'l-straight') {
    if (scores['s-straight'] === undefined) nextProgress.cautiousFailed = true;
    else addQuestReward(nextProgress, rewards, 'cautious-straight', 'cautiousRewarded', 7);
  }

  if (owned.has('copycat') && !nextProgress.copycatRewarded && opponentScores[category] !== undefined) {
    nextProgress.copycatCount = (nextProgress.copycatCount || 0) + 1;
    if (LOWER_CATEGORIES.has(category) && copycatScoreValue === copycatOpponentScoreValue && copycatScoreValue > 0) {
      nextProgress.copycatSpecialCleared = true;
      facts.copycatSpecialCleared = true;
      addQuestReward(nextProgress, rewards, 'copycat', 'copycatRewarded', 10);
    } else if (nextProgress.copycatCount >= 3) {
      addQuestReward(nextProgress, rewards, 'copycat', 'copycatRewarded', 10);
    }
  }

  if (owned.has('doubling') && !nextProgress.doublingRewarded) {
    const values = categoryIds
      .map((categoryId) => scores[categoryId])
      .map((value) => typeof value === 'object' ? value?.score : value)
      .filter((value) => Number(value) > 0);
    if (values.some((value, index) => values.indexOf(value) !== index)) {
      facts.doublingValues = values;
      addQuestReward(nextProgress, rewards, 'doubling', 'doublingRewarded', 10);
    }
  }

  if (owned.has('bounty-hunter') && nextBounty && bountyTarget === category) {
    nextBounty.count = (nextBounty.count || 0) + 1;
    if ((Number(score?.score) || 0) === 0) nextBounty.penaltyCount = (nextBounty.penaltyCount || 0) + 1;
    facts.bountyRemaining = 3 - nextBounty.count;
    if (nextBounty.count === 3) {
      addQuestReward(nextProgress, rewards, 'bounty-hunter', 'bountyHunterRewarded', Math.max(0, 15 - nextBounty.penaltyCount * 3));
    }
  }

  let prophetReward = 0;
  if (owned.has('prophet') && nextProphet?.remaining > 0) {
    if (nextProphet.numbers.includes(getAugmentScoreValue(score))) {
      prophetReward = 7;
      nextProphet.successes = (nextProphet.successes || 0) + 1;
    }
    nextProphet.remaining -= 1;
    if (clearProphetNumbers) nextProphet.numbers = [];
  }

  if (
    evaluateNozdormu
    && owned.has('nozdormu')
    && !nextProgress.nozdormuRewarded
    && currentRound >= nextProgress.nozdormuTargetRound
  ) {
    addQuestReward(nextProgress, rewards, 'nozdormu', 'nozdormuRewarded', 9);
  }

  return {
    progress: nextProgress,
    bountyProgress: nextBounty,
    prophetState: nextProphet,
    prophetReward,
    rewards,
    facts
  };
}
