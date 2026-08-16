const achievement = (id, augmentId, name, description, target = 1) => ({ id, augmentId, name, description, target });

export const specialAchievementDefinitions = {
  'lucky-sevens': [
    achievement('lucky-sevens-lucky-seven', 'lucky-sevens', '행운의 럭키 세븐', '럭키 세븐 족보를 합계 7인 주사위로 기입하세요.'),
    achievement('lucky-sevens-slot-machine', 'lucky-sevens', '슬롯머신', '럭키 세븐 족보를 합계 27인 주사위로 기입하세요.', 3)
  ],
  'perfect-squares': [achievement('perfect-squares-minimum', 'perfect-squares', '최소 제곱', '퍼펙트 스퀘어 족보를 합계 9인 주사위로 기입하세요.', 3)],
  'prime-numbers': [
    achievement('prime-numbers-prime-set', 'prime-numbers', '소수 집합체', '모든 주사위가 2, 3, 5 중 하나일 때 프라임 넘버즈 족보를 기입하세요.', 3),
    achievement('prime-numbers-master', 'prime-numbers', '소수 마스터', '프라임 넘버즈 족보에 12점을 기록하고 게임에서 승리하세요.', 5),
    achievement('prime-numbers-235', 'prime-numbers', '2와 3과 5', '2, 3, 5를 각각 하나 이상 포함해 프라임 넘버즈 족보를 기입하세요.', 3)
  ],
  'gambler': [
    achievement('gambler-all-in', 'gambler', '올인 승부사', '갬블러 족보로 30점 이상 획득하고 게임에서 승리하세요.', 5),
    achievement('gambler-minimum', 'gambler', '턱걸이 갬블러', '갬블러 족보를 합계 24인 주사위로 기입하세요.', 5)
  ],
  'three-of-a-kind': [achievement('three-of-a-kind-full-house', 'three-of-a-kind', '이건 풀하우스였잖아', '풀하우스 모양의 주사위로 쓰리 오브 어 카인드 족보를 기입하세요.')],
  'four-by-four': [
    achievement('four-by-four-jackpot', 'four-by-four', '잭팟 4444', '4 눈금 네 개 이상으로 포 바이 포 보너스를 획득하세요.', 3),
    achievement('four-by-four-risky', 'four-by-four', '위험한 강행', '4가 아닌 눈금 네 개 이상으로 포 바이 포 족보를 기입하세요.')
  ],
  'tiny-house': [achievement('tiny-house-small', 'tiny-house', '아기자기한 집', '1, 2, 3 눈금만 사용해 타이니 하우스 족보를 기입하세요.')],
  'two-pair': [achievement('two-pair-fast', 'two-pair', '신속한 투페어', '첫 굴림 직후 투 페어 족보를 기입하세요.', 2)],
  'head-and-tail': [
    achievement('head-and-tail-jakhon', 'head-and-tail', '작혼', '머리와 몸통 족보로 30점 이상 획득하세요.', 3),
    achievement('head-and-tail-perfect', 'head-and-tail', '용두용미', '4, 5, 6, 6, 6 조합으로 머리와 몸통 족보를 기입하세요.', 2)
  ],
  'double-large-straight': [
    achievement('double-large-straight-upper-bonus', 'double-large-straight', '상단 보너스 단축', '완화된 상단 보너스 기준 60점을 달성하세요.', 3),
    achievement('double-large-straight-collector', 'double-large-straight', '스트레이트 컬렉터', '한 게임에서 두 라지 스트레이트 족보에 1~5와 2~6 조합을 각각 기입하세요.')
  ],
  'duplex-house': [
    achievement('duplex-house-adjacent', 'duplex-house', '밀착 건설', '연속된 두 눈금으로 땅콩주택 족보를 기입하세요.', 5),
    achievement('duplex-house-highest', 'duplex-house', '최고층 땅콩주택', '5와 6으로 땅콩주택 족보를 기입하세요.', 3)
  ],
  'mountain': [
    achievement('mountain-first-roll', 'mountain', '뒷동산 등반', '첫 굴림 직후 마운틴 족보를 기입하세요.'),
    achievement('mountain-king', 'mountain', '산악왕', '마운틴 족보에 40점을 기록하고 게임에서 승리하세요.', 5)
  ],
  'high-dice': [achievement('high-dice-runners-high', 'high-dice', '러너스 하이', '합계 28 이상의 주사위로 하이 다이스 족보를 기입하세요.', 3)],
  '2nd-choice': [achievement('2nd-choice-yacht-shape', '2nd-choice', '도망친 곳에 낙원은 없다', '요트 모양의 주사위로 두 번째 초이스 족보를 기입하세요.')],
  'reverse-choice': [
    achievement('reverse-choice-low', 'reverse-choice', '낮을수록 좋다', '합계 7 이하의 주사위로 리버스 초이스 족보를 기입하세요.', 2),
    achievement('reverse-choice-unlucky-man', 'reverse-choice', '아ㅋㅋ', '리버스 초이스 족보에 25점을 기입하세요.')
  ],
  'yacht-bank': [
    achievement('yacht-bank-thrifty', 'yacht-bank', '알뜰한 저금', '요트 뱅크에 최대 점수 15점을 저금하세요.', 3),
    achievement('yacht-bank-fence', 'yacht-bank', '장물아비', '강화 주사위를 요트 뱅크에 5번 저장하세요.', 5)
  ],
  'blackjack-21': [achievement('blackjack-21-champion', 'blackjack-21', '블랙잭 챔피언', '블랙잭 21 족보를 완성하고 게임에서 승리하세요.', 5)],
  'fast-straight': [achievement('fast-straight-speed', 'fast-straight', '빛의 속도', '6라운드 이내에 재빠른 스트레이트 퀘스트를 완료하세요.')],
  'no-time-to-waste': [achievement('no-time-to-waste-careful', 'no-time-to-waste', '신중한 첫 굴림', '퀘스트 대상 세 턴에 리롤 없이 각각 15점 이상 기입하세요.')],
  'step-by-step': [achievement('step-by-step-perfect-plan', 'step-by-step', '완벽한 계획', '차근차근 퀘스트 완료 후 강화된 상단 보너스를 획득하세요.', 3)],
  'two-households': [achievement('two-households-clone', 'two-households', '분신술', '초이스에 20점 이상의 풀하우스 모양을 기입해 두 집 살림 퀘스트를 완료하세요.', 2)],
  'holdout': [achievement('holdout-patience-wins', 'holdout', '존버는 승리한다', '12턴에 알박기 퀘스트를 완료하고 게임에서 승리하세요.')],
  'cautious-straight': [achievement('cautious-straight-consecutive', 'cautious-straight', '아주 계획적이지', '스몰과 라지 스트레이트 족보를 두 턴 연속으로 기입하세요.', 2)],
  'every-little': [achievement('every-little-excavator', 'every-little', '포크레인', '한 번의 족보 기입에 1 눈금을 네 개 이상 사용하세요.', 3)],
  'copycat': [achievement('copycat-perfect', 'copycat', '완벽한 모방', '상대와 같은 족보에 같은 점수를 기록해 카피캣 퀘스트를 완료하세요.', 5)],
  'doubling': [achievement('doubling-echo', 'doubling', '시끄러운 메아리', '20점 이상의 동일한 점수로 더블링 퀘스트를 완료하세요.', 2)],
  'nozdormu': [achievement('nozdormu-no-scratch', 'nozdormu', '밧줄 태울 필요가 없어', '15초 타이머 동안 스크래치 없이 다음 페이즈로 넘어가세요.')],
  'bounty-hunter': [
    achievement('bounty-hunter-fivefold', 'bounty-hunter', '적이 다섯이면 현상금도 다섯배지', '현상금 사냥꾼 퀘스트를 완료하고 게임에서 승리하세요.', 5),
    achievement('bounty-hunter-legendary-killer', 'bounty-hunter', '전설의 킬러', '증강 획득 후 세 라운드 안에 타겟 족보를 20점 이상으로 기입하세요.')
  ],
  'momentum': [
    achievement('momentum-comeback', 'momentum', '대역전극', '추진력 효과로 30점 이상 획득하세요.', 2),
    achievement('momentum-win', 'momentum', '추진력 승리', '추진력 효과를 발동시키고 게임에서 승리하세요.', 5),
    achievement('momentum-kneel', 'momentum', '내가 무릎을 꿇은 건', '추진력 효과로 보너스 점수를 13점 이상 획득하세요.', 13)
  ],
  'golden-die': [achievement('golden-die-authentic', 'golden-die', '진품 주사위', '황금 주사위의 +2점 보너스를 획득하세요.', 5)],
  'promotion-die': [
    achievement('promotion-die-rank-seven', 'promotion-die', '7랭크', '프로모션 주사위를 6까지 올린 후 소모시키세요.', 5),
    achievement('promotion-die-demotion', 'promotion-die', '좌천', '프로모션 주사위를 소모하지 못한 상태로 게임을 완료하세요.')
  ],
  'couple-dice': [achievement('couple-dice-perfect-match', 'couple-dice', '천생연분', '한 게임에서 커플 주사위 효과로 보너스 점수를 4번 이상 획득하세요.', 4)],
  'sevens-dice': [
    achievement('sevens-dice-helpful', 'sevens-dice', '도움이 된다니까', '7 눈금을 사용해 변형 족보를 기입하세요.'),
    achievement('sevens-dice-skill-showcase', 'sevens-dice', '7이 포함된 스트레이트', '7 눈금을 포함해 스트레이트 족보를 기입하세요.', 5)
  ],
  'table-flip': [
    achievement('table-flip-yacht', 'table-flip', '이제 시작이야', '판 뒤집기로 주사위 두 개 이상을 굴린 턴에 요트 족보를 기입하세요.'),
    achievement('table-flip-skilled-player', 'table-flip', '수단과 방법을 가리지 마라', '9라운드 시작 시 열세인 상태에서 이후 판 뒤집기를 사용하고 게임에서 승리하세요.')
  ],
  'equivalent-exchange': [
    achievement('equivalent-exchange-value', 'equivalent-exchange', '그럴만한 가치가 있었어', '등가교환을 사용한 턴에 25점 이상의 족보를 기입하세요.', 3),
    achievement('equivalent-exchange-soul-trade', 'equivalent-exchange', '영혼까지 교환할 셈이냐!', '한 턴에 등가교환을 세 번 사용하고 족보를 기입하세요.')
  ]
};

