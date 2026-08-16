import { UPPER_CATEGORIES } from './game/core/gameConstants.js';

export const augmentDefinitions = {
  // -------------------------
  // Upper Section
  // -------------------------
  'lucky-sevens': {
    id: 'lucky-sevens', name: '럭키 세븐', target: 'aces', enName: 'L. Sevens', excludeFromUpper: false,
    calculate: (dice, counts, sum) => [7, 17, 27].includes(sum) ? 15 : 0
  },
  'perfect-squares': {
    id: 'perfect-squares', name: '퍼펙트 스퀘어', target: 'aces', enName: 'P. Squares', excludeFromUpper: false,
    calculate: (dice, counts, sum) => [9, 16, 25].includes(sum) ? 12 : 0
  },
  'anti-ace-deuces': {
    id: 'anti-ace-deuces', name: '안티-에이스 듀스', target: 'deuces', enName: '-1. Deuces', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (counts[2] >= 3 && counts[1] === 0) ? 8 : 0
  },
  'anti-four-threes': {
    id: 'anti-four-threes', name: '안티-포 쓰리스', target: 'threes', enName: '-4. Threes', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (counts[3] >= 3 && counts[4] === 0) ? 12 : 0
  },
  'prime-numbers': {
    id: 'prime-numbers', name: '프라임 넘버즈', target: 'threes', enName: 'P. Numbers', excludeFromUpper: false,
    calculate: (dice, counts, sum) => dice.every(d => d === 2 || d === 3 || d === 5 || d === 7) ? 12 : 0
  },
  'anti-six-fours': {
    id: 'anti-six-fours', name: '안티-식스 포스', target: 'fours', enName: '-6. Fours', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (counts[4] >= 3 && counts[6] === 0) ? 16 : 0
  },
  'anti-six-fives': {
    id: 'anti-six-fives', name: '안티-식스 파이브스', target: 'fives', enName: '-6. Fives', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (counts[5] >= 3 && counts[6] === 0) ? 20 : 0
  },
  'anti-five-sixes': {
    id: 'anti-five-sixes', name: '안티-파이브 식스스', target: 'sixes', enName: '-5. Sixes', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (counts[6] >= 3 && counts[5] === 0) ? 24 : 0
  },

  // -------------------------
  // Lower Section
  // -------------------------
  'gambler': {
    id: 'gambler', name: '갬블러', target: 'choice', enName: 'Gambler', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (sum >= 24) ? sum + 7 : 0
  },
  'three-of-a-kind': {
    id: 'three-of-a-kind', name: '쓰리 오브 어 카인드', target: '4oak', enName: '3 of a Kind', excludeFromUpper: false,
    calculate: (dice, counts, sum) => Object.values(counts).some(c => c >= 3) ? sum : 0
  },
  'four-by-four': {
    id: 'four-by-four', name: '포 바이 포', target: '4oak', enName: 'Four x Four', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      if (counts[4] >= 4) return sum + 10;
      if (Object.values(counts).some(c => c >= 4)) return sum - 4;
      return 0;
    }
  },
  'tiny-house': {
    id: 'tiny-house', name: '타이니 하우스', target: 'fullhouse', enName: 'Tiny House', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      if (counts[5] > 0 || counts[6] > 0 || counts[7] > 0) return 0; 
      const vals = Object.values(counts);
      if ((vals.includes(3) && vals.includes(2)) || vals.includes(5)) return 28;
      return 0;
    }
  },
  'two-pair': {
    id: 'two-pair', name: '투 페어', target: 'fullhouse', enName: 'Two Pair', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      let pairCount = 0;
      for (let i = 1; i <= 7; i++) {
        if (counts[i] >= 2) pairCount++;
      }
      return (pairCount >= 2 || Object.values(counts).some(c => c >= 4)) ? 15 : 0;
    }
  },
  'head-and-tail': {
    id: 'head-and-tail', name: '머리와 몸통', target: 'fullhouse', enName: 'Head & Run', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      let valid = false;
      for (let pairVal = 1; pairVal <= 7; pairVal++) {
        if (counts[pairVal] >= 2) {
          counts[pairVal] -= 2; // 일시적 제거
          const str = Object.values(counts).map(c => c > 0 ? '1' : '0').join('');
          if (str.includes('111')) valid = true; // 3연속 숫자
          counts[pairVal] += 2; // 복구
          if (valid) break;
        }
      }
      return valid ? sum + 10 : 0;
    }
  },
  'evens': {
    id: 'evens', name: '에번스', target: 's-straight', enName: 'Evens', excludeFromUpper: false,
    calculate: (dice, counts, sum) => dice.every(d => d % 2 === 0) ? 20 : 0
  },
  'odds': {
    id: 'odds', name: '오즈', target: 's-straight', enName: 'Odds', excludeFromUpper: false,
    calculate: (dice, counts, sum) => dice.every(d => d % 2 !== 0) ? 20 : 0
  },
  'double-large-straight': {
    id: 'double-large-straight', name: '더블 라지 스트레이트', target: 's-straight', enName: 'L. Straight', excludeFromUpper: false, 
    calculate: (dice, counts, sum) => {
      const uStr = [...new Set(dice)].sort().join('');
      return /12345|23456|34567/.test(uStr) ? 30 : 0;
    }
  },
  'prime-collection': {
    id: 'prime-collection', name: '프라임 컬렉션', target: 'l-straight', enName: 'P. Collection', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      if (!dice.every(d => d === 2 || d === 3 || d === 5 || d === 7)) return 0;
      if (counts[2] > 0 && counts[3] > 0 && counts[5] > 0) return 35;
      return 0;
    }
  },
  'duplex-house': {
    id: 'duplex-house', name: '땅콩주택', target: 'l-straight', enName: 'D. House', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      const vals = Object.values(counts);
      if (!((vals.includes(3) && vals.includes(2)) || vals.includes(5))) return 0;
      const nums = [];
      for(let i = 1; i <= 7; i++) if (counts[i] > 0) nums.push(i);
      if (nums.length === 2 && Math.abs(nums[0] - nums[1]) === 1) return 35;
      return 0;
    }
  },
  'mountain': {
    id: 'mountain', name: '마운틴', target: 'l-straight', enName: 'Mountain', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      const uStr = [...new Set(dice)].sort().join('');
      return uStr === '23456' ? 40 : 0;
    }
  },
  'high-dice': {
    id: 'high-dice', name: '하이 다이스', target: 'l-straight', enName: 'High Dice', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      if (dice.every(d => [4,5,6,7].includes(d)) && sum >= 26) return 35;
      return 0;
    }
  },
  '2nd-choice': {
    id: '2nd-choice', name: '두 번째 초이스', target: 'yacht', enName: '2nd Choice', excludeFromUpper: false,
    calculate: (dice, counts, sum) => Math.floor(sum / 2)
  },
  'fibonacci-numbers': {
    id: 'fibonacci-numbers', name: '피보나치 넘버즈', target: 'yacht', enName: 'Fib. Numbers', excludeFromUpper: false,
    calculate: (dice, counts, sum) => {
      const sorted = [...dice].sort();
      return sorted.join('') === '11235' ? 25 : 0;
    }
  },
  'reverse-choice': {
    id: 'reverse-choice', name: '리버스 초이스', target: 'yacht', enName: 'R. Choice', excludeFromUpper: false,
    calculate: (dice, counts, sum) => 30 - sum
  },
  'yacht-bank': {
    id: 'yacht-bank', name: '요트 뱅크', target: 'yacht', enName: 'Bank', excludeFromUpper: false, isQuest: true,
    calculate: (dice, counts, sum, context) => {
      const bank = Math.max(0, Number(context?.bank) || 0);
      return Math.min(bank, 15);
    }
  },
  'blackjack-21': {
    id: 'blackjack-21', name: '블랙잭 21', target: 'yacht', enName: 'Blackjack', excludeFromUpper: false,
    calculate: (dice, counts, sum) => (sum === 21) ? 21 : 0
  },
  // -------------------------
  // Quest Section
  // -------------------------
  'fast-straight': { id: 'fast-straight', name: '재빠른 스트레이트', target: 'q1', enName: 'Fast Straight', isQuest: true },
  'no-time-to-waste': { id: 'no-time-to-waste', name: '낭비할 시간 없다', target: 'q2', enName: 'No time to waste', isQuest: true },
  'step-by-step': { id: 'step-by-step', name: '차근차근', target: 'q3', enName: 'Step by Step', isQuest: true },
  'two-households': { id: 'two-households', name: '두 집 살림', target: 'q4', enName: 'Two Households', isQuest: true },
  'holdout': { id: 'holdout', name: '알박기', target: 'q5', enName: 'Holdout', isQuest: true },
  'cautious-straight': { id: 'cautious-straight', name: '신중한 스트레이트', target: 'q6', enName: 'Cautious Straight', isQuest: true },
  'every-little': { id: 'every-little', name: '티끌 모아 태산', target: 'q7', enName: 'Every Little', isQuest: true },
  'copycat': { id: 'copycat', name: '카피캣', target: 'q8', enName: 'Copycat', isQuest: true },
  'doubling': { id: 'doubling', name: '더블링', target: 'q9', enName: 'Doubling', isQuest: true },
  'nozdormu': { id: 'nozdormu', name: '노즈도르무', target: 'q10', enName: 'Nozdormu', isQuest: true },
  'bounty-hunter': { id: 'bounty-hunter', name: '현상금 사냥꾼', target: 'q11', enName: 'Bounty Hunter', isQuest: true },
  
  // -------------------------
  // Enhancement Section
  // -------------------------
  'weighted-dice': { id: 'weighted-dice', name: '묵직한 주사위', target: 'eh1', enName: 'Weighted', isEnhancement: true },
  'momentum': { id: 'momentum', name: '추진력', target: 'eh3', enName: 'Momentum', isEnhancement: true },
  'golden-die': { id: 'golden-die', name: '황금 주사위', target: 'eh4', enName: 'Golden', isEnhancement: true },
  '8-sided': { id: '8-sided', name: '8면 주사위', target: 'eh6', enName: '8-Sided', isEnhancement: true },
  'strange-die': { id: 'strange-die', name: '이상한 주사위', target: 'eh7', enName: 'Strange', isEnhancement: true },
  'promotion-die': { id: 'promotion-die', name: '프로모션 주사위', target: 'eh8', enName: 'Promotion', isEnhancement: true },
  'couple-dice': { id: 'couple-dice', name: '커플 주사위', target: 'eh9', enName: 'Couple', isEnhancement: true },
  'sevens-dice': { id: 'sevens-dice', name: '세븐스 다이스', target: 'eh10', enName: 'Sevens', isEnhancement: true },
  'table-flip': { id: 'table-flip', name: '판 뒤집기', target: 'eh11', enName: 'Table Flip', isEnhancement: true },
  'equivalent-exchange': { id: 'equivalent-exchange', name: '등가교환', target: 'eh12', enName: 'Equivalent Exchange', isEnhancement: true },
  'duel': { id: 'duel', name: '결투', target: 'eh13', enName: 'Duel', isEnhancement: true },
  'coin-toss': { id: 'coin-toss', name: '코인 토스', target: 'eh14', enName: 'Coin Toss', isEnhancement: true },
  'random-box': { id: 'random-box', name: '랜덤 박스', target: 'eh15', enName: 'Random Box', isEnhancement: true },
  'prophet': { id: 'prophet', name: '예지자', target: 'q12', enName: 'Prophet', isQuest: true },
  'gambit': { id: 'gambit', name: '갬빗', target: 'eh16', enName: 'Gambit', isEnhancement: true },
  'double-down': { id: 'double-down', name: '더블 다운', target: 'eh17', enName: 'Double Down', isEnhancement: true },
  'piggy-bank': { id: 'piggy-bank', name: '저금통', target: 'eh18', enName: 'Piggy Bank', isEnhancement: true },
  'dice-alchemy': { id: 'dice-alchemy', name: '주사위 연금술', target: 'eh19', enName: 'Dice Alchemy', isEnhancement: true }
};

