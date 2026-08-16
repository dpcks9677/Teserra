import { getLocalDieValue } from './diceRules.js';
import { getDicePresetKey } from './dicePresetRules.js';

function defaultRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export function createLocalRollOutcome({
  configs,
  keptDice = [],
  nextDieId = 1,
  action = 'roll',
  randomInt = defaultRandomInt
}) {
  if (!Array.isArray(configs) || !Array.isArray(keptDice)) {
    throw new TypeError('주사위 설정과 킵 주사위 배열이 필요함.');
  }

  let id = nextDieId;
  const rolledDice = configs.map((config) => ({
    id: id++,
    type: config?.type || 'normal',
    promotionLevel: Math.max(0, Number(config?.promotionLevel) || 0),
    value: getLocalDieValue(config, randomInt),
    kept: false
  }));
  const dice = [
    ...keptDice.map((die) => ({ ...die, kept: true })),
    ...rolledDice
  ];
  const isFlip = action === 'tableFlip';

  return {
    dice,
    rolledDice,
    nextDieId: id,
    presetKey: getDicePresetKey(rolledDice, { isFlip }),
    presetIndex: randomInt(isFlip ? 10 : 20),
    mirrored: randomInt(2) === 1,
    source: 'local-preset'
  };
}
