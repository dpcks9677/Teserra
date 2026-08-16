const renderStandardIcon = (inner) => `<svg viewBox="0 0 48 48" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
    <g transform="scale(2)">
      ${inner}
    </g>
  </svg>`;

export function getDiceSvg(num) {
  const dots = [];
  const r = 1.8; // 눈금 반지름
  const c = 12, l = 7, r_pos = 17, t = 7, b = 17, m = 12;

  if (num === 1) {
    dots.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="#222"/>`);
  } else if (num === 2) {
    dots.push(`<circle cx="${r_pos}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${b}" r="${r}" fill="#222"/>`);
  } else if (num === 3) {
    dots.push(`<circle cx="${r_pos}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${b}" r="${r}" fill="#222"/>`);
  } else if (num === 4) {
    dots.push(`<circle cx="${l}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${b}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${b}" r="${r}" fill="#222"/>`);
  } else if (num === 5) {
    dots.push(`<circle cx="${l}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${b}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${b}" r="${r}" fill="#222"/>`);
  } else if (num === 6) {
    dots.push(`<circle cx="${l}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${t}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${m}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${m}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${l}" cy="${b}" r="${r}" fill="#222"/>`);
    dots.push(`<circle cx="${r_pos}" cy="${b}" r="${r}" fill="#222"/>`);
  }

  return renderStandardIcon(`
    <rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="#222" stroke-width="2"/>
    ${dots.join('')}
  `);
}

export function getSpecialSvg(id) {
  let inner = '';
  const rect = (x, y, w, h, fill="#222", stroke="none", sw="0") => 
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

  if (id === 'choice') {
    inner += rect(10, 4, 4, 4); // 상
    inner += rect(10, 16, 4, 4); // 하
    inner += rect(4, 10, 4, 4); // 좌
    inner += rect(16, 10, 4, 4); // 우
    inner += rect(10, 10, 4, 4); // 중앙
  } else if (id === '4oak') {
    const pos = (idx) => {
      const col = (idx - 1) % 4;
      const row = Math.floor((idx - 1) / 4);
      return [2.5 + col * 5, 2.5 + row * 5];
    };
    const [x4, y4] = pos(4);
    inner += rect(x4, y4, 4, 4, "none", "#222", "1.5");
    [1, 6, 11, 16].forEach(idx => {
      const [x, y] = pos(idx);
      inner += rect(x, y, 4, 4);
    });
  } else if (id === 'fullhouse') {
    inner += rect(3, 5, 4, 4);
    inner += rect(10, 5, 4, 4);
    inner += rect(17, 5, 4, 4);
    inner += rect(6.5, 14, 4, 4);
    inner += rect(13.5, 14, 4, 4);
  } else if (id === 's-straight') {
    inner += rect(4, 16, 4, 4);
    inner += rect(8, 12, 4, 4);
    inner += rect(12, 8, 4, 4);
    inner += rect(16, 4, 4, 4);
  } else if (id === 'l-straight') {
    inner += rect(2, 18, 4, 4);
    inner += rect(6, 14, 4, 4);
    inner += rect(10, 10, 4, 4);
    inner += rect(14, 6, 4, 4);
    inner += rect(18, 2, 4, 4);
  } else if (id === 'yacht') {
    inner += rect(10, 2, 4, 4); // 상
    inner += rect(18, 9, 4, 4); // 우상
    inner += rect(14, 17, 4, 4); // 우하
    inner += rect(6, 17, 4, 4); // 좌하
    inner += rect(2, 9, 4, 4); // 좌상
  }

  return renderStandardIcon(inner);
}

export function getVariantSvg(id) {
  const map = {
    'lucky-sevens': 'lucky-seven',
    'perfect-squares': 'perfect-sq',
    'anti-ace-deuces': 'anti-2',
    'anti-four-threes': 'anti-3',
    'prime-numbers': 'prime',
    'anti-six-fours': 'anti-4',
    'anti-six-fives': 'anti-5',
    'anti-five-sixes': 'anti-6',
    'gambler': 'gambler',
    'three-of-a-kind': '3oak',
    'four-by-four': '4x4',
    'tiny-house': 'tinyhouse',
    'two-pair': 'two-pair',
    'head-and-tail': 'head-tail',
    'evens': 'evens',
    'odds': 'odds',
    'double-large-straight': 'dbl-l-straight',
    'prime-collection': 'prime-col',
    'duplex-house': 'duplex',
    'mountain': 'mountain',
    'high-dice': 'high-dice',
    '2nd-choice': '2nd-choice',
    'fibonacci-numbers': 'fibonacci',
    'reverse-choice': 'rev-choice',
    'yacht-bank': 'yacht-bank',
    'blackjack-21': 'blackjack',
    'fast-straight': 'fast-straight',
    'no-time-to-waste': 'no-waste',
    'step-by-step': 'step-by-step',
    'two-households': 'two-households',
    'holdout': 'holdout',
    'cautious-straight': 'cautious-straight',
    'mickle': 'mickle',
    'weighted-dice': 'weighted-dice',
    'momentum': 'momentum',
    'golden-die': 'golden-die',
    '8-sided': '8-sided',
    'strange-die': 'strange-die',
    'promotion-die': 'promotion-die',
    'couple-dice': 'couple-dice',
    'sevens-dice': 'sevens-dice',
    'copycat': 'copycat',
    'doubling': 'doubling',
    'nozdormu': 'nozdormu',
    'bounty-hunter': 'bounty-hunter'
  };
  const mappedId = map[id] || id;

  let inner = '';
  if (mappedId === '3oak') {
    inner = `
      <rect x="10" y="3" width="4" height="4" rx="0.5" fill="#222"/>
      <rect x="5" y="14" width="4" height="4" rx="0.5" fill="#222"/>
      <rect x="15" y="14" width="4" height="4" rx="0.5" fill="#222"/>
    `;
  } else if (mappedId === '2nd-choice') {
    inner = `<rect x="10" y="4" width="4" height="4" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/><rect x="10" y="16" width="4" height="4" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/><rect x="4" y="10" width="4" height="4" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/><rect x="16" y="10" width="4" height="4" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/>`;
  } else if (mappedId === 'two-pair') {
    inner = `
      <rect x="4" y="5" width="5" height="5" rx="0.5" fill="#222"/>
      <rect x="4" y="14" width="5" height="5" rx="0.5" fill="#222"/>
      <rect x="15" y="5" width="5" height="5" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/>
      <rect x="15" y="14" width="5" height="5" rx="0.5" fill="none" stroke="#222" stroke-width="1.5"/>
    `;
  } else if (mappedId === 'evens') {
    inner = `
      <circle cx="8" cy="5" r="2" fill="#222"/> <circle cx="16" cy="5" r="2" fill="#222"/>
      <circle cx="8" cy="12" r="2" fill="#222"/> <circle cx="16" cy="12" r="2" fill="#222"/>
      <circle cx="8" cy="19" r="2" fill="#222"/> <circle cx="16" cy="19" r="2" fill="#222"/>
    `;
  } else if (mappedId === 'odds') {
    inner = `
      <circle cx="12" cy="12" r="2.5" fill="#222"/>
      <circle cx="5" cy="5" r="2.5" fill="none" stroke="#222" stroke-width="1.5"/>
      <circle cx="19" cy="19" r="2.5" fill="none" stroke="#222" stroke-width="1.5"/>
    `;
  } else if (mappedId === 'mountain') {
    inner = `<path d="M 12 3.8 L 2.5 20.2 L 21.5 20.2 Z" fill="none" stroke="#222" stroke-width="2.2" stroke-linejoin="round"/><path d="M 7.5 12 L 12 16 L 16.5 12" fill="none" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mappedId === 'head-tail') {
    inner = `
      <rect x="7" y="3" width="4" height="6" rx="0.5" fill="#222" />
      <rect x="13" y="3" width="4" height="6" rx="0.5" fill="#222" />
      <rect x="4" y="13" width="4" height="6" rx="0.5" fill="none" stroke="#222" stroke-width="1.5" />
      <rect x="10" y="13" width="4" height="6" rx="0.5" fill="none" stroke="#222" stroke-width="1.5" />
      <rect x="16" y="13" width="4" height="6" rx="0.5" fill="none" stroke="#222" stroke-width="1.5" />
    `;
  } else if (mappedId === 'lucky-seven' || mappedId === 'lucky-sevens') {
    const singleHeart = `<path d="M 12 12 C 9.5 9 7.5 6.2 9.5 4.2 C 11.2 2.5 12 5.2 12 5.2 C 12 5.2 12.8 2.5 14.5 4.2 C 16.5 6.2 14.5 9 12 12 Z" fill="none" stroke="#222" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    inner = `
      ${singleHeart}
      <g transform="rotate(90 12 12)">${singleHeart}</g>
      <g transform="rotate(180 12 12)">${singleHeart}</g>
      <g transform="rotate(270 12 12)">${singleHeart}</g>
    `;
  } else if (mappedId === 'fibonacci') {
    inner = `
      <rect x="2.5" y="5.5" width="13" height="13" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="15.5" y="5.5" width="8" height="8" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="18.5" y="13.5" width="5" height="5" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="15.5" y="15.5" width="3" height="3" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="15.5" y="13.5" width="2" height="2" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="17.5" y="13.5" width="1" height="1" fill="none" stroke="#222" stroke-width="0.5"/>
      <rect x="17.5" y="14.5" width="1" height="1" fill="none" stroke="#222" stroke-width="0.5"/>
      <path d="M 18.5 14.5 A 1 1 0 0 0 17.5 13.5 A 2 2 0 0 0 15.5 15.5 A 3 3 0 0 0 18.5 18.5 A 5 5 0 0 0 23.5 13.5 A 8 8 0 0 0 15.5 5.5 A 13 13 0 0 0 2.5 18.5" fill="none" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
    `;
  } else if (mappedId === 'prime') {
    inner = `
      <path d="M12 2 L20 12 L12 22 L4 12 Z" fill="none" stroke="#222" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2.5" fill="#222"/>
    `;
  } else if (mappedId.startsWith('anti-')) {
    const num = parseInt(mappedId.split('-')[1]);
    const r = 2;
    const c = 12, l = 7, r_pos = 17, t = 7, b = 17, m = 12;
    const circlePath = (cx, cy) => ` M ${cx} ${cy-r} A ${r} ${r} 0 1 0 ${cx} ${cy+r} A ${r} ${r} 0 1 0 ${cx} ${cy-r} Z`;
    let pathD = `M6 2 h12 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 Z`;
    
    if (num === 2) pathD += circlePath(r_pos, t) + circlePath(l, b);
    else if (num === 3) pathD += circlePath(r_pos, t) + circlePath(c, c) + circlePath(l, b);
    else if (num === 4) pathD += circlePath(l, t) + circlePath(r_pos, t) + circlePath(l, b) + circlePath(r_pos, b);
    else if (num === 5) pathD += circlePath(l, t) + circlePath(r_pos, t) + circlePath(c, c) + circlePath(l, b) + circlePath(r_pos, b);
    else if (num === 6) pathD += circlePath(l, t) + circlePath(r_pos, t) + circlePath(l, m) + circlePath(r_pos, m) + circlePath(l, b) + circlePath(r_pos, b);
    
    inner = `<path fill-rule="evenodd" d="${pathD}" fill="#222"/>`;
  } else if (mappedId === 'perfect-sq') {
    inner = `
      <rect x="5" y="5" width="6" height="6" fill="#222"/>
      <rect x="13" y="13" width="6" height="6" fill="#222"/>
      <rect x="5" y="13" width="6" height="6" fill="none" stroke="#222" stroke-width="1.5"/>
      <rect x="13" y="5" width="6" height="6" fill="none" stroke="#222" stroke-width="1.5"/>
    `;
  } else if (mappedId === 'gambler') {
    inner = `<path d="M 10 3.5 C 7.5 4 6 5.5 6 9 C 8 8 10 7.5 12 8 C 10.5 10.5 5 11 2.5 12.5 C 6 11 14 10.5 21.5 12.5 C 19 10.5 16.5 9.5 16.5 7 C 17.5 5.5 15.5 3 12.5 3 C 11.5 3 10.5 3.2 10 3.5 Z M 7.5 13.5 C 7 15 7.5 16.5 9.5 15.5 C 12 14.5 15.5 15 18.5 16.5 C 18 14.5 16 13.5 14.5 14 Z M 5.5 17 L 7.5 21 C 12 18.5 16.5 19 21.5 20.5 C 20.5 17 17.5 15 14.5 14 Z" fill="#222"/>`;
  } else if (mappedId === '4x4') {
    inner = `<rect x="4" y="4" width="7" height="7" fill="#222"/><rect x="13" y="4" width="7" height="7" fill="#222"/><rect x="4" y="13" width="7" height="7" fill="#222"/><rect x="13" y="13" width="7" height="7" fill="#222"/>`;
  } else if (mappedId === 'tinyhouse') {
    inner = `<path d="M 3 11 L 12 3 L 21 11 M 5.5 9.5 V 20.5 H 18.5 V 9.5" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 9.5 20.5 V 15 A 1.5 1.5 0 0 1 11 13.5 H 13 A 1.5 1.5 0 0 1 14.5 15 V 20.5" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mappedId === 'dbl-l-straight') {
    inner = `
      <path d="M3 21 v-4 h4 v-4 h4 v-4 h4 v-4 h4" stroke="#222" stroke-width="2" fill="none" stroke-linejoin="round"/>
      <path d="M8 21 v-4 h4 v-4 h4 v-4 h4" stroke="#222" stroke-width="2" fill="none" stroke-linejoin="round"/>
    `;
  } else if (mappedId === 'prime-col') {
    const dia = (x,y) => `<path d="M${x} ${y-3} L${x+3} ${y} L${x} ${y+3} L${x-3} ${y} Z" fill="#222"/>`;
    inner = dia(12,5) + dia(7,14) + dia(17,14);
  } else if (mappedId === 'duplex') {
    inner = `
      <path d="M6 7 L2 11 v7 h8 v-7 Z" fill="none" stroke="#222" stroke-width="2" stroke-linejoin="round"/>
      <path d="M18 7 L14 11 v7 h8 v-7 Z" fill="none" stroke="#222" stroke-width="2" stroke-linejoin="round"/>
    `;
  } else if (mappedId === 'high-dice') {
    inner = `<rect x="4" y="14" width="4" height="6" fill="#222"/><rect x="10" y="10" width="4" height="10" fill="#222"/><rect x="16" y="4" width="4" height="16" fill="#222"/>`;
  } else if (mappedId === 'rev-choice') {
    inner = `<path fill-rule="evenodd" d="M6 2 h12 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 Z M10 4 h4 v4 h-4 Z M10 16 h4 v4 h-4 Z M4 10 h4 v4 h-4 Z M16 10 h4 v4 h-4 Z M10 10 h4 v4 h-4 Z" fill="#222"/>`;
  } else if (mappedId === 'yacht-bank') {
    inner = `
      <path d="M12 3 L3 9 h18 Z" fill="#222" stroke-linejoin="round"/>
      <rect x="4" y="10" width="2" height="8" fill="#222"/>
      <rect x="11" y="10" width="2" height="8" fill="#222"/>
      <rect x="18" y="10" width="2" height="8" fill="#222"/>
      <rect x="2" y="19" width="20" height="2" fill="#222"/>
    `;
  } else if (mappedId === 'blackjack') {
    inner = `
      <circle cx="12" cy="12" r="10" fill="none" stroke="#222" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="8" fill="none" stroke="#222" stroke-width="4" stroke-dasharray="3.1416 3.1416"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="#222" stroke-width="1.5"/>
    `;
  } else if (mappedId === 'fast-straight') {
    inner = `<path d="M 13.5 2 L 6.5 12.5 H 12 L 9.5 22 L 17.5 10.5 H 12 Z" fill="#222" stroke-linejoin="round"/>`;
  } else if (mappedId === 'no-waste') {
    inner = `<circle cx="12" cy="13" r="8" fill="none" stroke="#222" stroke-width="2"/><path d="M12 5 v-3 M9 2 h6 M12 13 l3 -3" stroke="#222" stroke-width="2" stroke-linecap="round"/>`;
  } else if (mappedId === 'step-by-step') {
    inner = `<path d="M4 20 v-5 h5 v-5 h5 v-5 h5" stroke="#222" stroke-width="2.5" fill="none" stroke-linejoin="round"/>`;
  } else if (mappedId === 'two-households') {
    inner = `
      <rect x="3.5" y="3.5" width="7" height="17" rx="1" fill="none" stroke="#222" stroke-width="1.8"/>
      <rect x="13.5" y="3.5" width="7" height="17" rx="1" fill="none" stroke="#222" stroke-width="1.8"/>
      <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="6" y1="7" x2="8" y2="7" stroke="#222" stroke-width="1.5"/>
      <line x1="6" y1="11" x2="8" y2="11" stroke="#222" stroke-width="1.5"/>
      <line x1="6" y1="15" x2="8" y2="15" stroke="#222" stroke-width="1.5"/>
      <line x1="16" y1="7" x2="18" y2="7" stroke="#222" stroke-width="1.5"/>
      <line x1="16" y1="11" x2="18" y2="11" stroke="#222" stroke-width="1.5"/>
      <line x1="16" y1="15" x2="18" y2="15" stroke="#222" stroke-width="1.5"/>
    `;
  } else if (mappedId === 'holdout') {
    inner = `<path d="M8 22 v-18 l10 5 l-10 5" stroke="#222" stroke-width="2" fill="none" stroke-linejoin="round"/><rect x="4" y="20" width="8" height="2" fill="#222"/>`;
  } else if (mappedId === 'cautious-straight') {
    inner = `<circle cx="10" cy="10" r="5" fill="none" stroke="#222" stroke-width="2"/><path d="M13.5 13.5 l5.5 5.5" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>`;
  } else if (mappedId === 'mickle' || mappedId === 'every-little') {
    inner = `<path d="M 2 20 L 8.5 7 L 12.5 13.5 L 16.5 9 L 22.5 20 Z" fill="none" stroke="#222" stroke-width="1.8" stroke-linejoin="round"/><path d="M 8.5 7 Q 10.5 10.5 8 13.5 M 16.5 9 Q 14.5 12 17 15" fill="none" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (mappedId === 'weighted-dice') {
    inner = `<path d="M 12 3 L 19.8 7.5 L 19.8 16.5 L 12 21 L 4.2 16.5 L 4.2 7.5 Z" fill="none" stroke="#222" stroke-width="1.8" stroke-linejoin="round"/><path d="M 12 12 L 19.8 7.5 M 12 12 L 12 21 M 12 12 L 4.2 7.5" fill="none" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mappedId === 'momentum') {
    inner = `<circle cx="15" cy="5" r="2.2" fill="#222"/><path d="M 13 8 L 11 13.5 M 13 8 L 9.5 7.5 L 7.5 10.5 M 13 8 L 15 11 L 18.5 9.5 M 11 13.5 L 8 16.5 L 4.5 14.5 M 11 13.5 L 14.5 16 L 14.5 21.5" fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mappedId === 'golden-die') {
    inner = `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#222" stroke-width="2"/><path d="M 12 5.5 L 13.8 9.2 L 17.8 9.8 L 14.9 12.6 L 15.6 16.5 L 12 14.6 L 8.4 16.5 L 9.1 12.6 L 6.2 9.8 L 10.2 9.2 Z" fill="#222" stroke="#222" stroke-width="0.8" stroke-linejoin="round"/>`;
  } else if (mappedId === '8-sided') {
    inner = `<path d="M12 2 L20 12 L12 22 L4 12 Z M4 12 H20 M12 2 L16 12 L12 22 M12 2 L8 12 L12 22" fill="none" stroke="#222" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (mappedId === 'strange-die') {
    inner = `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#222" stroke-width="2"/><path d="M 9.5 8.5 C 9.5 6.5 14.5 6.5 14.5 9 C 14.5 11 12 11.5 12 14" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="#222"/>`;
  } else if (mappedId === 'promotion-die') {
    inner = `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#222" stroke-width="2"/><path d="M 6.5 16 H 17.5 L 18.5 9 L 14.5 12 L 12 7 L 9.5 12 L 5.5 9 Z" fill="none" stroke="#222" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="5.5" cy="8.5" r="0.8" fill="#222"/><circle cx="12" cy="6.5" r="0.8" fill="#222"/><circle cx="18.5" cy="8.5" r="0.8" fill="#222"/>`;
  } else if (mappedId === 'lucky-sevens') {
    inner = `<path d="M 12 12 C 9.5 9 8.5 5.5 12 3.5 C 15.5 5.5 14.5 9 12 12 C 15 9.5 18.5 8.5 20.5 12 C 18.5 15.5 15 14.5 12 12 C 14.5 15 15.5 18.5 12 20.5 C 8.5 18.5 9.5 15 12 12 C 9 14.5 5.5 15.5 3.5 12 C 5.5 8.5 9 9.5 12 12 Z" fill="#222"/>`;
  } else if (mappedId === 'every-little') {
    inner = `<path d="M3 19 L11 6 L16 13.5 L19 9 L22 19 Z" fill="none" stroke="#222" stroke-width="2" stroke-linejoin="round"/><path d="M8 11 L11 15 L13.5 12.5" fill="none" stroke="#222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mappedId === 'couple-dice') {
    inner = `<path d="M 11.5 9.5 H 19.5 A 2.5 2.5 0 0 1 22 12 V 19.5 A 2.5 2.5 0 0 1 19.5 22 H 12 A 2.5 2.5 0 0 1 9.5 19.5 V 12.5" stroke="#222" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M 15.5 13.6 C 14.2 12.3 12.4 13.6 12.4 15.2 C 12.4 16.9 14.2 18.3 15.5 19.1 C 16.8 18.3 18.6 16.9 18.6 15.2 C 18.6 13.6 16.8 12.3 15.5 13.6 Z" fill="#222"/><g transform="rotate(-15 8 8)"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="#222" stroke-width="1.8" fill="#ffffff"/><path d="M 8 6.3 C 6.8 5.1 5.2 6.3 5.2 7.7 C 5.2 9.2 6.8 10.4 8 11.1 C 9.2 10.4 10.8 9.2 10.8 7.7 C 10.8 6.3 9.2 5.1 8 6.3 Z" fill="#222"/></g>`;
  } else if (mappedId === 'sevens-dice') {
    inner = `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#222" stroke-width="2"/><circle cx="7.5" cy="7.5" r="1.3" fill="#222"/><circle cx="16.5" cy="7.5" r="1.3" fill="#222"/><circle cx="7.5" cy="12" r="1.3" fill="#222"/><circle cx="12" cy="12" r="1.3" fill="#222"/><circle cx="16.5" cy="12" r="1.3" fill="#222"/><circle cx="7.5" cy="16.5" r="1.3" fill="#222"/><circle cx="16.5" cy="16.5" r="1.3" fill="#222"/>`;
  } else if (mappedId === 'copycat') {
    inner = `<path d="M4 8 l3-5 l4 3.5 l1-1 l1 1 l4-3.5 l3 5 v6 a5 5 0 0 1 -5 5 h-6 a5 5 0 0 1 -5 -5 z" fill="none" stroke="#222" stroke-width="2" stroke-linejoin="round"/><circle cx="8.5" cy="12" r="1.2" fill="#222"/><circle cx="15.5" cy="12" r="1.2" fill="#222"/><path d="M11 14.5 l1 1 l1 -1" fill="none" stroke="#222" stroke-width="1.5" stroke-linecap="round"/><path d="M4 12.5 h3.5 M4 14.5 h3 M20 12.5 h-3.5 M20 14.5 h-3" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (mappedId === 'doubling') {
    inner = `<rect x="4" y="4" width="8" height="8" rx="2" fill="none" stroke="#222" stroke-width="2"/><rect x="12" y="12" width="8" height="8" rx="2" fill="none" stroke="#222" stroke-width="2"/>`;
  } else if (mappedId === 'table-flip') {
    inner = `<path d="M 3 18 L 21 18 M 5 18 L 5 13 C 5 11 7 9 12 9 C 17 9 19 11 19 13 L 19 18 M 12 4 L 12 11 M 9 7 L 12 4 L 15 7" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (mappedId === 'equivalent-exchange') {
    // Lucide HandHelping 기반 손 모양 + 그 위에 떠 있는 주사위 (아래쪽 3개 보조선 제거)
    inner = `
      <!-- 손 모양 (HandHelping 스타일) -->
      <g stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
        <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.88l-1 .76" />
      </g>
      <!-- 손 위에 떠 있는 주사위 (회전된 큐브) -->
      <g transform="translate(7, 2) rotate(10)">
        <rect x="0" y="0" width="6" height="6" rx="1.2" fill="none" stroke="#222" stroke-width="1.5"/>
        <circle cx="2" cy="2" r="0.6" fill="#222"/>
        <circle cx="4" cy="4" r="0.6" fill="#222"/>
      </g>
    `;
  } else if (mappedId === 'bounty-hunter') {
    // Lucide Crosshair 테두리 + 중앙 미니 2D 주사위
    inner = `
      <!-- Crosshair (조준경 외각선 & 십자 돌출선) -->
      <circle cx="12" cy="12" r="9" fill="none" stroke="#222" stroke-width="1.8"/>
      <line x1="12" y1="2" x2="12" y2="5" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="19" x2="12" y2="22" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="5" y2="12" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="19" y1="12" x2="22" y2="12" stroke="#222" stroke-width="1.8" stroke-linecap="round"/>
      <!-- 중앙 미니 주사위 (마름모/비스듬한 각도 사각형) -->
      <g transform="translate(9.5, 9.5)">
        <rect x="0" y="0" width="5" height="5" rx="1" fill="#222" stroke="#222" stroke-width="0.5"/>
        <!-- 눈금 1개 (에이스 센터 도트) -->
        <circle cx="2.5" cy="2.5" r="0.6" fill="#fff"/>
      </g>
    `;
  } else if (mappedId === 'duel') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(2.666667)">
        <g fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="40" r="2.5" fill="#222"/>
          <path d="M 9.5 38.5 L 16 32 M 12 30 L 18 36"/>
          <path d="M 16 32 L 21 27 M 27 21 L 38 10"/>
          <circle cx="40" cy="40" r="2.5" fill="#222"/>
          <path d="M 38.5 38.5 L 32 32 M 36 30 L 30 36"/>
          <path d="M 32 32 L 10 10"/>
        </g>
      </g>
    </svg>`;
  } else if (mappedId === 'coin-toss') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(2.666667)">
        <g fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="24" cy="24" rx="10" ry="20" fill="#fff"/>
          <ellipse cx="24" cy="24" rx="4" ry="14"/>
          <path d="M 9 16 Q 3 24 9 32 M 39 16 Q 45 24 39 32" stroke-width="3"/>
          <path d="M 14 10 Q 10 15 14 20 M 34 10 Q 38 15 34 20" stroke-width="2" stroke-dasharray="2 4"/>
        </g>
      </g>
    </svg>`;
  } else if (mappedId === 'random-box') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(2.666667)">
        <g fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 24 8 L 40 18 L 40 34 L 24 44 L 8 34 L 8 18 Z"/>
          <path d="M 8 18 L 24 28 L 40 18 M 24 28 L 24 44"/>
          <path d="M 17 14 L 31 22.5" stroke-width="6"/>
          <path d="M 29 30 C 29 27 34 27 34 30 C 34 32 31.5 32.5 31.5 35 M 31.5 39 L 31.5 39.5" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M 12 25 L 18 28.5 M 12 30 L 16 32.5" stroke-width="2"/>
        </g>
      </g>
    </svg>`;
  } else if (mappedId === 'prophet') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(5.333333)">
        <g fill="none" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z"/>
          <circle cx="12" cy="12" r="2.5"/>
          <path d="M12 3v2 M5.5 5.5 7 7 M18.5 5.5 17 7"/>
        </g>
        <circle cx="12" cy="12" r="1" fill="#222"/>
      </g>
    </svg>`;
  } else if (mappedId === 'gambit') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <path d="M 40 20 A 18 18 0 1 0 40 56 A 18 18 0 1 0 40 20 Z" fill="#222"/>
      <rect x="22" y="56" width="36" height="12" rx="6" fill="#222"/>
      <path d="M 32 68 C 24 84 16 100 8 108 C 8 116 12 118 16 118 H 64 C 68 118 72 116 72 108 C 64 100 56 84 48 68 Z" fill="#222"/>
      <polygon points="86,44 118,60 118,96 86,112 54,96 54,60" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
      <g fill="none" stroke="#222" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="86,44 118,60 118,96 86,112 54,96 54,60" fill="#fff"/>
        <path d="M 86 76 L 86 112 M 86 76 L 54 60 M 86 76 L 118 60"/>
      </g>
      <g fill="#222">
        <circle cx="70" cy="60" r="4.5"/><circle cx="102" cy="60" r="4.5"/><circle cx="86" cy="52" r="4.5"/><circle cx="86" cy="68" r="4.5"/>
        <circle cx="70" cy="86" r="4.5"/><circle cx="58" cy="68" r="4.5"/><circle cx="82" cy="104" r="4.5"/><circle cx="82" cy="80" r="4.5"/><circle cx="58" cy="92" r="4.5"/>
        <circle cx="94" cy="78" r="4.5"/><circle cx="94" cy="90" r="4.5"/><circle cx="94" cy="102" r="4.5"/><circle cx="110" cy="70" r="4.5"/><circle cx="110" cy="82" r="4.5"/><circle cx="110" cy="94" r="4.5"/>
      </g>
    </svg>`;
  } else if (mappedId === 'double-down') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(2.666667)">
        <g fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 4 40 L 14 34 L 22 34 C 26 34 26 38 20 40 L 8 44 Z"/>
          <path d="M 14 34 L 16 26 C 19 24 21 28 18 30 L 16 34"/>
          <rect x="18" y="8" width="11" height="11" rx="2"/>
          <circle cx="23.5" cy="13.5" r="1.5" fill="#222" stroke="none"/>
          <rect x="30" y="18" width="11" height="11" rx="2"/>
          <circle cx="33" cy="21" r="1.5" fill="#222" stroke="none"/>
          <circle cx="38" cy="26" r="1.5" fill="#222" stroke="none"/>
          <path d="M 14 22 L 19 17 M 22 28 L 28 22" stroke-width="2.5" stroke-dasharray="3 4"/>
        </g>
      </g>
    </svg>`;
  } else if (mappedId === 'piggy-bank') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(2.666667)">
        <path d="M 28 23 A 12 11 0 0 0 10 30 C 6 30 6 36 10 36 A 12 11 0 0 0 14 41 L 14 44 L 18 44 L 18 42 H 30 L 30 44 L 34 44 L 34 40 A 12 11 0 0 0 41 30 C 45 30 45 36 40 36 A 12 11 0 0 0 33 23" fill="none" stroke="#222" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 10 30 Q 12 33 10 36 M 17 22 L 19 16 L 22 22" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="15" cy="28" r="2" fill="#222"/>
        <rect x="26" y="4" width="12" height="12" rx="2" fill="#fff" stroke="#222" stroke-width="3"/>
        <circle cx="29" cy="7" r="1.5" fill="#222"/>
        <circle cx="35" cy="13" r="1.5" fill="#222"/>
        <path d="M 32 18 V 23" fill="none" stroke="#222" stroke-width="2.5" stroke-dasharray="3 4"/>
      </g>
    </svg>`;
  } else if (mappedId === 'dice-alchemy') {
    return `<svg viewBox="0 0 128 128" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <g transform="scale(5.333333)">
        <g fill="none" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 3h6 M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>
          <path d="M7 15h10"/>
        </g>
        <circle cx="9" cy="17" r="0.9" fill="#222"/>
        <circle cx="12" cy="15.5" r="0.9" fill="#222"/>
        <circle cx="15" cy="17" r="0.9" fill="#222"/>
      </g>
    </svg>`;
  } else if (mappedId === 'nozdormu') {
    return `<svg viewBox="0 0 260 225" width="1.2em" height="1.2em" style="vertical-align: text-bottom; margin-right: 6px;">
      <defs>
        <clipPath id="nozdormu-flat-cut">
          <rect x="0" y="0" width="260" height="225" />
        </clipPath>
      </defs>
      <g clip-path="url(#nozdormu-flat-cut)">
        <path fill="#222" d="M199.02,231.09c-13.25-57.48-90.49-86.23-108.58-107.12c-9.3-10.74-6.97-22.15-1.16-28.29c6.24-6.58,18.13-7.88,27-2.09c7.76,5.05,22.86,19.06,26.25,24.23c3.39,5.16,3.35,9.43,5.17,12.9c2.07,3.9,6.75,5.98,13.53,3.95c6.28-1.87,9.75-4.35,9.75-4.35s-6.56-0.25-9.16-3.94c0,0-9.1-19.95-12.36-28.11c10.43,2.77,17.05,5.97,21.68,8.89c0.57,4.44-1.32,12.09-1.4,12.43c0.21-0.12,3.58-2.11,8.59-7.1c0.25,0.21,0.5,0.41,0.74,0.6c1.77,1.41-1.49,12.56-1.49,12.56s6.12-4.11,10.8-9.67c4.05-4.79,7.46-10.87,7.46-10.87s-13.25-5.6-19.36-15.3c-6.13-9.69-0.79-20.21-0.79-20.21s-10.22-3.28-18.78-15.62c-9-12.98-5.52-28.93-5.52-28.93c-7.32,2.94-13.74,17.5-13.74,17.5s-18.49-9.87-42.51-6.8C73.47,35.69,53.33,22.55,44.97,1.8c0,0-6.47,28.39,18.04,46.26c-1.33,0.9-2.66,1.85-3.99,2.87c-11.96,6.81-27.15,6.41-38.85-1.79c0,0,0.62,4.26,2.9,9.38c2.28,5.11,6.21,11.09,12.84,14.53c0.71,0.37,1.41,0.67,2.1,0.93c-1.38,2.2-2.66,4.48-3.81,6.82C27.67,91.76,14.56,97.3,2,94.02c0,0,6.59,12.03,18.41,13.5c2.73,0.34,5.11-0.07,7.15-0.88c-0.1,4.98,0.15,9.64,0.71,14.06c-0.3,9.68-6.83,18.27-16.35,20.99h-0.01c0,0,9.18,5.46,17.68,1.78c1.66-0.72,2.94-1.7,3.93-2.79c6.98,16.86,19.64,30.46,35.78,45.97c4.33,4.17,9.19,8.63,14.12,13.28c48.5,2.8,85.22,24.51,116.32,57.87C200.72,250.56,201.44,241.58,199.02,231.09z M147.91,70.11l13.72,13.65l-21.9-7.9L147.91,70.11z"/>
      </g>
    </svg>`;
  }

  return renderStandardIcon(inner);
}

export function getDicesIconSvg() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lucide-icon custom-dices-icon" style="flex-shrink: 0;">
    <path d="M 11.5 9.5 H 19.5 A 2.5 2.5 0 0 1 22 12 V 19.5 A 2.5 2.5 0 0 1 19.5 22 H 12 A 2.5 2.5 0 0 1 9.5 19.5 V 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="12.5" cy="12.5" r="1.1" fill="currentColor"/>
    <circle cx="18.5" cy="12.5" r="1.1" fill="currentColor"/>
    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>
    <circle cx="12.5" cy="18.5" r="1.1" fill="currentColor"/>
    <circle cx="18.5" cy="18.5" r="1.1" fill="currentColor"/>
    <g transform="rotate(-15 8 8)">
      <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
      <circle cx="5" cy="5" r="1.1" fill="#333333"/>
      <circle cx="8" cy="8" r="1.1" fill="#333333"/>
      <circle cx="11" cy="11" r="1.1" fill="#333333"/>
    </g>
  </svg>`;
}