// 기존 모듈 import 호환용 별칭. 신규 코드는 augmentDefinitions를 사용함.

export function calculateUpperScoreTotal(scores = {}, activeAugments = {}) {
  return UPPER_CATEGORIES.reduce((total, category) => {
    const augment = augmentDefinitions[activeAugments?.[category]];
    if (augment?.excludeFromUpper) return total;

    const entry = scores?.[category];
    const baseScore = typeof entry === 'object' ? entry?.score : entry;
    const bonusScore = typeof entry === 'object' ? entry?.bonus : 0;
    return total + (Number(baseScore) || 0) + (Number(bonusScore) || 0);
  }, 0);
}

export function calculateScores(dice, activeAugments = {}, context = {}) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let sum = 0;
  
  dice.forEach(d => {
    counts[d]++;
    sum += d;
  });

  const countValues = Object.values(counts);
  const hasMultiple = (n) => countValues.some(c => c >= n);
  const sortedCounts = [...countValues].sort((a, b) => b - a);
  const isFullHouse = (sortedCounts[0] >= 3 && sortedCounts[1] >= 2) || (sortedCounts[0] >= 5);
  
  const uniqueSorted = [...new Set(dice)].sort();
  const uniqueStr = uniqueSorted.join('');
  const isSmallStraight = /1234|2345|3456|4567/.test(uniqueStr);
  const isLargeStraight = /12345|23456|34567/.test(uniqueStr);

  let scores = {
    aces: counts[1] * 1,
    deuces: counts[2] * 2,
    threes: counts[3] * 3,
    fours: counts[4] * 4,
    fives: counts[5] * 5,
    sixes: counts[6] * 6,
    choice: sum,
    '4oak': hasMultiple(4) ? sum : 0,
    fullhouse: isFullHouse ? sum : 0,
    's-straight': isSmallStraight ? 15 : 0,
    'l-straight': isLargeStraight ? 30 : 0,
    yacht: hasMultiple(5) ? 50 : 0
  };

  // 활성화된 증강 덮어씌우기
  for (const [targetCat, augmentId] of Object.entries(activeAugments)) {
    const augment = augmentDefinitions[augmentId];
    if (augment && !augment.isEnhancement && !augment.isQuest) {
      scores[targetCat] = augment.calculate(dice, counts, sum, context);
    }
  }

  // 전체 보너스 계산
  let globalBonus = 0;
  let bonusDetails = [];
  
  if (context.fullDice) {
    // 황금 주사위: 이 주사위 눈금이 1, 2, 3 중 하나라면 +2점
    const goldenDice = context.fullDice.filter(d => d.type === 'golden');
    let goldSum = 0;
    goldenDice.forEach(gd => {
       if ([1, 2, 3].includes(gd.value)) goldSum += 2;
    });
    if (goldSum !== 0) {
       globalBonus += goldSum;
       bonusDetails.push({ value: goldSum, color: '#D4AF37' });
    }
    
    // 이상한 주사위: (+2, +1, +1, 0, -1, 파괴)
    const weirdDice = context.fullDice.filter(d => d.type === 'weird');
    let weirdSum = 0;
    weirdDice.forEach(wd => {
       if (wd.value === 1) weirdSum += 2;
       else if (wd.value === 2 || wd.value === 3) weirdSum += 1;
       else if (wd.value === 5) weirdSum -= 1;
    });
    if (weirdSum !== 0) {
       globalBonus += weirdSum;
       bonusDetails.push({ value: weirdSum, color: '#754581' });
    }
    
    // 커플 주사위: 두 주사위의 눈금이 같다면 +3점
    const coupleDice = context.fullDice.filter(d => d.type === 'couple');
    if (coupleDice.length === 2 && coupleDice[0].value === coupleDice[1].value) {
       globalBonus += 3;
       bonusDetails.push({ value: 3, color: '#ff2c97' });
    }
  }
  
  // 모든 항목에 대해 { score, bonus, bonusDetails } 객체로 변환
  let finalScores = {};
  for (const key of Object.keys(scores)) {
     finalScores[key] = {
       score: scores[key],
       bonus: globalBonus,
       bonusDetails: bonusDetails
     };
  }

  return finalScores;
}
