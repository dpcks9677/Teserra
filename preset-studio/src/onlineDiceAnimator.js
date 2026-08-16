export function interpolateKeyframes(keyframes, elapsedMs) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return null;
  const ordered = [...keyframes].sort((a, b) => Number(a.t) - Number(b.t));
  const time = Math.max(0, Number(elapsedMs) || 0);
  if (time <= ordered[0].t) return cloneFrame(ordered[0]);
  if (time >= ordered.at(-1).t) return cloneFrame(ordered.at(-1));
  const rightIndex = ordered.findIndex((frame) => frame.t >= time);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const ratio = (time - left.t) / Math.max(1, right.t - left.t);
  return {
    t: time,
    position: lerpVector(left.position, right.position, ratio),
    quaternion: slerpQuaternion(left.quaternion, right.quaternion, ratio)
  };
}

export function alignKeyframesToFinalQuaternion(keyframes, targetQuaternion) {
  if (!Array.isArray(keyframes) || !keyframes.length || !targetQuaternion) return keyframes;
  const finalQuaternion = normalizeQuaternion(keyframes.at(-1).quaternion);
  const target = normalizeQuaternion(targetQuaternion);
  const offset = multiplyQuaternion(invertQuaternion(finalQuaternion), target);
  return keyframes.map((frame) => ({
    ...frame,
    position: { ...frame.position },
    quaternion: multiplyQuaternion(normalizeQuaternion(frame.quaternion), offset)
  }));
}

function cloneFrame(frame) {
  return {
    t: Number(frame.t) || 0,
    position: { ...frame.position },
    quaternion: { ...frame.quaternion }
  };
}

function lerpVector(a, b, t) {
  return {
    x: Number(a.x) + (Number(b.x) - Number(a.x)) * t,
    y: Number(a.y) + (Number(b.y) - Number(a.y)) * t,
    z: Number(a.z) + (Number(b.z) - Number(a.z)) * t
  };
}

function slerpQuaternion(a, b, t) {
  let ax = Number(a.x) || 0;
  let ay = Number(a.y) || 0;
  let az = Number(a.z) || 0;
  let aw = Number(a.w);
  if (!Number.isFinite(aw)) aw = 1;
  let bx = Number(b.x) || 0;
  let by = Number(b.y) || 0;
  let bz = Number(b.z) || 0;
  let bw = Number(b.w);
  if (!Number.isFinite(bw)) bw = 1;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  if (dot > 0.9995) {
    return normalizeQuaternion({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t, w: aw + (bw - aw) * t });
  }
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sinAngle = Math.sin(angle);
  const leftWeight = Math.sin((1 - t) * angle) / sinAngle;
  const rightWeight = Math.sin(t * angle) / sinAngle;
  return normalizeQuaternion({ x: ax * leftWeight + bx * rightWeight, y: ay * leftWeight + by * rightWeight, z: az * leftWeight + bz * rightWeight, w: aw * leftWeight + bw * rightWeight });
}

function normalizeQuaternion(q) {
  const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

function invertQuaternion(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function multiplyQuaternion(a, b) {
  return normalizeQuaternion({
    x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
    y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
    z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  });
}