export function getAugmentedDicesIconSvg() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lucide-icon custom-dices-icon" style="flex-shrink: 0;">
    <defs>
      <mask id="augmented-dice-gap-mask">
        <rect width="24" height="24" fill="#ffffff"/>
        <g transform="rotate(-15 8 8)">
          <rect x="2" y="2" width="12" height="12" rx="2.5" fill="#000000" stroke="#000000" stroke-width="2.2"/>
        </g>
      </mask>
    </defs>
    <g mask="url(#augmented-dice-gap-mask)">
      <rect x="9.5" y="9.5" width="12.5" height="12.5" rx="2.5" fill="#222222" stroke="#222222" stroke-width="1"/>
      <circle cx="12.5" cy="19.0" r="1.1" fill="#ffffff"/>
      <circle cx="15.75" cy="15.75" r="1.1" fill="#ffffff"/>
      <circle cx="19.0" cy="12.5" r="1.1" fill="#ffffff"/>
    </g>
    <g transform="rotate(-15 8 8)">
      <rect x="2" y="2" width="12" height="12" rx="2.5" fill="#222222" stroke="#222222" stroke-width="1"/>
      <circle cx="5" cy="5" r="1.1" fill="#ffffff"/>
      <circle cx="11" cy="5" r="1.1" fill="#ffffff"/>
      <circle cx="5" cy="11" r="1.1" fill="#ffffff"/>
      <circle cx="11" cy="11" r="1.1" fill="#ffffff"/>
    </g>
    <path d="M 18.5 3.5 L 20.5 1.5 L 22.5 3.5 M 20.5 1.5 V 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

export function getCirclePlusIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide-circle-plus" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`;
}

export function getCircleMinusIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide-circle-minus" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>`;
}

export function getFlagIconSvg() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide-flag" style="transform: rotate(-25deg); flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`;
}

export function getUnplugIconSvg() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="#ff6b6b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide-unplug" style="flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"><path d="m19 5 3-3"/><path d="m2 22 3-3"/><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m17.7 3.7-2.3 2.3 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"/></svg>`;
}
