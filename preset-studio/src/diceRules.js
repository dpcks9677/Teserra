export const DIE_FACES = Object.freeze({
  normal: Object.freeze([1, 2, 3, 4, 5, 6]),
  heavy: Object.freeze([4, 4, 5, 5, 6, 6]),
  golden: Object.freeze([1, 2, 3, 4, 5, 6]),
  octahedron: Object.freeze([1, 2, 3, 4, 4, 5, 5, 6]),
  weird: Object.freeze([1, 2, 3, 4, 5, 6]),
  promotion: Object.freeze([1, 2, 3, 4, 5, 6]),
  couple: Object.freeze([1, 2, 3, 4, 5, 6]),
  sevens: Object.freeze([2, 3, 4, 5, 6, 7])
});

export function getDiceFaces(type) {
  return DIE_FACES[type] || DIE_FACES.normal;
}

export function getLocalDieValue(config, randomInt) {
  if (config?.type === 'promotion') {
    return Math.min(6, 1 + Math.max(0, Number(config.promotionLevel) || 0));
  }
  const faces = getDiceFaces(config?.type);
  return faces[randomInt(faces.length)];
}
