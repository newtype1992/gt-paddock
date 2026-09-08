import { LapOverlay } from "./LapOverlay";
import { TrackContext, SessionContextEditor } from "./SessionContext";
import { trackLabel, trackKey } from "./session-context";
import React, { useEffect, useState } from "react";
import { ArrowRight, Download, Upload, Search, Save, Activity } from "lucide-react";
import { useTelemetry } from "./telemetry-store";
import { CarIdentity } from "./GT7";
import { carIdentity } from "./gt7-cars";
import { lapTime } from "./gt7-model";
import { LapComparison } from "./TelemetryInstruments";
import {
  bestLap,
  lapSamples,
  sessionTotals,
  tracePath,
  validLaps,
} from "./session-model";

function saveFile(value, name) {
  const json = JSON.stringify(value);
  if (new Blob([json]).size > 64 * 1024 * 1024)
    throw new Error("Backup exceeds 64 MiB. Preserve the companion SQLite database instead.");
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useAnnotations(scope) {
  const { sessions, transport, companionRequest, setSessions } = useTelemetry();
  const key = "gt7-session-notes:" + scope;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  };
  const [notes, setNotes] = useState(read);
  useEffect(() => setNotes(read()), [key]);
  return [
    { ...notes, ...Object.fromEntries(sessions.filter(s => s.annotation !== undefined).map(s => [s.id, s.annotation])) },
    async (id, value) => {
      if (transport === "local") {
        const saved = await companionRequest("/annotations", { id, annotation: value });
        setSessions(rows => rows.map(s => s.id === id ? { ...s, annotation: saved } : s));
        return "Saved with recording on this PC.";
      }
      const next = { ...notes, [id]: value };
      localStorage.setItem(key, JSON.stringify(next));
      setNotes(next);
      return "Saved on this browser.";
    },
  ];
}
function SessionRows({ sessions, notes, open }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Car / session</th>
            <th>Track</th>
            <th>Laps</th>
            <th>Best lap</th>
            <th>Top speed</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{carIdentity(s.car_id, s.source).name}</strong>
                <small className="session-date">
                  {new Date(s.started_at * 1000).toLocaleString()}
                </small>
              </td>
              <td>{trackLabel(notes[s.id])}</td>
              <td>
                {validLaps(s).length}
                <small className="session-date">
                  {s.state ?? "saved"}
                  {s.gaps ? ` / ${s.gaps} gaps` : ""}
                </small>
              </td>
              <td className="mono">{lapTime(bestLap(s))}</td>
              <td>{Math.round(s.top_speed)} km/h</td>
              <td>
                <button
                  className="icon-button"
                  title="Open session"
                  aria-label={`Open session ${s.id}`}
                  onClick={() => open(s)}
                >
                  <ArrowRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RecordingEmpty({ go }) {
  const { connected, error } = useTelemetry();
  return (
    <div className="empty">
      <Activity size={24} />
      <h2>{connected ? "No recordings loaded" : "Connect your companion"}</h2>
      <p>
        {error ||
          (connected
            ? "Completed driving sessions will appear here."
            : "Your recordings remain on your PC.")}
      </p>
      <button className="button primary" onClick={() => go("Live telemetry")}>
        Live telemetry <ArrowRight size={15} />
      </button>
    </div>
  );
}
export function DrivingOverview({ go, notes, open }) {
  const { sessions } = useTelemetry();
  if (!sessions.length) return <RecordingEmpty go={go} />;
  const real = sessions.filter((s) => s.source !== "simulation");
  const totals = sessionTotals(real);
  const records = new Map();
  real.forEach((s) => {
    const track = trackKey(notes[s.id]);
    if (!track || !bestLap(s)) return;
    const key = `${s.car_id}:${track}`;
    if (!records.has(key) || bestLap(s) < bestLap(records.get(key)))
      records.set(key, s);
  });
  return (
    <div className="driving-page">
      <div className="recording-scope">
        Loaded recordings / up to 50 recent sessions / simulation excluded from
        totals
      </div>
      <section className="session-metrics">
        {[
          ["Sessions", totals.sessions],
          ["Completed laps", totals.laps],
          ["Driven cars", totals.cars],
          ["Timed lap minutes", (totals.lapSeconds / 60).toFixed(1)],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <CarIdentity
        id={real[0]?.car_id}
        source={real[0]?.source}
        label="Most recent car"
      />
      <section className="section">
        <header className="instrument-heading">
          <h2>Recent sessions</h2>
          <button className="text-button" onClick={() => go("Sessions")}>
            All sessions <ArrowRight size={14} />
          </button>
        </header>
        <SessionRows
          sessions={sessions.slice(0, 5)}
          notes={notes}
          open={open}
        />
      </section>
      <section className="section">
        <header className="instrument-heading">
          <h2>Personal bests</h2>
          <small>BY CAR + TRACK / LAYOUT / DIRECTION</small>
        </header>
        {records.size ? (
          <SessionRows
            sessions={[...records.values()]}
            notes={notes}
            open={open}
          />
        ) : (
          <div className="empty">
            Assign a track to a session to group personal bests.
          </div>
        )}
      </section>
    </div>
  );
}
export function DrivenCars({ go, open }) {
  const { sessions } = useTelemetry();
  const groups = new Map();
  sessions
    .filter((s) => s.source !== "simulation")
    .forEach((s) => groups.set(s.car_id, [...(groups.get(s.car_id) ?? []), s]));
  return groups.size ? (
    <div className="driving-page">
      <div className="recording-scope">
        Cars in loaded recordings / not your owned GT7 garage
      </div>
      {[...groups].map(([id, rows]) => (
        <section className="driven-car" key={id}>
          <CarIdentity id={id} label="Recorded car" />
          <div className="driven-car-footer">
            <span>{rows.length} sessions</span>
            <span>{sessionTotals(rows).laps} laps</span>
            <span>
              {Math.round(Math.max(...rows.map((s) => s.top_speed)))} km/h peak
            </span>
            <button className="button" onClick={() => open(rows[0])}>
              Latest session <ArrowRight size={14} />
            </button>
          </div>
        </section>
      ))}
    </div>
  ) : (
    <RecordingEmpty go={go} />
  );
}
export function SessionLibrary({ go, notes, saveNote, selected, open }) {
  const { sessions, companionRequest, transport, connected, setSessions } = useTelemetry();
  const [search, setSearch] = useState("");
  const [car, setCar] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const current = sessions.find((s) => s.id === selected) ?? null;
  async function exportSession() {
    setBusy(true);
    setMessage("");
    try {
      const bundle = transport === "local"
        ? await companionRequest("/backup?session=" + encodeURIComponent(current.id))
        : { session: current, annotation: notes[current.id] };
      // Include legacy browser details until the user explicitly saves them to SQLite.
      bundle.annotation = notes[current.id] ?? bundle.annotation ?? {};
      saveFile(bundle, `gt7-${current.id}.json`);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importSession(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error("Backup exceeds 64 MiB.");
      const bundle = JSON.parse(await file.text());
      const imported = await companionRequest("/import", bundle);
      setSessions(rows => [imported, ...rows.filter(s => s.id !== imported.id)].slice(0, 50));
      setMessage("Recording imported and saved on this PC.");
      open(imported);
    } catch (error) {
      setMessage(error instanceof SyntaxError ? "This file is not valid JSON." : error.message);
    } finally {
      setBusy(false);
    }
  }
  if (current)
    return (
      <div className="driving-page">
        <div className="library-actions">
          <button className="button" onClick={() => open(null)}>
            Back to sessions
          </button>
          <button className="button" disabled={busy} onClick={exportSession}>
            <Download size={15} />
            {busy
              ? "Exporting..."
              : transport === "local"
                ? "Export recording"
                : "Export summary"}
          </button>
          <button className="button primary" onClick={() => go("Lap analysis")}>
            <Activity size={15} />
            Analyze laps
          </button>
        </div>
        <CarIdentity
          id={current.car_id}
          source={current.source}
          label="Session car"
        />
        <p className="muted">
          {new Date(current.started_at * 1000).toLocaleString()} /{" "}
          {current.samples ?? "--"} samples / {current.source}
        </p>
        <TrackContext value={notes[current.id]} />
        <SessionContextEditor
          key={current.id}
          value={notes[current.id]}
          onSave={(value) => saveNote(current.id, value)}
        />
        {message && (
          <p role="alert" className="error">
            {message}
          </p>
        )}
        <LapComparison laps={current.laps} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lap</th>
                <th>Time</th>
                <th>Delta to best</th>
              </tr>
            </thead>
            <tbody>
              {validLaps(current).map((l, i) => (
                <tr key={i}>
                  <td>{l.lap}</td>
                  <td className="mono">{lapTime(l.time_ms)}</td>
                  <td>
                    +{((l.time_ms - bestLap(current)) / 1000).toFixed(3)} s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  const visible = sessions.filter(
    (s) =>
      (car === "all" || String(s.car_id) === car) &&
      `${carIdentity(s.car_id, s.source).name} ${trackLabel(notes[s.id])}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="section">
      <div className="toolbar">
        <label className="button">
          <Upload size={15} /> Import backup
          <input aria-label="Import session backup" type="file" accept=".json,application/json"
            disabled={busy || !connected || transport !== "local"} onChange={importSession}
            style={{ maxWidth: 210 }} />
        </label>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search sessions"
            placeholder="Search car or track"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter sessions by car"
          value={car}
          onChange={(e) => setCar(e.target.value)}
        >
          <option value="all">All cars</option>
          {[...new Set(sessions.map((s) => s.car_id))].map((id) => (
            <option key={id} value={id}>
              {carIdentity(id).name}
            </option>
          ))}
        </select>
        <span className="muted">
          {visible.length} / {sessions.length} loaded
        </span>
      </div>
      {message && <p role="alert" className="gt7-message">{message}</p>}
      {!connected && <p className="muted">Connect This PC to import a recording.</p>}
      {visible.length ? (
        <SessionRows sessions={visible} notes={notes} open={open} />
      ) : (
        <div className="empty">No matching sessions.</div>
      )}
    </section>
  );
}
export function LapAnalysis({ go, selected, open, notes }) {
  const { sessions, samplesFor, transport, connected, pairing, user } =
    useTelemetry();
  const current = sessions.find((s) => s.id === selected) ?? sessions[0];
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [a, setA] = useState(0),
    [b, setB] = useState(1);
  const [channel, setChannel] = useState("speed");
  useEffect(() => {
    setLoaded(null);
    setError("");
    const choices = validLaps(current);
    const best = choices.reduce(
      (index, lap, i) => (lap.time_ms < choices[index].time_ms ? i : index),
      0,
    );
    setA(best);
    setB(
      choices.length > 1
        ? best === choices.length - 1
          ? 0
          : choices.length - 1
        : 0,
    );
    if (!current) return;
    const controller = new AbortController();
    samplesFor(current.id, controller.signal)
      .then((samples) => {
        if (!controller.signal.aborted) setLoaded({ id: current.id, samples });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [current?.id, transport, connected, pairing, user?.id, retry]);
  if (!current) return <RecordingEmpty go={go} />;
  const laps = validLaps(current);
  const raw = loaded?.id === current.id ? loaded.samples : [];
  const left = lapSamples(raw, laps[a]),
    right = lapSamples(raw, laps[b]);
  const maxTime = Math.max(laps[a]?.time_ms ?? 1, laps[b]?.time_ms ?? 1) / 1000;
  const max =
    channel === "speed"
      ? Math.max(320, ...raw.map((s) => s.speed ?? 0))
      : channel === "rpm"
        ? Math.max(10000, ...raw.map((s) => s.rpm ?? 0))
        : channel === "gear"
          ? 10
          : 100;
  return (
    <div className="driving-page">
      <TrackContext value={notes[current.id]} />
      <div className="analysis-controls">
        <label>
          Session
          <select
            value={current.id}
            onChange={(e) =>
              open(
                sessions.find((s) => s.id === e.target.value),
                false,
              )
            }
          >
            {sessions.map((s) => (
              <option value={s.id} key={s.id}>
                {carIdentity(s.car_id, s.source).name} /{" "}
                {new Date(s.started_at * 1000).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        {[
          ["Reference lap", a, setA],
          ["Comparison lap", b, setB],
        ].map(([label, value, setter]) => (
          <label key={label}>
            {label}
            <select
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
            >
              {laps.map((l, i) => (
                <option key={i} value={i}>
                  Lap {l.lap} / {lapTime(l.time_ms)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {laps.length < 2 ? (
        <div className="empty">
          Two completed laps in one session are needed for comparison.
        </div>
      ) : (
        <>
          <section className="session-metrics">
            <div>
              <span>Reference</span>
              <strong>{lapTime(laps[a]?.time_ms)}</strong>
            </div>
            <div>
              <span>Comparison</span>
              <strong>{lapTime(laps[b]?.time_ms)}</strong>
            </div>
            <div>
              <span>Comparison minus reference</span>
              <strong>
                {((laps[b]?.time_ms - laps[a]?.time_ms) / 1000).toFixed(3)}
                <small>s</small>
              </strong>
            </div>
            <div>
              <span>Reference / comparison coverage</span>
              <strong>
                {Math.round(left.coverage * 100)} /{" "}
                {Math.round(right.coverage * 100)}
                <small>%</small>
              </strong>
            </div>
          </section>
          {a === b && (
            <p className="gt7-message">Select different laps to compare.</p>
          )}
          {error ? (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
            </div>
          ) : !loaded ? (
            <p role="status">Loading recorded samples...</p>
          ) : (
            <section className="section">
              <header className="instrument-heading">
                <h2>Recorded lap overlay</h2>
                <select
                  aria-label="Analysis channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="speed">Speed / km/h</option>
                  <option value="rpm">Engine / rpm</option>
                  <option value="throttle">Throttle / %</option>
                  <option value="brake">Brake / %</option>
                  <option value="gear">Gear</option>
                </select>
              </header>
              <LapOverlay
                left={left}
                right={right}
                leftLap={laps[a]}
                rightLap={laps[b]}
                channel={channel}
                max={max}
                sameLap={a === b}
              />
              {!left.points.length && !right.points.length && (
                <div className="empty">
                  No alignable lap samples in this recording.
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
