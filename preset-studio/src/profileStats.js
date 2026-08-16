export const DEFAULT_RATING = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function readRating(value) {
  const rating = Number(value);
  return value !== null && value !== '' && Number.isFinite(rating) ? Math.max(0, rating) : DEFAULT_RATING;
}

function getRatingDate(value) {
  if (value?.toDate) return value.toDate();
  if (Number.isFinite(value?.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRatingSeries(userData = {}, mode = 'normal', days = 90, now = new Date()) {
  const modeData = userData.stats?.modes?.[mode] || {};
  const currentRating = readRating(modeData.rating);
  const dayCount = Math.max(2, Math.floor(Number(days) || 90));
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startMs = endMs - (dayCount - 1) * DAY_MS;
  const history = (Array.isArray(modeData.ratingHistory) ? modeData.ratingHistory : [])
    .map((entry) => ({ rating: Number(entry?.rating), date: getRatingDate(entry?.at || entry?.date || entry?.createdAt) }))
    .filter((entry) => Number.isFinite(entry.rating) && entry.date)
    .map((entry) => ({ ...entry, time: entry.date.getTime() }))
    .sort((a, b) => a.time - b.time);

  let rating = history.filter((entry) => entry.time < startMs).at(-1)?.rating
    ?? history.find((entry) => entry.time >= startMs)?.rating
    ?? currentRating;
  let historyIndex = 0;
  while (historyIndex < history.length && history[historyIndex].time < startMs) historyIndex += 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const dayMs = startMs + index * DAY_MS;
    const nextDayMs = dayMs + DAY_MS;
    while (historyIndex < history.length && history[historyIndex].time < nextDayMs) {
      rating = history[historyIndex].rating;
      historyIndex += 1;
    }
    return { date: new Date(dayMs).toISOString().slice(0, 10), rating };
  });
}

export function getProfileModeStats(userData = {}) {
  const modes = userData.stats?.modes || {};
  return {
    augmented: {
      rating: readRating(modes.augmented?.rating)
    },
    normal: {
      rating: readRating(modes.normal?.rating),
      highestScore: Number(modes.normal?.highestScore) || 0,
      highestScoreAt: modes.normal?.highestScoreAt || null,
      upperBonusCount: Number(modes.normal?.upperBonusCount) || 0,
      yachtCount: Number(modes.normal?.yachtCount) || 0
    }
  };
}

export function getTopAugments(userData = {}, augments = [], limit = 3) {
  const stats = userData.stats || {};
  const counts = Object.fromEntries(
    Object.entries(stats.augmentStats || {}).map(([id, value]) => [id, Number(value?.selections) || 0])
  );
  const names = new Map(augments.map((augment) => [augment.augmentId, augment.name]));
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([aId, aCount], [bId, bCount]) => bCount - aCount || aId.localeCompare(bId))
    .slice(0, limit)
    .map(([id, count]) => ({ id, name: names.get(id) || id, count }));
}

export function updateProfileStats(stats = {}, result) {
  const score = Number(result.score) || 0;
  const modes = { ...(stats.modes || {}) };

  if (result.mode === 'normal') {
    const oldNormal = modes.normal || {};
    const oldHighest = Number(oldNormal.highestScore) || 0;
    modes.normal = {
      ...oldNormal,
      rating: readRating(oldNormal.rating),
      highestScore: Math.max(oldHighest, score),
      highestScoreAt: score > oldHighest ? result.completedAt : (oldNormal.highestScoreAt || null),
      upperBonusCount: (Number(oldNormal.upperBonusCount) || 0) + (result.upperBonusAchieved ? 1 : 0),
      yachtCount: (Number(oldNormal.yachtCount) || 0) + (result.yachtAchieved ? 1 : 0)
    };
  } else if (result.mode === 'augmented') {
    const oldAugmented = modes.augmented || {};
    modes.augmented = {
      ...oldAugmented,
      rating: readRating(oldAugmented.rating)
    };
  }

  return {
    ...stats,
    modeStatsVersion: 1,
    modes
  };
}
