export function validLaps(session) {
  return (session?.laps ?? []).filter(
    (l) => Number.isFinite(l.time_ms) && l.time_ms > 0,
  );
}
export function bestLap(session) {
  const laps = validLaps(session);
  return laps.length ? Math.min(...laps.map((l) => l.time_ms)) : null;
}
export function sessionTotals(sessions) {
  return {
    sessions: sessions.length,
    cars: new Set(sessions.map((s) => s.car_id)).size,
    laps: sessions.reduce((n, s) => n + validLaps(s).length, 0),
    lapSeconds: sessions.reduce(
      (n, s) => n + validLaps(s).reduce((a, l) => a + l.time_ms / 1000, 0),
      0,
    ),
  };
}

// Use the observed finish boundary to align elapsed time. A recording can begin mid-lap.
export function lapSamples(samples, lap) {
  if (!lap) return { points: [], complete: false, coverage: 0 };
  const sorted = samples
    .filter((s) => Number.isFinite(s.captured_at))
    .toSorted((a, b) => a.captured_at - b.captured_at);
  const points = sorted.filter((s) => s.lap === lap.lap);
  const boundary = sorted.find(
    (s) =>
      s.lap === lap.lap + 1 &&
      s.captured_at > (points.at(-1)?.captured_at ?? Infinity),
  );
  if (!points.length || !boundary)
    return { points: [], complete: false, coverage: 0 };
  const start = boundary.captured_at - lap.time_ms / 1000;
  const aligned = points
    .map((s) => ({ ...s, elapsed: s.captured_at - start }))
    .filter((s) => s.elapsed >= -0.2 && s.elapsed <= lap.time_ms / 1000)
    .map((s) => ({ ...s, elapsed: Math.max(0, s.elapsed) }));
  let observed = 0;
  for (let i = 1; i < aligned.length; i++) {
    const dt = aligned[i].elapsed - aligned[i - 1].elapsed;
    if (dt > 0 && dt <= 1) observed += dt;
  }
  const coverage = Math.min(1, observed / (lap.time_ms / 1000));
  return { points: aligned, complete: coverage >= 0.97, coverage };
}

export function tracePath(points, channel, maxTime, maxValue) {
  let previous;
  return points
    .map((p) => {
      if (!Number.isFinite(p[channel])) {
        previous = null;
        return "";
      }
      const command = previous && p.elapsed - previous.elapsed <= 1 ? "L" : "M";
      previous = p;
      return `${command}${(45 + (p.elapsed / maxTime) * 730).toFixed(2)},${(170 - (Math.max(0, Math.min(maxValue, p[channel])) / maxValue) * 145).toFixed(2)}`;
    })
    .join(" ");
}
