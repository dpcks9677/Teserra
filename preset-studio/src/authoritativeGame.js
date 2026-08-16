import { calculateScores, calculateUpperScoreTotal, augmentDefinitions } from "./scoreEngine.js";
import {
  canAcquireAugment,
  createAugmentApplicationPlan,
  createProphetCandidates,
  createQuestProgressPlan,
  getAugmentScoreValue as getScoreValue,
  getRandomBoxCandidates,
  hasAugmentConflict,
  selectRandomBoxAward
} from "./augmentRules.js";
import { DIE_FACES } from "./diceRules.js";
import { SCORE_CATEGORIES } from "./game/core/gameConstants.js";
import { resolveTurnAdvance } from "./game/core/turnFlow.js";
import { selectBestTimeoutScore } from "./game/core/turnTimeout.js";
import { createScoreDecision } from "./game/core/scoreCommit.js";
import { calculatePlayerTotal } from "./game/core/endGameSummary.js";

export { SCORE_CATEGORIES } from "./game/core/gameConstants.js";

export { DIE_FACES } from "./diceRules.js";

const PHASE_ROUNDS = new Set([1, 6, 9]);
const PHASE_ONE_ONLY = new Set(["step-by-step", "fast-straight"]);
const UNAVAILABLE_AUGMENTS = new Set(["strange-die"]);

export class GameRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new GameRuleError(code, message);
}

function playerMap(playerCount, makeValue) {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [index + 1, makeValue(index + 1)]));
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) & 0x7fffffff;
  return hash;
}

function seededShuffle(items, seed) {
  const result = [...items];
  let hash = hashString(seed);
  const random = () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) & 0x7fffffff;
    return hash / 0x80000000;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function expectedAugmentCount(round) {
  if (round >= 9) return 3;
  if (round >= 6) return 2;
  return 1;
}

function getOwnedAugments(state, player) {
  return Object.values(state.activeAugments[player] || {});
}

function hasAugment(state, player, augmentId) {
  return getOwnedAugments(state, player).includes(augmentId);
}

function getDraftOptions(state, player) {
  const owned = new Set(getOwnedAugments(state, player));
  const candidates = Object.keys(augmentDefinitions).filter((augmentId) => (
    !UNAVAILABLE_AUGMENTS.has(augmentId)
    && (augmentId !== "holdout" || state.scores?.[player]?.fullhouse === undefined)
    && canAcquireAugment(owned, augmentId)
    && (state.currentRound < 6 || !PHASE_ONE_ONLY.has(augmentId))
  ));
  return seededShuffle(candidates, `${state.seed}_R${state.currentRound}_P${player}`).slice(0, 3);
}

function getTurnDuration(state, player = state.currentPlayer) {
  const progress = state.questProgress[player] || {};
  const hasNozdormu = getOwnedAugments(state, player).includes("nozdormu");
  return hasNozdormu && !progress.nozdormuRewarded ? 15 : 45;
}

function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) fail("INVALID_RANDOM_RANGE", "주사위 난수 범위가 잘못됨.");
  const ceiling = 0x100000000;
  const limit = ceiling - (ceiling % max);
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}

function assertPlayerTurn(state, player) {
  if (state.ended) fail("GAME_ENDED", "이미 종료된 게임임.");
  if (Number(player) !== state.currentPlayer) fail("NOT_YOUR_TURN", "현재 플레이어의 명령이 아님.");
}

function assertParticipant(state, player) {
  const index = Number(player);
  if (!Number.isInteger(index) || index < 1 || index > state.playerCount) {
    fail("INVALID_PLAYER", "참가하지 않은 플레이어임.");
  }
}

function addQuestReward(state, player, key, points) {
  const progress = state.questProgress[player];
  if (progress[key]) return;
  progress[key] = true;
  progress.questBonus = (progress.questBonus || 0) + points;
}

function getUpperSum(state, player) {
  return calculateUpperScoreTotal(state.scores[player], state.activeAugments[player]);
}

