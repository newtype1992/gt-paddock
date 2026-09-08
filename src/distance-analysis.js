export function distanceLap(lap, durationMs) {
  const duration = durationMs / 1000;
  const points = lap.points;
  if (!lap.complete || points.length < 3)
    return {
      error: "A nearly complete recording is required for distance alignment.",
    };
  if (points[0].elapsed > 0.25 || duration - points.at(-1).elapsed > 0.25)
    return {
      error: "The start or finish of this lap was not captured closely enough.",
    };
  const timed = [
    { ...points[0], elapsed: 0 },
    ...points.filter((p) => p.elapsed > 0),
    { ...points.at(-1), elapsed: duration },
  ];
  let distance = 0;
  const output = [];
  for (let i = 0; i < timed.length; i++) {
    const p = timed[i],
      prev = timed[i - 1];
    if (!Number.isFinite(p.speed) || p.speed < 0)
      return { error: "Invalid speed samples prevent distance alignment." };
    if (prev) {
      const dt = p.elapsed - prev.elapsed;
      if (dt > 1 || dt < 0)
        return { error: "A sample gap prevents reliable distance alignment." };
      distance += ((prev.speed + p.speed) / 2 / 3.6) * dt;
    }
    output.push({ ...p, distance });
  }
  if (distance < 100)
    return { error: "Too little travelled distance for a useful comparison." };
  return { points: output, length: distance };
}
export function atDistance(points, distance) {
  if (!points?.length || distance < 0 || distance > points.at(-1).distance)
    return null;
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].distance < distance) low = mid + 1;
    else high = mid;
  }
  const end = points[low],
    start = points[Math.max(0, low - 1)];
  const f =
    end.distance === start.distance
      ? 0
      : (distance - start.distance) / (end.distance - start.distance);
  const result = { distance };
  for (const key of ["elapsed", "speed", "rpm", "throttle", "brake"])
    result[key] =
      Number.isFinite(start[key]) && Number.isFinite(end[key])
        ? start[key] + (end[key] - start[key]) * f
        : null;
  result.gear = f < 1 ? start.gear : end.gear;
  return result;
}
export function compareDistance(left, right) {
  if (left.error || right.error) return { error: left.error || right.error };
  const mismatch =
    Math.abs(left.length - right.length) / Math.max(left.length, right.length);
  if (mismatch > 0.03)
    return {
      error:
        "Travelled lap distances differ by more than 3%. Review the laps in elapsed-time mode; distance alignment may be misleading.",
    };
  const length = Math.min(left.length, right.length);
  const deltas = Array.from({ length: 201 }, (_, i) => {
    const distance = (length * i) / 200;
    const a = atDistance(left.points, distance),
      b = atDistance(right.points, distance);
    return { distance, delta: b.elapsed - a.elapsed };
  });
  let focus = null;
  const steps = Math.max(
    1,
    Math.round((Math.min(200, length / 5) / length) * 200),
  );
  for (let i = steps; i < deltas.length; i++) {
    const loss = deltas[i].delta - deltas[i - steps].delta;
    if (!focus || loss > focus.loss)
      focus = {
        from: deltas[i - steps].distance,
        to: deltas[i].distance,
        loss,
      };
  }
  return { length, deltas, mismatch, focus: focus?.loss >= 0.2 ? focus : null };
}
