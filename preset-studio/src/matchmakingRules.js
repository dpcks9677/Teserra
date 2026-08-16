export const MATCH_RANGE_VALUES = Array.from({ length: 10 }, (_, index) => (index + 1) * 100);

export function isValidRatingBound(value) {
  return value === null
    || value === undefined
    || value === ""
    || value === "unlimited"
    || MATCH_RANGE_VALUES.includes(Number(value));
}

export function normalizeRatingBound(value) {
  if (value === null || value === undefined || value === "" || value === "unlimited") return null;
  const number = Number(value);
  return MATCH_RANGE_VALUES.includes(number) ? number : null;
}

export function isRatingAllowed(rating, lower, upper) {
  const value = Number(rating);
  const min = normalizeRatingBound(lower);
  const max = normalizeRatingBound(upper);
  return Number.isFinite(value) && (min === null || value >= min) && (max === null || value <= max);
}

export function areTicketsCompatible(a, b) {
  return Boolean(
    a && b
    && a.uid !== b.uid
    && a.mode === b.mode
    && isRatingAllowed(b.rating, a.lower, a.upper)
    && isRatingAllowed(a.rating, b.lower, b.upper)
  );
}