function applyUpperBonus(state, player) {
  const progress = state.questProgress[player];
  if (getUpperSum(state, player) >= state.upperBonusThreshold[player]) {
    state.scores[player].bonus = progress.stepRewarded ? 55 : 35;
  }
}

function getScoringDice(state, player) {
  const dice = state.dice.filter((die) => die.type !== "weird");
  const bank = state.yachtBankState[player];
  const bankActive = state.activeAugments[player]?.yacht === "yacht-bank"
    && bank?.turnsLeft > 0
    && !bank.completed;

  if (bankActive) {
    const unkept = dice.filter((die) => !die.kept);
    if (unkept.length > 5) fail("SELECT_FIVE_DICE", "족보에 사용할 주사위 5개를 남겨야 함.");
    return unkept;
  }
  if (dice.length > 5) {
    const selected = dice.filter((die) => die.kept);
    if (selected.length !== 5) fail("SELECT_FIVE_DICE", "족보에 사용할 주사위 5개를 선택해야 함.");
    return selected;
  }
  return dice;
}

function getScoreContext(state, player, scoringDice) {
  return {
    bank: state.yachtBankState[player]?.accumulatedScore || 0,
    fullDice: [
      ...scoringDice.map(({ value, type }) => ({ value, type })),
      ...state.dice.filter((die) => die.type === "weird").map(({ value, type }) => ({ value, type }))
    ]
  };
}

export function previewScores(state, player = state.currentPlayer) {
  assertPlayerTurn(state, player);
  if (state.phase !== "action" || state.turnRollCount < 1) {
    fail("ROLL_REQUIRED", "점수 계산 전에 주사위를 굴려야 함.");
  }
  const scoringDice = getScoringDice(state, player);
  const scores = calculateScores(
    scoringDice.map((die) => die.value),
    state.activeAugments[player],
    getScoreContext(state, player, scoringDice)
  );
  const hasMomentum = getOwnedAugments(state, player).includes("momentum");
  return Object.fromEntries(Object.entries(scores).map(([category, scoreInfo]) => [
    category,
    createScoreDecision({
      scoreInfo,
      hasMomentum,
      momentumState: state.momentumState[player],
      doubleDownState: state.doubleDownState[player]
    }).scoreInfo
  ]));
}

function applyQuestProgress(state, player, category, score, scoringDice) {
  const opponent = player === 1 ? 2 : 1;
  const plan = createQuestProgressPlan({
    augmentIds: getOwnedAugments(state, player),
    progress: state.questProgress[player],
    category,
    score,
    scores: state.scores[player],
    categoryIds: SCORE_CATEGORIES,
    opponentScores: state.scores[opponent],
    scoringDiceValues: scoringDice.map((die) => die.value),
    currentRound: state.currentRound,
    isFirstRollScore: state.turnRollCount === 1,
    noTimeProgressField: "noTimeRemaining",
    fastStraightSatisfied: getScoreValue(state.scores[player]["s-straight"]) > 0
      && getScoreValue(state.scores[player]["l-straight"]) > 0,
    bountyTarget: state.bountyHunterTarget[player],
    bountyProgress: state.bountyHunterProgress[player],
    prophetState: state.prophetState[player],
    clearProphetNumbers: true
  });
  state.questProgress[player] = plan.progress;
  state.bountyHunterProgress[player] = plan.bountyProgress;
  state.prophetState[player] = plan.prophetState;
  if (plan.prophetReward) {
    state.questProgress[player].questBonus = (state.questProgress[player].questBonus || 0) + plan.prophetReward;
  }
}

function getProphetCandidates(state, player) {
  return createProphetCandidates({
    categoryIds: SCORE_CATEGORIES,
    scores: state.scores[player],
    activeAugments: state.activeAugments[player],
    calculateScores,
    scoreContext: getScoreContext(state, player, [])
  });
}

