import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Gauge,
  Pause,
  Play,
  Thermometer,
} from "lucide-react";
import { lapTime } from "./gt7-model";

const channels = {
  speed: { name: "Speed", unit: "km/h", color: "#408cff" },
  rpm: { name: "Engine", unit: "rpm", color: "#b0c9ff" },
  throttle: { name: "Throttle", unit: "%", color: "#38dbc6" },
  brake: { name: "Brake", unit: "%", color: "#ff827e" },
};
const number = (v) => (Number.isFinite(v) ? Math.round(v) : "--");

function Dial({ value, max, label, unit, color }) {
  const ratio = Number.isFinite(value)
    ? Math.min(1, Math.max(0, value / max))
    : 0;
  return (
    <div
      className="instrument-dial"
      aria-label={`${label}: ${number(value)} ${unit}`}
    >
      <svg viewBox="0 0 240 200" aria-hidden="true">
        <circle
          cx="120"
          cy="116"
          r="88"
          fill="none"
          stroke="#24262c"
          strokeWidth="10"
          strokeDasharray="415 553"
          transform="rotate(135 120 116)"
        />
        <circle
          cx="120"
          cy="116"
          r="88"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${415 * ratio} 553`}
          transform="rotate(135 120 116)"
        />
        {Array.from({ length: 25 }, (_, i) => {
          const a = ((135 + (i * 270) / 24) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={120 + 101 * Math.cos(a)}
              y1={116 + 101 * Math.sin(a)}
              x2={120 + (i % 4 ? 105 : 110) * Math.cos(a)}
              y2={116 + (i % 4 ? 105 : 110) * Math.sin(a)}
              stroke={i / 24 <= ratio ? color : "#454851"}
            />
          );
        })}
      </svg>
      <div className="dial-value">
        <span>{label}</span>
        <strong>{number(value)}</strong>
        <small>{unit}</small>
      </div>
      <div className="dial-scale">
        <span>0</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function Trace({ data, channel, seconds }) {
  const plot = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const info = channels[channel];
  const end = data.at(-1)?.captured_at ?? 0;
  const points = data.filter(
    (s) => end - s.captured_at <= seconds && Number.isFinite(s[channel]),
  );
  const max =
    channel === "rpm"
      ? Math.max(
          10000,
          Math.ceil(Math.max(0, ...points.map((s) => s.rpm)) / 2000) * 2000,
        )
      : channel === "speed"
        ? Math.max(
            320,
            Math.ceil(Math.max(0, ...points.map((s) => s.speed)) / 80) * 80,
          )
        : 100;
  let path = "";
  points.forEach((s, i) => {
    const x = 48 + ((s.captured_at - end + seconds) / seconds) * (width - 70);
    const y = 174 - (Math.max(0, Math.min(max, s[channel])) / max) * 150;
    path += `${i && s.captured_at - points[i - 1].captured_at < 3 ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  return (
    <div className="scope-plot">
      <div className="scope-label">
        <span style={{ color: info.color }}>{info.name}</span>
        <strong>
          {number(points.at(-1)?.[channel])} <small>{info.unit}</small>
        </strong>
      </div>
      <svg
        ref={plot}
        viewBox={`0 0 ${width} 208`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${info.name} over the last ${seconds} seconds`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2={width - 22}
              y1={24 + i * 50}
              y2={24 + i * 50}
              stroke="#292c33"
              strokeDasharray="3 5"
            />
            <text x="36" y={28 + i * 50} textAnchor="end">
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1={48 + i * (width - 70) / 4}
              x2={48 + i * (width - 70) / 4}
              y1="24"
              y2="174"
              stroke="#1e2026"
            />
            <text x={48 + i * (width - 70) / 4} y="200" textAnchor="middle">
              {i === 4 ? "now" : `-${seconds * (1 - i / 4)}s`}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke={info.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.length > 0 && <circle cx={width - 22} cy={174 - Math.max(0, Math.min(max, points.at(-1)[channel])) / max * 150} r="3" fill={info.color} />}
        {!points.length && (
          <text x={width / 2} y="102" textAnchor="middle">
            Waiting for telemetry
          </text>
        )}
      </svg>
    </div>
  );
}

export function TelemetryInstruments({ sample, fresh, history }) {
  const [mode, setMode] = useState("power");
  const [seconds, setSeconds] = useState(60);
  const [frozen, setFrozen] = useState(null);
  const s = fresh ? sample : null;
  const data = frozen ?? history;
  const gear = s ? (s.gear === null ? "N" : s.gear === 0 ? "R" : s.gear) : "--";
  return (
    <>
      <section className="cockpit" aria-label="Live telemetry readings">
        <Dial
          label="Speed"
          value={s?.speed}
          max={Math.max(320, Math.ceil((s?.speed ?? 0) / 80) * 80)}
          unit="km/h"
          color="#408cff"
        />
        <div className="gear-tower">
          <span>GEAR</span>
          <strong>{gear}</strong>
          <div className="rpm-leds" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                className={
                  s &&
                  i / 12 <
                    s.rpm / Math.max(10000, Math.ceil(s.rpm / 2000) * 2000)
                    ? "lit"
                    : ""
                }
              />
            ))}
          </div>
          <small>RPM / DISPLAY SCALE</small>
        </div>
        <Dial
          label="Engine"
          value={s?.rpm}
          max={Math.max(10000, Math.ceil((s?.rpm ?? 0) / 2000) * 2000)}
          unit="rpm"
          color="#b0c9ff"
        />
        <div className="pedal-stack">
          {["throttle", "brake"].map((key) => (
            <div className="pedal-instrument" key={key}>
              <label htmlFor={`pedal-${key}`}>
                {channels[key].name}
                <strong>
                  {number(s?.[key])}
                  <small> %</small>
                </strong>
              </label>
              <meter
                id={`pedal-${key}`}
                min="0"
                max="100"
                value={s?.[key] ?? 0}
                style={{ "--channel": channels[key].color }}
              />
            </div>
          ))}
          <div className="fuel-reading">
            <span>Fuel remaining</span>
            <strong>
              {number(s?.fuel)} <small>L</small>
            </strong>
          </div>
        </div>
      </section>
      <div className="telemetry-secondary">
        <section className="scope-section">
          <header className="instrument-heading">
            <h2>
              <Activity size={17} /> Signal analysis
            </h2>
            <div className="scope-controls">
              <select
                aria-label="Trace time window"
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={120}>120 seconds</option>
              </select>
              <button
                className="icon-button"
                aria-label={frozen ? "Resume charts" : "Freeze charts"}
                title={frozen ? "Resume charts" : "Freeze charts"}
                onClick={() => setFrozen(frozen ? null : [...history])}
              >
                {frozen ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </div>
          </header>
          <div
            className="signal-tabs"
            role="tablist"
            aria-label="Signal channels"
          >
            <button
              role="tab"
              aria-selected={mode === "power"}
              onClick={() => setMode("power")}
            >
              <Gauge size={14} /> Powertrain
            </button>
            <button
              role="tab"
              aria-selected={mode === "inputs"}
              onClick={() => setMode("inputs")}
            >
              <BarChart3 size={14} /> Driver inputs
            </button>
            {frozen && <span>FROZEN</span>}
          </div>
          {(mode === "power" ? ["speed", "rpm"] : ["throttle", "brake"]).map(
            (channel) => (
              <Trace
                key={channel}
                channel={channel}
                seconds={seconds}
                data={data}
              />
            ),
          )}
        </section>
        <section className="thermal-section">
          <header className="instrument-heading">
            <h2>
              <Thermometer size={17} /> Tyre temperatures
            </h2>
            <small>CELSIUS</small>
          </header>
          <div className="thermal-layout">
            <div className="thermal-axle front" />
            <div className="thermal-axle rear" />
            <div className="thermal-chassis">
              <span>FRONT</span>
              <i />
              <span>REAR</span>
            </div>
            {["Front left", "Front right", "Rear left", "Rear right"].map(
              (label, i) => {
                const temp = s?.tyres?.[i];
                return (
                  <div
                    key={label}
                    className={`thermal-wheel wheel-${i}`}
                    style={{
                      "--heat": Number.isFinite(temp)
                        ? `hsl(${Math.max(0, 210 - Math.max(0, temp - 60) * 3)}, 85%, 65%)`
                        : "#606673",
                    }}
                  >
                    <span>{label}</span>
                    <strong>
                      {number(temp)}
                      <small> C</small>
                    </strong>
                    <div className="tyre-tread" />
                  </div>
                );
              },
            )}
          </div>
          <div className="thermal-legend">
            <span>60 C</span>
            <i />
            <span>130 C</span>
          </div>
        </section>
      </div>
    </>
  );
}

export function LapComparison({ laps = [] }) {
  const valid = laps.filter((l) => Number.isFinite(l.time_ms) && l.time_ms > 0);
  const best = Math.min(...valid.map((l) => l.time_ms));
  const max = Math.max(...valid.map((l) => l.time_ms));
  return (
    <section className="lap-comparison" aria-label="Lap time comparison">
      <header className="instrument-heading">
        <h2>
          <BarChart3 size={17} /> Lap comparison
        </h2>
        <small>ELAPSED TIME / SECONDS</small>
      </header>
      {valid.length ? (
        <div className="lap-bars">
          {valid.map((lap, i) => (
            <div className="lap-bar-row" key={i}>
              <span>L{lap.lap}</span>
              <div className="lap-bar-track">
                <i
                  style={{ width: `${(lap.time_ms / max) * 100}%` }}
                  className={lap.time_ms === best ? "best" : ""}
                />
              </div>
              <strong>{lapTime(lap.time_ms)}</strong>
              <small>
                {lap.time_ms === best
                  ? "BEST"
                  : `+${((lap.time_ms - best) / 1000).toFixed(3)}`}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No completed laps recorded.</div>
      )}
    </section>
  );
}
