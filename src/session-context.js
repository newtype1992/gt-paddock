export function trackLabel(value = {}) {
  return (
    [
      value.track?.trim(),
      value.layout?.trim(),
      value.direction && value.direction !== "Unknown" ? value.direction : "",
    ]
      .filter(Boolean)
      .join(" / ") || "Track unassigned"
  );
}
export function trackKey(value = {}) {
  if (!value.track?.trim()) return null;
  return JSON.stringify(
    [value.track, value.layout ?? "", value.direction ?? "Unknown"].map((s) =>
      s.trim().toLowerCase(),
    ),
  );
}
export function sessionSettings(value = {}) {
  return [
    ["Mode", value.mode || "Unknown"],
    [
      "Fuel use",
      value.fuelMultiplier == null ? "Unknown" : `${value.fuelMultiplier}x`,
    ],
    [
      "Tyre wear",
      value.tyreMultiplier == null ? "Unknown" : `${value.tyreMultiplier}x`,
    ],
    ["Weather", value.weather || "Unknown"],
    ["Time of day", value.timeOfDay || "Unknown"],
    ["BoP", value.bop || "Unknown"],
  ];
}
export function multiplier(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
    throw new Error(
      "Multipliers must be between 0 and 100, or blank if unknown.",
    );
  return parsed;
}