function prepareProphetTurn(state) {
  const player = state.currentPlayer;
  const prophet = state.prophetState[player];
  if (!hasAugment(state, player, "prophet") || prophet.remaining <= 0) return;
  const turnKey = `${state.currentRound}:${player}:${state.isExtraTurnPhase ? "extra" : "normal"}`;
  if (prophet.turnKey === turnKey && prophet.numbers.length === 3) return;
  const candidates = getProphetCandidates(state, player);
  prophet.numbers = seededShuffle(candidates, `${state.seed}_PROPHET_${turnKey}`).slice(0, 3);
  prophet.turnKey = turnKey;
}

function applyAugment(state, player, augmentId) {
  const plan = createAugmentApplicationPlan({
    definitions: augmentDefinitions,
    augmentId,
    activeAugments: state.activeAugments[player],
    scores: state.scores[player],
    currentRound: state.currentRound,
    upperBonusThreshold: state.upperBonusThreshold[player]
  });
  if (plan.status === "invalid") fail("INVALID_AUGMENT", "알 수 없는 증강임.");
  if (plan.status === "duplicate") fail("DUPLICATE_AUGMENT", "이미 보유한 증강임.");
  const target = plan.target;

  if (plan.clearsScore) {
    delete state.scores[player][target];
    state.extraTurns[player] += 1;
  }
  state.activeAugments[player][target] = augmentId;

  if (plan.upperBonusThreshold !== null) state.upperBonusThreshold[player] = plan.upperBonusThreshold;
  if (plan.resetEquivalentExchange) {
    state.equivalentExchangeUses[player] = 3;
    state.equivalentExchangePenalty[player] = 0;
  }
  if (plan.recordPromotionRound) state.promotionAcquiredRound[player] = state.currentRound;
  if (plan.resetYachtBank) {
    state.yachtBankState[player] = { turnsLeft: 3, accumulatedScore: 0, completed: false };
  }
  if (plan.resetNoTime) {
    Object.assign(state.questProgress[player], { noTimeRemaining: 3, noTimeFailed: false, noTimeRewarded: false });
  }
  if (plan.nozdormuTargetRound !== null) state.questProgress[player].nozdormuTargetRound = plan.nozdormuTargetRound;
  if (plan.resetBountyHunter) {
    state.bountyHunterProgress[player] = { count: 0, penaltyCount: 0 };
    state.bountyHunterAcquiredRound[player] = state.currentRound;
  }
  if (plan.resetDuel) {
    state.duelState[player] = { round: state.currentRound, ownerScore: null, opponentScore: null, resolved: false };
  }
  if (plan.resetRandomBox) state.randomBoxAward[player] = null;
  if (plan.resetProphet) {
    state.prophetState[player] = { remaining: 3, numbers: [], successes: 0, turnKey: null };
  }
  if (plan.resetPiggyBank) state.piggyBankState[player] = { balance: 0, payouts: 0 };
}

function resolveRandomBoxes(state) {
  for (let player = 1; player <= state.playerCount; player += 1) {
    if (state.activeAugments[player]?.eh15 !== "random-box" || state.randomBoxAward[player]) continue;
    delete state.activeAugments[player].eh15;
    const owned = new Set(getOwnedAugments(state, player));
    const candidates = getRandomBoxCandidates({
      definitions: augmentDefinitions,
      ownedIds: owned,
      unavailableIds: UNAVAILABLE_AUGMENTS
    });
    const ordered = seededShuffle(candidates, `${state.seed}_RANDOM_BOX_R${state.currentRound}_P${player}`);
    const awarded = selectRandomBoxAward(ordered, 0);
    state.randomBoxAward[player] = awarded;
    if (awarded) applyAugment(state, player, awarded);
  }
}

function setDraftOrActionPhase(state) {
  if (state.mode === "augmented" && state.currentPlayer === 1 && PHASE_ROUNDS.has(state.currentRound)) {
    const expected = expectedAugmentCount(state.currentRound);
    const draftPlayer = Array.from({ length: state.playerCount }, (_, index) => index + 1)
      .find((player) => state.draftSelections[player] < expected);
    if (draftPlayer) {
      state.phase = "draft";
      state.draftPlayer = draftPlayer;
      state.draftOptions = getDraftOptions(state, draftPlayer);
      state.turnTimeRemaining = 30;
      return;
    }
  }

  state.phase = "action";
  state.draftPlayer = null;
  state.draftOptions = [];
  state.rollsLeft = 3;
  state.turnRollCount = 0;
  state.dice = [];
  state.equivalentExchangeTurnUses[state.currentPlayer] = 0;
  state.turnTimeRemaining = getTurnDuration(state);
  assignBountyTarget(state);
  prepareProphetTurn(state);
}