const add = (session, id, amount = 1, mode = 'add') => {
  if (!session || session.saved || !Number.isFinite(amount)) return;
  const current = session.achievements[id] || 0;
  session.achievements[id] = mode === 'max' ? Math.max(current, amount) : current + amount;
};

const countsOf = (values) => values.reduce((counts, value) => {
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});

const sameValues = (values, expected) => [...values].sort((a, b) => a - b).join(',') === expected.join(',');

export const isNormalAchievementCompletion = (forfeited = {}) => !Object.values(forfeited).some(Boolean);
export const isAchievementEligibleMode = (gameMode, isMultiplayer) => gameMode === 'augmented' && isMultiplayer === true;

export function recordScoreAchievementEvent(session, event) {
  if (!session || session.saved || !event?.augmentIds?.length) return;
  session.achievementState ||= { flags: {}, straightPatterns: {}, lastStraight: null };
  const state = session.achievementState;
  const flags = state.flags;
  const values = (event.diceValues || []).filter(Number.isFinite);
  const counts = countsOf(values);
  const sum = values.reduce((total, value) => total + value, 0);
  const has = (id) => event.augmentIds.includes(id);
  const isCategoryAugment = (id) => event.categoryAugmentId === id;
  const positive = event.score > 0;

  if (isCategoryAugment('lucky-sevens') && positive) {
    if (sum === 7) add(session, 'lucky-sevens-lucky-seven');
    if (sum === 27) add(session, 'lucky-sevens-slot-machine');
  }
  if (isCategoryAugment('perfect-squares') && positive && sum === 9) add(session, 'perfect-squares-minimum');
  if (isCategoryAugment('prime-numbers') && positive) {
    if (values.length >= 5 && values.every((value) => [2, 3, 5].includes(value))) add(session, 'prime-numbers-prime-set');
    if ([2, 3, 5].every((value) => counts[value] > 0)) add(session, 'prime-numbers-235');
    if (event.score === 12) flags.primeMaster = true;
  }
  if (isCategoryAugment('gambler') && positive) {
    if (sum === 24) add(session, 'gambler-minimum');
    if (event.score >= 30) flags.gamblerAllIn = true;
  }
  if (isCategoryAugment('three-of-a-kind') && positive && Object.values(counts).sort().join(',') === '2,3') add(session, 'three-of-a-kind-full-house');
  if (isCategoryAugment('four-by-four') && positive) {
    if ((counts[4] || 0) >= 4) add(session, 'four-by-four-jackpot');
    else if (Object.entries(counts).some(([value, count]) => Number(value) !== 4 && count >= 4)) add(session, 'four-by-four-risky');
  }
  if (isCategoryAugment('tiny-house') && positive && values.every((value) => [1, 2, 3].includes(value))) add(session, 'tiny-house-small');
  if (isCategoryAugment('two-pair') && positive && event.rollsLeft === 2) add(session, 'two-pair-fast');
  if (isCategoryAugment('head-and-tail') && positive) {
    if (event.score >= 30) add(session, 'head-and-tail-jakhon');
    if (sameValues(values, [4, 5, 6, 6, 6])) add(session, 'head-and-tail-perfect');
  }
  if (has('double-large-straight') && positive && ['s-straight', 'l-straight'].includes(event.categoryId)) {
    const pattern = sameValues(values, [1, 2, 3, 4, 5]) ? '12345' : sameValues(values, [2, 3, 4, 5, 6]) ? '23456' : '';
    if (pattern) state.straightPatterns[event.categoryId] = pattern;
    if (new Set(Object.values(state.straightPatterns)).size >= 2) add(session, 'double-large-straight-collector');
  }
  if (isCategoryAugment('duplex-house') && positive) {
    const used = Object.keys(counts).map(Number).sort((a, b) => a - b);
    if (used.length === 2 && used[1] - used[0] === 1) add(session, 'duplex-house-adjacent');
    if (used.join(',') === '5,6') add(session, 'duplex-house-highest');
  }
  if (isCategoryAugment('mountain') && positive) {
    if (event.rollsLeft === 2) add(session, 'mountain-first-roll');
    if (event.score === 40) flags.mountainKing = true;
  }
  if (isCategoryAugment('high-dice') && positive && sum >= 28) add(session, 'high-dice-runners-high');
  if (isCategoryAugment('2nd-choice') && positive && Object.values(counts).some((count) => count >= 5)) add(session, '2nd-choice-yacht-shape');
  if (isCategoryAugment('reverse-choice')) {
    if (positive && sum <= 7) add(session, 'reverse-choice-low');
    if (event.score === 25) add(session, 'reverse-choice-unlucky-man');
  }
  if (isCategoryAugment('blackjack-21') && positive) flags.blackjackChampion = true;
  if (has('cautious-straight') && positive && ['s-straight', 'l-straight'].includes(event.categoryId)) {
    if (state.lastStraight && state.lastStraight.round === event.round - 1 && state.lastStraight.categoryId !== event.categoryId) add(session, 'cautious-straight-consecutive');
    state.lastStraight = { round: event.round, categoryId: event.categoryId };
  }
  if (has('every-little') && values.filter((value) => value === 1).length >= 4) add(session, 'every-little-excavator');
  if (has('golden-die') && event.goldenBonus) add(session, 'golden-die-authentic');
  if (has('sevens-dice') && values.includes(7)) {
    if (event.categoryAugmentId && !event.categoryAugmentId.endsWith('-dice')) add(session, 'sevens-dice-helpful');
    if (['s-straight', 'l-straight'].includes(event.categoryId)) add(session, 'sevens-dice-skill-showcase');
  }
  if (has('table-flip') && event.tableFlipDiceCount >= 2 && event.categoryId === 'yacht' && positive) add(session, 'table-flip-yacht');
  if (has('equivalent-exchange') && event.equivalentExchangeUses > 0 && event.score >= 25) add(session, 'equivalent-exchange-value');
  if (has('equivalent-exchange') && event.equivalentExchangeUses >= 3 && positive) add(session, 'equivalent-exchange-soul-trade');
  if (has('nozdormu') && event.score <= 0) flags.nozdormuScratched = true;
}

export function recordGameEndAchievementEvent(session, event) {
  if (!session || session.saved || !event?.normalCompletion) return;
  const state = session.achievementState || {};
  const flags = state.flags || {};
  if (event.won) {
    if (flags.primeMaster) add(session, 'prime-numbers-master');
    if (flags.gamblerAllIn) add(session, 'gambler-all-in');
    if (flags.mountainKing) add(session, 'mountain-king');
    if (flags.blackjackChampion) add(session, 'blackjack-21-champion');
    if (flags.holdoutTurn12) add(session, 'holdout-patience-wins');
    if (flags.bountyCompleted) add(session, 'bounty-hunter-fivefold');
    if (flags.momentumTriggered) add(session, 'momentum-win');
    if (flags.tableFlipLateBehind) add(session, 'table-flip-skilled-player');
  }
  if (event.promotionOwned && !event.promotionConsumed) add(session, 'promotion-die-demotion');
}
