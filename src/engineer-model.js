export function activeDriving(status, connected, now = Date.now()) {
  const s = status?.sample;
  return Boolean(connected && s && !status.stale && s.on_track === true &&
    s.paused === false && s.loading === false && Number.isFinite(s.captured_at) &&
    now / 1000 - s.captured_at >= -1 && now / 1000 - s.captured_at <= 3);
}

function validLap(lap) {
  return Number.isInteger(lap?.lap) && lap.lap > 0 && Number.isFinite(lap.time_ms) && lap.time_ms > 0;
}
function spokenTime(ms) {
  const seconds = ms / 1000;
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} minute${minutes === 1 ? '' : 's'} ${(seconds % 60).toFixed(1)} seconds` : `${seconds.toFixed(1)} seconds`;
}

export function parseTargetTime(value) {
  const match = /^(\d{1,2}):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const ms = Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number((match[3] ?? '').padEnd(3, '0'));
  return ms > 0 ? ms : null;
}

// Observe packet delivery, not on-track flags. Menus and pauses are not outages.
export class ConnectionAlerts {
  constructor() { this.reset(); }
  reset() { this.state = null; this.candidate = null; this.since = null; }
  step(status, connected, enabled, now = Date.now()) {
    if (!enabled) { this.reset(); return null; }
    const age = now / 1000 - status?.sample?.captured_at;
    const fresh = Boolean(connected && status?.sample && !status.stale && Number.isFinite(age) && age >= -1 && age <= 3);
    if (this.state === null) { if (fresh) this.state = true; return null; }
    if (fresh === this.state) { this.candidate = null; return null; }
    if (this.candidate !== fresh) { this.candidate = fresh; this.since = now; return null; }
    if (now - this.since < (fresh ? 1000 : 2000)) return null;
    this.state = fresh; this.candidate = null;
    return { text: fresh ? 'Telemetry connection restored.' : 'Telemetry connection lost.', priority: 'connection',
      at: now, lap: null, source: status?.source === 'simulation' ? 'simulation' : 'console' };
  }
}

// Rules use recorded lap events, not repeated raw last-lap fields. Fuel ratios
// cancel the packet's fuel unit; no litres or tyre-wear claims are made.
export class EngineerRules {
  constructor() { this.reset(); }
  reset() {
    this.id = null; this.seen = new Set(); this.best = null; this.times = [];
    this.fuelAnchor = null; this.burns = []; this.previousFuel = null;
    this.lastAt = null; this.lastSpoken = -Infinity;
    this.lastLap = null; this.trend = null; this.targetMet = null;
    this.targetStreak = null;
  }
  seed(status) {
    const laps = (status?.session?.laps ?? []).filter(validLap);
    this.id = status?.session?.id ?? null;
    this.seen = new Set(laps.map(l => l.lap));
    this.best = laps.length ? Math.min(...laps.map(l => l.time_ms)) : null;
    this.times = [];
    this.lastLap = null; this.trend = null; this.targetMet = null;
    this.targetStreak = null;
    this.fuelAnchor = null; this.burns = []; this.previousFuel = null;
  }
  step(status, connected, options, now = Date.now()) {
    if (!activeDriving(status, connected, now) || !status.session) {
      this.seed(status); this.lastAt = null;
      return null;
    }
    const s = status.sample, session = status.session;
    if (this.id !== session.id || this.lastAt === null || now - this.lastAt > 3000) {
      this.seed(status); this.lastAt = now;
      return null;
    }
    this.lastAt = now;
    const fuel = Number.isFinite(s.fuel) && s.fuel >= 0 ? s.fuel : null;
    if (fuel === null || (this.previousFuel !== null && fuel > this.previousFuel + 0.01)) {
      this.fuelAnchor = null; this.burns = [];
    }
    this.previousFuel = fuel;
    const fresh = (session.laps ?? []).filter(l => validLap(l) && !this.seen.has(l.lap));
    for (const l of fresh) this.seen.add(l.lap);
    if (!fresh.length) return null;
    const lap = fresh.at(-1), previousBest = this.best;
    for (const l of fresh) this.best = this.best === null ? l.time_ms : Math.min(this.best, l.time_ms);
    // Recovered batches are history, not live events. Do not read them aloud.
    if (fresh.length !== 1 || s.lap !== lap.lap + 1) {
      this.times = []; this.lastLap = null; this.trend = null; this.targetMet = null;
      this.targetStreak = null;
      this.fuelAnchor = null; this.burns = []; return null;
    }
    if (this.lastLap !== lap.lap - 1) {
      this.times = []; this.trend = null; this.targetMet = null;
      this.targetStreak = null;
    }
    this.lastLap = lap.lap;
    this.times = [...this.times, lap.time_ms].slice(-5);
    if (fuel !== null && this.fuelAnchor?.lap === lap.lap - 1) {
      const burn = this.fuelAnchor.fuel - fuel;
      this.burns = burn > 0 ? [...this.burns, burn].slice(-3) : [];
    } else this.burns = [];
    this.fuelAnchor = fuel === null ? null : { lap: lap.lap, fuel };
    const best = previousBest !== null && lap.time_ms < previousBest;
    const lines = [];
    const routine = [];
    let priority = 'routine';
    if (options.mode === 'race') {
      if (Number.isInteger(options.pitLap) && options.pitLap === s.lap) {
        lines.push('Pit this lap according to your plan.'); priority = 'plan';
      } else if (options.pitPreparation !== false && Number.isInteger(options.pitLap) && options.pitLap === s.lap + 1) {
        lines.push('Planned pit stop next lap.'); priority = 'plan';
      }
      const remaining = options.totalLaps - lap.lap;
      if (options.raceProgress !== false && Number.isInteger(options.totalLaps) && options.totalLaps > 0 && remaining >= 0 &&
          (options.frequency === 'every' || [5, 3, 2, 1, 0].includes(remaining))) {
        lines.push(remaining === 0 ? 'Entered race distance reached.' :
          `${remaining} lap${remaining === 1 ? '' : 's'} remaining in your entered race plan.`);
      }
      if (this.burns.length === 3 && fuel !== null) {
        const min = Math.min(...this.burns), max = Math.max(...this.burns);
        if (max / min <= 1.4) {
          const range = fuel / max;
          const remaining = options.totalLaps - lap.lap;
          if (Number.isInteger(options.totalLaps) && remaining > 0 && range < remaining) {
            lines.push(`Fuel may be short of the finish. Conservative estimate ${range.toFixed(1)} laps remaining.`);
            priority = 'fuel';
          }
        }
      }
      if (priority === 'routine' && (options.frequency === 'every' || lap.lap % 3 === 0))
        routine.push(`Lap ${lap.lap}, ${spokenTime(lap.time_ms)}.`);
    } else {
      if (best) { lines.push(`New session best. ${spokenTime(lap.time_ms)}. ${( (previousBest - lap.time_ms) / 1000).toFixed(1)} seconds quicker.`); priority = 'best'; }
      else if (options.frequency === 'every') {
        routine.push(`Lap ${lap.lap}, ${spokenTime(lap.time_ms)}.`);
        if (previousBest !== null) routine.push(`${((lap.time_ms - previousBest) / 1000).toFixed(1)} seconds off session best.`);
      }
    }
    const extras = [];
    if (options.mode === 'trial') {
      const previousTime = this.times.at(-2);
      if (options.previousLap === true && previousTime !== undefined) {
        const delta = lap.time_ms - previousTime;
        if (options.frequency === 'every' || delta <= -100)
          extras.push(delta === 0 ? 'Matched your previous recorded lap.' :
            `${(Math.abs(delta) / 1000).toFixed(3)} seconds ${delta < 0 ? 'quicker' : 'slower'} than your previous recorded lap.`);
      }
      if (options.targetStreaks === true && Number.isFinite(options.targetLapMs) && options.targetLapMs > 0 && lap.time_ms <= options.targetLapMs) {
        const count = this.targetStreak?.target === options.targetLapMs ? this.targetStreak.count + 1 : 1;
        this.targetStreak = { target: options.targetLapMs, count };
        if (count >= 3 && (options.frequency === 'every' || count === 3 || count % 5 === 0))
          extras.push(`${count} consecutive recorded laps at or below your target.`);
      } else this.targetStreak = null;
    } else this.targetStreak = null;
    if (options.mode === 'race' && options.raceBest === true && previousBest !== null &&
        (best || options.frequency === 'every' || lap.lap % 3 === 0)) {
      extras.push(best ? `New session best. ${((previousBest - lap.time_ms) / 1000).toFixed(3)} seconds quicker.` :
        lap.time_ms === previousBest ? 'Matched your session best.' :
          `${((lap.time_ms - previousBest) / 1000).toFixed(3)} seconds off session best.`);
    }
    if (options.fiveLapConsistency === true && this.times.length === 5 &&
        (options.frequency === 'every' || lap.lap % 5 === 0)) {
      extras.push(`Last five recorded laps within ${((Math.max(...this.times) - Math.min(...this.times)) / 1000).toFixed(3)} seconds.`);
    }
    if (Number.isFinite(options.targetLapMs) && options.targetLapMs > 0) {
      const difference = lap.time_ms - options.targetLapMs;
      const met = difference <= 0;
      if (options.frequency === 'every' || (met && this.targetMet !== true) || (!met && this.targetMet === true)) {
        const amount = (Math.abs(difference) / 1000).toFixed(3);
        extras.push(difference === 0 ? 'Exactly on your target lap time.' :
          `${amount} seconds ${met ? 'quicker than' : 'slower than'} your target lap time.`);
      }
      this.targetMet = met;
    }
    if (options.paceTrend !== false && this.times.length >= 3) {
      const [a, b, c] = this.times.slice(-3);
      const direction = a - b >= 100 && b - c >= 100 ? 'quicker' :
        b - a >= 100 && c - b >= 100 ? 'slower' : null;
      if (direction && (options.frequency === 'every' || direction !== this.trend))
        extras.push(`Last three recorded laps were progressively ${direction}.`);
      this.trend = direction;
    }
    if (!extras.length && routine.length && this.times.length >= 3 && priority === 'routine') {
      const spread = (Math.max(...this.times.slice(-3)) - Math.min(...this.times.slice(-3))) / 1000;
      routine.push(`Last three laps within ${spread.toFixed(1)} seconds.`);
    }
    // Keep plan/fuel information first, then explicit comparisons; trim routine detail.
    const messages = [...lines, ...extras, ...routine];
    if (!messages.length || now - this.lastSpoken < 6000) return null;
    this.lastSpoken = now;
    return { text: messages.slice(0, 4).join(' '), priority, lap: lap.lap, at: now,
      source: status.source === 'simulation' ? 'simulation' : 'console' };
  }
}