function rewardNozdormuIfDue(state, player) {
  const progress = state.questProgress[player];
  if (
    getOwnedAugments(state, player).includes("nozdormu")
    && !progress.nozdormuRewarded
    && state.currentRound >= progress.nozdormuTargetRound
  ) {
    addQuestReward(state, player, "nozdormuRewarded", 9);
  }
}

function assignBountyTarget(state) {
  const player = state.currentPlayer;
  const bounty = state.bountyHunterProgress[player];
  if (!getOwnedAugments(state, player).includes("bounty-hunter") || bounty.count >= 3) {
    state.bountyHunterTarget[player] = null;
    return;
  }
  const unfilled = SCORE_CATEGORIES.filter((category) => state.scores[player][category] === undefined);
  const shuffled = seededShuffle(unfilled, `${state.seed}_BHTARGET_R${state.currentRound}_P${player}`);
  state.bountyHunterTarget[player] = shuffled[0] || null;
}

function hasCompleteScorecard(state, player) {
  return SCORE_CATEGORIES.every((category) => state.scores[player][category] !== undefined);
}

function advanceTurn(state) {
  const finishedPlayer = state.currentPlayer;
  rewardNozdormuIfDue(state, finishedPlayer);
  if (state.gambitState[finishedPlayer] === "penalty") state.gambitState[finishedPlayer] = "pending-reward";
  else if (state.gambitState[finishedPlayer] === "reward") state.gambitState[finishedPlayer] = "used";

  const transition = resolveTurnAdvance({
    currentPlayer: state.currentPlayer,
    currentRound: state.currentRound,
    playerCount: state.playerCount,
    isExtraTurnPhase: state.isExtraTurnPhase,
    extraTurns: state.extraTurns,
    hasRemainingCategory: (player) => !hasCompleteScorecard(state, player)
  });
  state.currentPlayer = transition.currentPlayer;
  state.currentRound = transition.currentRound;
  state.isExtraTurnPhase = transition.isExtraTurnPhase;
  state.extraTurns = transition.extraTurns;

  if (transition.kind === "game-end") {
    state.ended = true;
    state.phase = "ended";
    state.turnTimeRemaining = 0;
    return;
  }
  beginTurn(state);
}

export function beginTurn(state) {
  if (state.ended) return state;
  const player = state.currentPlayer;
  if (state.gambitState[player] === "pending-reward") state.gambitState[player] = "reward";

  const bank = state.yachtBankState[player];
  if (
    state.activeAugments[player]?.yacht === "yacht-bank"
    && bank?.turnsLeft === 0
    && state.scores[player].yacht === undefined
  ) {
    bank.completed = true;
    state.scores[player].yacht = { score: Math.min(bank.accumulatedScore, 15), bonus: 0, bonusDetails: [] };
    advanceTurn(state);
    return state;
  }

  setDraftOrActionPhase(state);
  state.revision += 1;
  return state;
}

