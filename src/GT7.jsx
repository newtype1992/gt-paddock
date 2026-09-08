import React, { useEffect, useRef, useState } from "react";
import {
  Radio,
  Link,
  Unplug,
  Download,
  RefreshCw,
  ExternalLink,
  Gauge,
  Timer,
  Fuel,
  CircleAlert,
} from "lucide-react";
import { supabase } from "./store";
import { connectionState, lapTime, profileIdentifier } from "./gt7-model";
import "./gt7.css";
import { useTelemetry } from "./telemetry-store";
import { carIdentity } from "./gt7-cars";
import { TelemetryInstruments, LapComparison } from "./TelemetryInstruments";

const local = "http://127.0.0.1:4181";
function exportJSON(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Telemetry({ user }) {
  const {
    transport,
    setTransport,
    pairing,
    setPairing,
    connected,
    setConnected,
    status,
    setStatus,
    sessions,
    setSessions,
    history,
    setHistory,
    error,
    setError,
    selected,
    setSelected,
  } = useTelemetry();
  const [exporting, setExporting] = useState(false);
  const state = connected ? connectionState(status) : "Disconnected";
  const sample = status?.sample;
  const fresh = connected && sample && ["Live", "Simulation"].includes(state);
  const value = (key, suffix = "") =>
    fresh && Number.isFinite(sample[key])
      ? `${Math.round(sample[key])}${suffix}`
      : "--";
  const current =
    sessions.find((s) => s.id === selected?.id) ?? selected ?? status?.session;
  return (
    <div className="gt7-page">
      <section className="gt7-connect">
        <div>
          <h2>
            <Radio size={18} />
            PlayStation telemetry
          </h2>
          <p className="muted">
            {state}
            {status?.source === "simulation" ? " / TEST DATA" : ""}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setConnected(true);
          }}
        >
          <select
            aria-label="Telemetry source"
            value={transport}
            disabled={connected}
            onChange={(e) => {
              setTransport(e.target.value);
              setStatus(null);
              setHistory([]);
              setSessions([]);
            }}
          >
            <option value="local">This PC</option>
            <option value="cloud" disabled={!user}>
              Cloud companion
            </option>
          </select>
          {transport === "local" && (
            <input
              aria-label="Companion pairing code"
              type="password"
              autoComplete="off"
              placeholder="Companion pairing code"
              required
              disabled={connected}
              value={pairing}
              onChange={(e) => setPairing(e.target.value)}
            />
          )}
          {connected ? (
            <button
              type="button"
              className="button"
              onClick={(e) => {
                e.preventDefault();
                setConnected(false);
                setStatus(null);
                setHistory([]);
              }}
            >
              <Unplug size={15} />
              Disconnect
            </button>
          ) : (
            <button className="button primary">
              <Link size={15} />
              Connect
            </button>
          )}
        </form>
      </section>
      {error && (
        <div className="error" role="alert">
          <CircleAlert size={16} />
          {error}
        </div>
      )}
      {connected && status && (
        <section className="recording-health" aria-label="Recording status">
          <div>
            <strong>
              {status.session
                ? ({
                    recording: "Recording",
                    paused: "Recording paused",
                    signal_lost: "Recording interrupted",
                  }[status.recording_state] ?? "Recording")
                : status.last_session
                  ? "Session saved"
                  : "Ready for driving"}
            </strong>
            <span>
              {status.session
                ? `${status.session.samples} samples / ${status.session.laps.length} completed laps`
                : status.last_session
                  ? `${status.last_session.laps.length} completed laps / ${status.last_session.end_reason.replaceAll("_", " ")}`
                  : "Automatic recording starts on track"}
            </span>
          </div>
          <div>
            <span>
              {status.diagnostics?.silence_seconds != null
                ? `Last packet ${status.diagnostics.silence_seconds}s ago`
                : "Receiver connected"}
            </span>
            {status.session?.gaps > 0 && (
              <strong>{status.session.gaps} sampling gaps</strong>
            )}
          </div>
          {!status.session && status.last_session && (
            <a className="button" href="#Sessions">
              Review saved session
            </a>
          )}
        </section>
      )}
      {sample && (
        <CarIdentity
          id={sample.car_id}
          source={status?.source}
          label="Current car"
        />
      )}
      <TelemetryInstruments sample={sample} fresh={fresh} history={history} />
      <section className="session-metrics" aria-label="Session timing">
        <Reading label="Current lap" value={value("lap")} icon={Timer} />
        <Reading
          label="Last lap"
          value={fresh ? lapTime(sample.last_lap_ms) : "--:--.---"}
        />
        <Reading
          label="Session best"
          value={
            current?.laps?.length
              ? lapTime(Math.min(...current.laps.map((l) => l.time_ms)))
              : "--:--.---"
          }
        />
        <Reading
          label="Top speed"
          value={current ? Math.round(current.top_speed) : "--"}
          unit="km/h"
        />
      </section>
      <LapComparison laps={current?.laps} />
      <div className="gt7-session-grid">
        <section className="section">
          <div className="section-heading">
            <h2>Recorded sessions</h2>
            <span className="muted">{sessions.length}</span>
          </div>
          {sessions.length ? (
            sessions.map((s) => (
              <button
                className="recorded-session"
                aria-pressed={current?.id === s.id}
                key={s.id}
                onClick={() => setSelected(s)}
              >
                <span>
                  <strong>{carIdentity(s.car_id, s.source).name}</strong>
                  <small>
                    {new Date(s.started_at * 1000).toLocaleString()}
                  </small>
                </span>
                <span>{s.laps.length} laps</span>
                <span>{Math.round(s.top_speed)} km/h</span>
              </button>
            ))
          ) : (
            <div className="empty">No recorded sessions yet.</div>
          )}
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>{current ? "Session laps" : "Lap history"}</h2>
            {current && (
              <button
                className="button compact"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    let result = current;
                    if (transport === "local") {
                      const r = await fetch(
                        `${local}/export?session=${encodeURIComponent(current.id)}`,
                        {
                          headers: { Authorization: `Bearer ${pairing}` },
                          signal: AbortSignal.timeout(10000),
                        },
                      );
                      if (!r.ok)
                        throw new Error(
                          "Export failed. Reconnect to the companion.",
                        );
                      result = { session: current, samples: await r.json() };
                    }
                    exportJSON(result, `gt7-${current.id}.json`);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download size={14} />
                {exporting ? "Exporting..." : "Export"}
              </button>
            )}
          </div>
          {current && (
            <CarIdentity
              id={current.car_id}
              source={current.source}
              label="Session car"
            />
          )}
          {current?.laps.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {current.laps.map((lap, i) => (
                    <tr key={i}>
                      <td>{lap.lap}</td>
                      <td className="mono">{lapTime(lap.time_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No completed laps recorded.</div>
          )}
        </section>
      </div>
    </div>
  );
}
export function CarIdentity({ id, source, label }) {
  const car = carIdentity(id, source);
  const [failedImage, setFailedImage] = useState(null);
  return (
    <section className="gt7-car" aria-label={label}>
      <div className="gt7-car-name">
        <span className="muted">{label}</span>
        <h3>{car.name}</h3>
        {id != null && <small className="muted">GT7 ID {id}</small>}
      </div>
      {car.image && failedImage !== car.image.url ? (
        <figure>
          <img
            src={car.image.url}
            alt={`${car.name} model reference`}
            referrerPolicy="no-referrer"
            onError={() => setFailedImage(car.image.url)}
          />
          <figcaption>
            <a href={car.image.source} target="_blank" rel="noreferrer">
              GT7 model image
            </a>{" "}
            / not your custom livery
          </figcaption>
        </figure>
      ) : (
        <span className="muted">Model image unavailable</span>
      )}
    </section>
  );
}
function Reading({ label, value, unit, icon: Icon }) {
  return (
    <div>
      <span>
        {label}
        {Icon && <Icon size={15} />}
      </span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}

export function GTProfile({ user }) {
  const [identifier, setIdentifier] = useState("");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setIdentifier("");
    setMessage("");
    if (user) {
      supabase
        .from("gt7_profiles")
        .select("payload")
        .eq("owner_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (active) {
            if (error) setMessage(error.message);
            else {
              setProfile(data?.payload ?? null);
              setIdentifier(data?.payload?.psn ?? "");
            }
          }
        });
    } else {
      try {
        const saved = JSON.parse(
          localStorage.getItem("gt7-profile-link") ?? "null",
        );
        setIdentifier(saved?.identifier ?? "");
      } catch {
        setMessage("Saved profile link could not be read.");
      }
    }
    return () => {
      active = false;
    };
  }, [user?.id]);
  const stats = profile?.stats ?? {};
  return (
    <div className="gt7-page">
      <section className="gt7-profile-connect">
        <h2>Gran Turismo account</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              profileIdentifier(identifier);
              localStorage.setItem(
                "gt7-profile-link",
                JSON.stringify({ identifier }),
              );
              setMessage(
                "Profile link saved on this browser. Statistics have not been synced.",
              );
            } catch (e) {
              setMessage(e.message);
            }
          }}
        >
          <label>
            PSN ID or Gran Turismo profile URL
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="PSN ID or https://www.gran-turismo.com/.../profile"
            />
          </label>
          <div className="form-actions">
            <button className="button">
              <Link size={15} />
              Save profile link
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || !user}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  profileIdentifier(identifier);
                  const { data } = await supabase.auth.getSession();
                  const r = await fetch("/api/gt7-profile", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${data.session?.access_token}`,
                    },
                    body: JSON.stringify({ identifier }),
                    signal: AbortSignal.timeout(25000),
                  });
                  const result = await r.json();
                  if (!r.ok) throw new Error(result.error);
                  setProfile(result);
                  setMessage("Statistics synced.");
                } catch (e) {
                  setMessage(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              {busy ? "Syncing..." : "Sync statistics"}
            </button>
          </div>
        </form>
        {!user && (
          <p className="muted">
            Sign in to GT Paddock to sync account statistics.
          </p>
        )}
        {message && (
          <p role="status" className="gt7-message">
            {message}
          </p>
        )}
      </section>
      <div className="profile-identity">
        <div>
          <h2>{profile?.nickname ?? "No statistics synced"}</h2>
          <p>{profile?.psn ?? "Gran Turismo 7"}</p>
        </div>
        <div>
          <span>Driver rating</span>
          <strong>{profile?.driver_rating ?? "--"}</strong>
        </div>
        <div>
          <span>Sportsmanship</span>
          <strong>{profile?.sportsmanship_rating ?? "--"}</strong>
        </div>
      </div>
      <section className="gt7-readings">
        {[
          ["Races", "total_races"],
          ["Wins", "victories"],
          ["Pole positions", "poles"],
          ["Clean races", "clean_races"],
          ["Collector level", "collector_level"],
          ["Garage count", "garage_count"],
        ].map(([label, key]) => (
          <Reading key={key} label={label} value={stats[key] ?? "--"} />
        ))}
      </section>
      <div className="gt7-source">
        <span>
          {profile
            ? `${profile.source} / fetched ${new Date(profile.synced_at).toLocaleString()}`
            : "Statistics source: GT GridStats (third-party)"}
        </span>
        <a
          href="https://gt-gridstats.com/api-docs"
          target="_blank"
          rel="noreferrer"
        >
          Data provider <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
