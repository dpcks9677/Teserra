export function getDicePresetKey(dice, { isFlip = false } = {}) {
  const list = Array.isArray(dice) ? dice : [];
  if (isFlip) return `flip_${list.length}`;
  const octaCount = list.filter((die) => die?.type === 'octahedron').length;
  const normalCount = list.length - octaCount;
  return octaCount === 0
    ? `normal_${normalCount}`
    : `mixed_${normalCount}normal_${octaCount}octa`;
}

export function getDicePresetFileName(dice, options) {
  return `dice_presets_${getDicePresetKey(dice, options)}.json`;
}

export function isPresetCompatible(preset, diceCount) {
  return Boolean(
    preset
    && Array.isArray(preset.frames)
    && preset.frames.length > 0
    && preset.frames.every((frame) => Array.isArray(frame) && frame.length === diceCount)
  );
}