export function createAuthoritativeGame({ mode = "normal", playerCount = 2, seed = "DEFAULT" } = {}) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
    fail("INVALID_PLAYER_COUNT", "플레이어 수가 잘못됨.");
  }
  const state = {
    version: 1,
    revision: 0,
    mode: mode === "augmented" ? "augmented" : "normal",
    seed: String(seed),
    playerCount,
    currentRound: 1,
    currentPlayer: 1,
    phase: "action",
    draftPlayer: null,
    draftOptions: [],
    rollsLeft: 3,
    turnRollCount: 0,
    turnTimeRemaining: 45,
    dice: [],
    nextDieId: 1,
    scores: playerMap(playerCount, () => ({})),
    activeAugments: playerMap(playerCount, () => ({})),
    draftSelections: playerMap(playerCount, () => 0),
    extraTurns: playerMap(playerCount, () => 0),
    isExtraTurnPhase: false,
    questProgress: playerMap(playerCount, () => ({ questBonus: 0 })),
    globalBonus: playerMap(playerCount, () => 0),
    momentumState: playerMap(playerCount, () => "ready"),
    upperBonusThreshold: playerMap(playerCount, () => 63),
    yachtBankState: playerMap(playerCount, () => ({ turnsLeft: 0, accumulatedScore: 0, completed: false })),
    destroyedStrangeDice: playerMap(playerCount, () => false),
    promotionConsumed: playerMap(playerCount, () => false),
    promotionAcquiredRound: playerMap(playerCount, () => null),
    equivalentExchangeUses: playerMap(playerCount, () => 0),
    equivalentExchangePenalty: playerMap(playerCount, () => 0),
    equivalentExchangeTurnUses: playerMap(playerCount, () => 0),
    playerTableFlipUsed: playerMap(playerCount, () => false),
    bountyHunterTarget: playerMap(playerCount, () => null),
    bountyHunterAcquiredRound: playerMap(playerCount, () => null),
    bountyHunterProgress: playerMap(playerCount, () => ({ count: 0, penaltyCount: 0 })),
    duelState: playerMap(playerCount, () => ({ round: null, ownerScore: null, opponentScore: null, resolved: false })),
    coinTossState: playerMap(playerCount, () => ({ used: false, heads: null })),
    randomBoxAward: playerMap(playerCount, () => null),
    prophetState: playerMap(playerCount, () => ({ remaining: 0, numbers: [], successes: 0, turnKey: null })),
    gambitState: playerMap(playerCount, () => "ready"),
    doubleDownState: playerMap(playerCount, () => "ready"),
    piggyBankState: playerMap(playerCount, () => ({ balance: 0, payouts: 0 })),
    diceAlchemyUsed: playerMap(playerCount, () => false),
    ended: false
  };
  return beginTurn(state);
}

export function selectAugment(state, player, augmentId) {
  assertParticipant(state, player);
  if (state.ended) fail("GAME_ENDED", "이미 종료된 게임임.");
  if (state.phase !== "draft" || Number(player) !== state.draftPlayer) {
    fail("NOT_DRAFTING", "현재 증강을 선택할 수 없음.");
  }
  if (!state.draftOptions.includes(augmentId)) fail("AUGMENT_NOT_OFFERED", "제시되지 않은 증강임.");
  if (hasAugmentConflict(getOwnedAugments(state, player), augmentId)) {
    fail("AUGMENT_CONFLICT", "동시에 보유할 수 없는 증강임.");
  }
  applyAugment(state, player, augmentId);
  state.draftSelections[player] += 1;

  const expected = expectedAugmentCount(state.currentRound);
  const nextDraftPlayer = Array.from({ length: state.playerCount }, (_, index) => index + 1)
    .find((candidate) => state.draftSelections[candidate] < expected);
  if (nextDraftPlayer) {
    state.draftPlayer = nextDraftPlayer;
    state.draftOptions = getDraftOptions(state, nextDraftPlayer);
    state.turnTimeRemaining = 30;
  } else {
    resolveRandomBoxes(state);
    setDraftOrActionPhase(state);
  }
  state.revision += 1;
  return state;
}

function getDesiredDiceTypes(state, player) {
  const augments = getOwnedAugments(state, player);
  const types = [];
  if (augments.includes("strange-die") && !state.destroyedStrangeDice[player]) types.push("weird");
  if (augments.includes("promotion-die") && !state.promotionConsumed[player]) types.push("promotion");
  if (augments.includes("weighted-dice")) types.push("heavy");
  if (augments.includes("golden-die")) types.push("golden");
  if (augments.includes("8-sided")) types.push("octahedron", "octahedron");
  if (augments.includes("couple-dice")) types.push("couple", "couple");
  if (augments.includes("sevens-dice")) types.push("sevens", "sevens");
  return types;
}

