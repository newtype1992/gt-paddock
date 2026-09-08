import React, { useMemo, useState } from "react";
import { distanceLap, compareDistance, atDistance } from "./distance-analysis";
import { tracePath } from "./session-model";

export function LapOverlay({
  left,
  right,
  leftLap,
  rightLap,
  channel,
  max,
  sameLap,
}) {
  const [mode, setMode] = useState("distance");
  const [cursor, setCursor] = useState(50);
  const a = useMemo(() => distanceLap(left, leftLap?.time_ms), [left, leftLap]);
  const b = useMemo(
    () => distanceLap(right, rightLap?.time_ms),
    [right, rightLap],
  );
  const comparison = useMemo(() => compareDistance(a, b), [a, b]);
  const distance = mode === "distance" && !comparison.error;
  const extent = distance
    ? comparison.length
    : Math.max(leftLap?.time_ms ?? 1, rightLap?.time_ms ?? 1) / 1000;
  const x = (extent * cursor) / 100;
  const readA = distance ? atDistance(a.points, x) : null,
    readB = distance ? atDistance(b.points, x) : null;
  const display = (v) => (Number.isFinite(v) ? v.toFixed(1) : "--");
  function path(lap, metric) {
    if (!distance) return tracePath(lap.points, channel, extent, max);
    return metric.points
      .filter((p) => p.distance <= extent)
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${45 + (p.distance / extent) * 730},${170 - (Math.max(0, Math.min(max, p[channel] ?? 0)) / max) * 145}`,
      )
      .join(" ");
  }
  const limit = Math.max(
    1,
    ...(comparison.deltas ?? []).map((d) => Math.abs(d.delta)),
  );
  return (
    <>
      <div className="signal-tabs" role="tablist" aria-label="Lap alignment">
        <button
          role="tab"
          aria-selected={mode === "distance"}
          onClick={() => setMode("distance")}
        >
          Estimated distance
        </button>
        <button
          role="tab"
          aria-selected={mode === "time"}
          onClick={() => setMode("time")}
        >
          Elapsed time
        </button>
      </div>
      {mode === "distance" && comparison.error && (
        <p className="coverage-note" role="status">
          {comparison.error} Showing elapsed time.
        </p>
      )}
      <p className="overlay-key">
        <span>Reference / blue</span>
        <span>Comparison / coral</span>
        <small>
          {distance
            ? "Speed-integrated metres / approximate, not track-map position"
            : "Elapsed seconds from observed lap boundary"}
        </small>
      </p>
      <div className="analysis-plot">
        <svg
          viewBox="0 0 800 210"
          role="img"
          aria-label="Recorded lap comparison graph"
          onPointerMove={(e) => {
            if (distance) {
              const box = e.currentTarget.getBoundingClientRect();
              setCursor(
                Math.max(
                  0,
                  Math.min(
                    100,
                    ((((e.clientX - box.left) / box.width) * 800 - 45) / 730) *
                      100,
                  ),
                ),
              );
            }
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1="45"
                x2="775"
                y1={25 + (i * 145) / 3}
                y2={25 + (i * 145) / 3}
                stroke="#30343e"
              />
              <text x="36" y={29 + (i * 145) / 3} textAnchor="end">
                {Math.round(max * (1 - i / 3))}
              </text>
            </g>
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <text x={45 + (i * 730) / 4} y="198" key={i} textAnchor="middle">
              {Math.round((extent * i) / 4)}
              {distance ? "m" : "s"}
            </text>
          ))}
          <path
            d={path(left, a)}
            fill="none"
            stroke="#408cff"
            strokeWidth="2"
          />
          <path
            d={path(right, b)}
            fill="none"
            stroke="#ff827e"
            strokeWidth="2"
            strokeDasharray="7 3"
          />
          {distance && (
            <line
              x1={45 + (cursor / 100) * 730}
              x2={45 + (cursor / 100) * 730}
              y1="20"
              y2="175"
              stroke="#dfe9fc"
              strokeDasharray="2 4"
            />
          )}
        </svg>
      </div>
      {distance && (
        <>
          <div className="comparison-cursor">
            <label>
              Distance cursor <strong>{Math.round(x)} m</strong>
              <input
                aria-label="Distance cursor"
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={cursor}
                onChange={(e) => setCursor(Number(e.target.value))}
              />
            </label>
            <dl>
              <div>
                <dt>Reference / {channel}</dt>
                <dd>{display(readA?.[channel])}</dd>
              </div>
              <div>
                <dt>Comparison / {channel}</dt>
                <dd>{display(readB?.[channel])}</dd>
              </div>
              <div>
                <dt>Time delta</dt>
                <dd>{display(readB?.elapsed - readA?.elapsed)} s</dd>
              </div>
            </dl>
          </div>
          <header className="instrument-heading">
            <h2>Time gained / lost</h2>
            <small>POSITIVE = COMPARISON SLOWER</small>
          </header>
          <div className="analysis-plot">
            <svg
              viewBox="0 0 800 150"
              role="img"
              aria-label="Time delta by estimated distance"
            >
              <line x1="45" x2="775" y1="70" y2="70" stroke="#465062" />
              {[-1, 0, 1].map((i) => (
                <text key={i} x="35" y={74 - i * 50} textAnchor="end">
                  {(limit * i).toFixed(1)}s
                </text>
              ))}
              <path
                d={comparison.deltas
                  .map(
                    (p, i) =>
                      `${i ? "L" : "M"}${45 + (p.distance / extent) * 730},${70 - (p.delta / limit) * 50}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="#69b4ff"
                strokeWidth="2"
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <text
                  key={i}
                  x={45 + (i * 730) / 4}
                  y="140"
                  textAnchor="middle"
                >
                  {Math.round((extent * i) / 4)}m
                </text>
              ))}
            </svg>
          </div>
          {!sameLap && (
            <div className="improvement-focus">
              <strong>Next review focus</strong>
              <p>
                {comparison.focus
                  ? `Review ${Math.round(comparison.focus.from)}-${Math.round(comparison.focus.to)} m: the comparison lost approximately ${comparison.focus.loss.toFixed(2)} s in this distance window. Compare speed and pedal inputs here before changing your braking approach.`
                  : "No clear local time-loss window above 0.2 s was identified in this comparison."}
              </p>
              <small>
                Estimated from travelled distance; different driving lines,
                spins and shortcuts can affect alignment.
              </small>
              {comparison.focus && (
                <button
                  className="button"
                  onClick={() =>
                    setCursor(
                      ((comparison.focus.from + comparison.focus.to) /
                        2 /
                        extent) *
                        100,
                    )
                  }
                >
                  Inspect this section
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
