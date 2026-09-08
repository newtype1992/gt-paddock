import React, { useState } from "react";
import { MapPin, Save } from "lucide-react";
import { multiplier, sessionSettings, trackLabel } from "./session-context";

export function TrackContext({ value = {} }) {
  return (
    <section className="track-context" aria-label="Track and session settings">
      <header>
        <MapPin size={18} />
        <div>
          <h2>{trackLabel(value)}</h2>
          <small>Manually entered / not detected from telemetry</small>
        </div>
      </header>
      <dl>
        {sessionSettings(value).map(([label, content]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{content}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SessionContextEditor({ value = {}, onSave }) {
  const [draft, setDraft] = useState({ ...value });
  const [message, setMessage] = useState("");
  const field = (key, label, options) => (
    <label>
      {label}
      {options ? (
        <select
          aria-label={label}
          value={draft[key] || "Unknown"}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          maxLength={120}
          value={draft[key] ?? ""}
          placeholder="Unknown"
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <form
      className="session-notes session-context-editor"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const updated = {
            ...draft,
            fuelMultiplier: multiplier(draft.fuelMultiplier),
            tyreMultiplier: multiplier(draft.tyreMultiplier),
          };
          for (const key of [
            "track",
            "layout",
            "weather",
            "timeOfDay",
            "notes",
          ])
            updated[key] = (draft[key] ?? "").trim();
          onSave(updated);
          setMessage("Saved on this browser.");
        } catch (error) {
          setMessage(error.message || "Could not save session details.");
        }
      }}
    >
      <h2>Track and conditions</h2>
      {field("track", "Track (manual)")}
      {field("layout", "Layout / variation")}
      {field("direction", "Direction", ["Unknown", "Forward", "Reverse"])}
      {field("mode", "Session mode", [
        "Unknown",
        "Time trial",
        "Practice",
        "Race",
        "License test",
        "Mission",
      ])}
      {["fuelMultiplier", "tyreMultiplier"].map((key) => (
        <label key={key}>
          {key === "fuelMultiplier"
            ? "Fuel consumption multiplier"
            : "Tyre wear multiplier"}
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="Unknown"
            value={draft[key] ?? ""}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        </label>
      ))}
      {field("weather", "Weather / progression")}
      {field("timeOfDay", "Time of day / progression")}
      {field("bop", "Balance of Performance", ["Unknown", "On", "Off"])}
      <label className="context-notes">
        Session notes
        <textarea
          rows={2}
          maxLength={2000}
          value={draft.notes ?? ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <div>
        <button className="button">
          <Save size={15} />
          Save session details
        </button>
        <span role="status">{message}</span>
      </div>
    </form>
  );
}