function rollValue(type, promotionLevel, randomInt) {
  if (type === "promotion") return Math.min(6, 1 + promotionLevel);
  const faces = DIE_FACES[type] || DIE_FACES.normal;
  return faces[randomInt(faces.length)];
}

function rollUnkeptDice(state, player, randomInt) {
  const kept = state.turnRollCount === 1 ? [] : state.dice.filter((die) => die.kept);
  const gambitActive = ["penalty", "reward"].includes(state.gambitState[player]);
  const desired = gambitActive ? [] : getDesiredDiceTypes(state, player);
  for (const die of kept) {
    const index = desired.indexOf(die.type);
    if (index >= 0) desired.splice(index, 1);
  }
  const totalAllowed = gambitActive
    ? (state.gambitState[player] === "penalty" ? 4 : 6)
    : 5 + (getOwnedAugments(state, player).includes("strange-die") && !state.destroyedStrangeDice[player] ? 1 : 0);
  while (kept.length + desired.length < totalAllowed) desired.push("normal");

  const promotionLevel = Math.max(0, state.currentRound - (state.promotionAcquiredRound[player] || state.currentRound));
  const rolled = desired.map((type) => ({
    id: state.nextDieId++,
    type,
    value: rollValue(type, promotionLevel, randomInt),
    promotionLevel: type === "promotion" ? promotionLevel : 0,
    kept: false
  }));
  state.dice = [
    ...kept.map((die) => ({ ...die, kept: true })),
    ...rolled
  ];
}

export function rollDice(state, player, { tableFlip = false, randomInt = secureRandomInt } = {}) {
  assertPlayerTurn(state, player);
  if (state.phase !== "action") fail("INVALID_PHASE", "현재 주사위를 굴릴 수 없음.");
  if (typeof randomInt !== "function") fail("INVALID_RANDOM_SOURCE", "난수 생성기가 잘못됨.");

  if (tableFlip) {
    if (!getOwnedAugments(state, player).includes("table-flip")) fail("AUGMENT_REQUIRED", "판 뒤집기 증강이 없음.");
    if (state.playerTableFlipUsed[player]) fail("TABLE_FLIP_USED", "이미 판 뒤집기를 사용함.");
    if (state.turnRollCount < 1) fail("ROLL_REQUIRED", "첫 굴림 후 판 뒤집기를 사용할 수 있음.");
    state.playerTableFlipUsed[player] = true;
  } else if (state.rollsLeft > 0) {
    state.rollsLeft -= 1;
    state.turnRollCount += 1;
  } else if (state.equivalentExchangeUses[player] > 0 && getOwnedAugments(state, player).includes("equivalent-exchange")) {
    state.equivalentExchangeUses[player] -= 1;
    state.equivalentExchangePenalty[player] += 5;
    state.equivalentExchangeTurnUses[player] += 1;
    state.turnRollCount += 1;
  } else {
    fail("NO_ROLLS_LEFT", "남은 굴리기가 없음.");
  }

  rollUnkeptDice(state, player, randomInt);
  state.revision += 1;
  return state;
}

export function setDieKept(state, player, dieId, isKept) {
  assertPlayerTurn(state, player);
  if (state.phase !== "action" || state.turnRollCount < 1) fail("ROLL_REQUIRED", "굴린 주사위만 킵할 수 있음.");
  const die = state.dice.find((item) => item.id === Number(dieId));
  if (!die) fail("DIE_NOT_FOUND", "주사위를 찾을 수 없음.");
  if (isKept && !die.kept && state.dice.filter((item) => item.kept).length >= 5) {
    fail("KEEP_LIMIT", "최대 5개의 주사위만 킵할 수 있음.");
  }
  die.kept = Boolean(isKept);
  state.revision += 1;
  return state;
}

