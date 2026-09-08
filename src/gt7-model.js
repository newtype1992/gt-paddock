export function profileIdentifier(value) {
  const input = value.trim();
  if (/^[a-zA-Z0-9_-]{3,16}$/.test(input)) return input;
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter your PSN ID or Gran Turismo profile URL.");
  }
  if (
    url.protocol !== "https:" ||
    !["www.gran-turismo.com", "gran-turismo.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use your profile URL from gran-turismo.com.");
  const match = url.pathname.match(
    /^\/[a-z]{2}\/gt7\/user\/mymenu\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/profile\/?$/i,
  );
  if (!match) throw new Error("The URL must point to your GT7 profile.");
  return match[1];
}
export function lapTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "--:--.---";
  return `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, "0")}.${Math.floor(
    ms % 1000,
  )
    .toString()
    .padStart(3, "0")}`;
}
export function connectionState(status, now = Date.now()) {
  if (!status?.sample) return "Waiting for GT7";
  if (now - status.sample.captured_at * 1000 > 3000 || status.stale)
    return "Signal lost";
  if (status.sample.loading) return "Loading";
  if (status.sample.paused) return "Paused";
  if (!status.sample.on_track) return "Off track";
  return status.source === "simulation" ? "Simulation" : "Live";
}