function storeScore(state, player, category, score, scoringDice) {
  const decision = createScoreDecision({
    scoreInfo: score,
    hasMomentum: getOwnedAugments(state, player).includes("momentum"),
    momentumState: state.momentumState[player],
    doubleDownState: state.doubleDownState[player]
  });
  const finalScore = decision.scoreInfo;
  state.momentumState[player] = decision.nextMomentumState;
  state.doubleDownState[player] = decision.nextDoubleDownState;
  state.scores[player][category] = finalScore;
  applyQuestProgress(state, player, category, finalScore, scoringDice);

  for (let owner = 1; owner <= state.playerCount; owner += 1) {
    const duel = state.duelState[owner];
    if (duel.resolved || duel.round !== state.currentRound) continue;
    const opponent = owner === 1 ? 2 : 1;
    if (player === owner) duel.ownerScore = getScoreValue(finalScore);
    if (player === opponent) duel.opponentScore = getScoreValue(finalScore);
    if (duel.ownerScore === null || duel.opponentScore === null) continue;
    if (duel.ownerScore > duel.opponentScore) state.globalBonus[owner] += 10;
    else if (duel.ownerScore === duel.opponentScore) state.globalBonus[owner] += 5;
    duel.resolved = true;
  }

  if (hasAugment(state, player, "piggy-bank")) {
    const piggy = state.piggyBankState[player];
    piggy.balance += state.rollsLeft * 3;
    if (piggy.balance >= 12) {
      state.globalBonus[player] += 12;
      piggy.balance = 0;
      piggy.payouts += 1;
    }
  }

  if (state.dice.some((die) => die.type === "weird" && die.value === 6)) {
    state.destroyedStrangeDice[player] = true;
  }
  if (scoringDice.some((die) => die.type === "promotion" && die.value === 6)) {
    state.promotionConsumed[player] = true;
  }

  const bank = state.yachtBankState[player];
  if (state.activeAugments[player]?.yacht === "yacht-bank" && bank.turnsLeft > 0 && !bank.completed) {
    const keptSum = state.dice
      .filter((die) => die.kept && die.type !== "weird")
      .reduce((sum, die) => sum + die.value, 0);
    bank.accumulatedScore = Math.min(15, bank.accumulatedScore + keptSum);
    bank.turnsLeft -= 1;
  }
  applyUpperBonus(state, player);
}

export function scoreCategory(state, player, category) {
  assertPlayerTurn(state, player);
  if (state.phase !== "action") fail("INVALID_PHASE", "현재 점수를 기입할 수 없음.");
  if (!SCORE_CATEGORIES.includes(category)) fail("INVALID_CATEGORY", "알 수 없는 족보임.");
  if (state.scores[player][category] !== undefined) fail("CATEGORY_FILLED", "이미 기입된 족보임.");
  if (state.turnRollCount < 1) fail("ROLL_REQUIRED", "점수 기입 전에 주사위를 굴려야 함.");

  const scoringDice = getScoringDice(state, player);
  const scores = calculateScores(
    scoringDice.map((die) => die.value),
    state.activeAugments[player],
    getScoreContext(state, player, scoringDice)
  );
  storeScore(state, player, category, scores[category], scoringDice);
  state.revision += 1;
  advanceTurn(state);
  return state;
}

export function useAugmentAction(state, player, augmentId, { randomInt = secureRandomInt } = {}) {
  assertPlayerTurn(state, player);
  if (state.phase !== "action") fail("INVALID_PHASE", "현재 증강을 사용할 수 없음.");
  if (!hasAugment(state, player, augmentId)) fail("AUGMENT_REQUIRED", "해당 증강이 없음.");

  if (augmentId === "coin-toss") {
    const coin = state.coinTossState[player];
    if (coin.used) fail("AUGMENT_USED", "이미 코인 토스를 사용함.");
    if (state.turnRollCount < 1) fail("ROLL_REQUIRED", "첫 굴림 후 사용할 수 있음.");
    coin.used = true;
    coin.heads = Array.from({ length: 3 }, () => randomInt(2)).filter(Boolean).length;
    if (coin.heads === 0) state.globalBonus[player] -= 5;
    if (coin.heads === 1) {
      const target = [...state.dice].sort((a, b) => a.value - b.value || a.id - b.id)[0];
      if (target) target.value = 6;
    }
    if (coin.heads === 2) state.rollsLeft += 1;
    if (coin.heads === 3) state.upperBonusThreshold[player] = Math.min(state.upperBonusThreshold[player], 57);
  } else if (augmentId === "gambit") {
    if (state.gambitState[player] !== "ready") fail("AUGMENT_USED", "이미 갬빗을 사용함.");
    if (state.turnRollCount > 0) fail("ROLL_NOT_ALLOWED", "굴리기 전에 사용해야 함.");
    state.gambitState[player] = "penalty";
  } else if (augmentId === "double-down") {
    if (state.currentRound < 9) fail("ROUND_REQUIRED", "9턴부터 사용할 수 있음.");
    if (state.doubleDownState[player] !== "ready") fail("AUGMENT_USED", "이미 더블 다운을 사용함.");
    if (state.turnRollCount > 0) fail("ROLL_NOT_ALLOWED", "굴리기 전에 사용해야 함.");
    state.doubleDownState[player] = "active";
  } else if (augmentId === "dice-alchemy") {
    if (state.diceAlchemyUsed[player]) fail("AUGMENT_USED", "이미 주사위 연금술을 사용함.");
    if (state.turnRollCount < 1) fail("ROLL_REQUIRED", "첫 굴림 후 사용할 수 있음.");
    state.diceAlchemyUsed[player] = true;
    for (const die of state.dice) {
      if (!die.kept) die.value = Math.max(1, die.value - 1);
    }
  } else {
    fail("INVALID_AUGMENT_ACTION", "액션형 증강이 아님.");
  }
  state.revision += 1;
  return state;
}

function forceBestScore(state) {
  const player = state.currentPlayer;
  const unfilled = SCORE_CATEGORIES.filter((category) => state.scores[player][category] === undefined);
  if (!unfilled.length) {
    advanceTurn(state);
    return;
  }

  let scoringDice = [];
  let scores;
  if (state.turnRollCount < 1) {
    scores = calculateScores([0, 0, 0, 0, 0], state.activeAugments[player], { bank: state.yachtBankState[player].accumulatedScore, fullDice: [] });
  } else {
    try {
      scoringDice = getScoringDice(state, player);
      scores = calculateScores(
        scoringDice.map((die) => die.value),
        state.activeAugments[player],
        getScoreContext(state, player, scoringDice)
      );
    } catch {
      scores = Object.fromEntries(SCORE_CATEGORIES.map((category) => [category, { score: 0, bonus: 0, bonusDetails: [] }]));
    }
  }
  const bestScore = selectBestTimeoutScore({
    categoryIds: SCORE_CATEGORIES,
    recordedScores: state.scores[player],
    potentialScores: scores
  });
  storeScore(state, player, bestScore.categoryId, bestScore.scoreInfo, scoringDice);
  state.revision += 1;
  advanceTurn(state);
}

export function expirePhase(state, { randomInt = secureRandomInt } = {}) {
  if (state.ended) return state;
  if (state.phase === "draft") {
    selectAugment(state, state.draftPlayer, state.draftOptions[0]);
  } else {
    forceBestScore(state);
  }
  return state;
}

export function getPlayerTotal(state, player) {
  return calculatePlayerTotal({
    scores: state.scores[player],
    activeAugments: state.activeAugments[player],
    yachtBankState: state.yachtBankState[player],
    questProgress: state.questProgress[player],
    globalBonus: state.globalBonus[player],
    equivalentExchangePenalty: state.equivalentExchangePenalty[player]
  });
}

export function isCompleteGame(state) {
  return state.ended && Array.from({ length: state.playerCount }, (_, index) => index + 1)
    .every((player) => hasCompleteScorecard(state, player));
}

export function getPublicGameState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  delete snapshot.seed;
  delete snapshot.nextDieId;
  return snapshot;
}
