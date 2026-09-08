import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Flag,
  LayoutDashboard,
  Gauge,
  Car,
  Timer,
  Activity,
  Settings,
  Menu,
  X,
  ChevronRight,
  HardDrive,
  Cloud,
  LogOut,
  Link,
} from "lucide-react";
import { supabase } from "./store";
import { TelemetryProvider, useTelemetry } from "./telemetry-store";
import { Telemetry } from "./GT7";
import {
  DrivingOverview,
  DrivenCars,
  SessionLibrary,
  LapAnalysis,
  useAnnotations,
} from "./SessionPages";
import { connectionState } from "./gt7-model";
import "./styles.css";
import "./night.css";
import "./sessions.css";

const navigation = [
  ["Overview", LayoutDashboard],
  ["Live telemetry", Gauge],
  ["Sessions", Timer],
  ["Lap analysis", Activity],
  ["Driven cars", Car],
  ["Settings", Settings],
];
function route() {
  try {
    const value = decodeURIComponent(location.hash.slice(1));
    return navigation.some(([name]) => name === value) ? value : "Overview";
  } catch {
    return "Overview";
  }
}
function App() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);
  return (
    <TelemetryProvider key={user?.id ?? "local"} user={user}>
      <Workspace
        user={user}
        authError={authError}
        setAuthError={setAuthError}
      />
    </TelemetryProvider>
  );
}
function Workspace({ user, authError, setAuthError }) {
  const [page, setPage] = useState(route);
  const [mobile, setMobile] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selection, setSelection] = useState(null);
  const { connected, status, error, transport } = useTelemetry();
  const [notes, saveNote] = useAnnotations(
    (user?.id ?? "local") + ":" + transport,
  );
  useEffect(() => {
    const changed = () => {
      setPage(route());
      setMobile(false);
    };
    addEventListener("hashchange", changed);
    return () => removeEventListener("hashchange", changed);
  }, []);
  function go(value) {
    setPage(value);
    location.hash = encodeURIComponent(value);
    setMobile(false);
  }
  function open(session, navigate = true) {
    setSelection(session?.id ?? null);
    if (navigate) go("Sessions");
  }
  const state = connected ? connectionState(status) : "Disconnected";
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a className="brand" href="#Overview" onClick={() => go("Overview")}>
          <span className="brand-mark">
            <Flag size={22} />
          </span>
          <span>
            GT <b>PADDOCK</b>
          </span>
        </a>
        <div className="team">
          <span className="avatar">GT</span>
          <div>
            <strong>Driver workspace</strong>
            <small>Gran Turismo 7</small>
          </div>
        </div>
        <div className="nav-caption">DRIVING</div>
        <nav>
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => go(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-state">
            {transport === "local" ? (
              <HardDrive size={16} />
            ) : (
              <Cloud size={16} />
            )}
            <span>
              {transport === "local" ? "PC recordings" : "Cloud summaries"}
            </span>
          </div>
          <button
            className="profile"
            onClick={() => (user ? go("Settings") : setAuthOpen(true))}
          >
            <span className="avatar">
              {user?.email?.slice(0, 2).toUpperCase() ?? "GT"}
            </span>
            <span>
              <strong>{user?.email ?? "Local driver"}</strong>
              <small>{user ? "Account settings" : "Sign in for cloud"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              icon={Menu}
              label="Toggle navigation"
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
            />
            <span>GT7</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <span className="mode-label">
            <i />
            {state}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">GT7 / DRIVER WORKSPACE</div>
              <h1>{page}</h1>
            </div>
          </div>
          {error && page !== "Live telemetry" && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {page === "Overview" && (
            <DrivingOverview go={go} notes={notes} open={open} />
          )}
          {page === "Live telemetry" && <Telemetry user={user} />}
          {page === "Sessions" && (
            <SessionLibrary
              go={go}
              notes={notes}
              saveNote={saveNote}
              selected={selection}
              open={open}
            />
          )}
          {page === "Driven cars" && <DrivenCars go={go} open={open} />}
          {page === "Lap analysis" && (
            <LapAnalysis go={go} selected={selection} open={open} notes={notes} />
          )}
          {page === "Settings" && (
            <div className="settings-layout">
              <section className="settings-section">
                <h2>Companion</h2>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      {transport === "local" ? "This PC" : "Cloud companion"}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{state}</dd>
                  </div>
                  <div>
                    <dt>Raw samples</dt>
                    <dd>PC / SQLite</dd>
                  </div>
                  <div>
                    <dt>Track labels and notes</dt>
                    <dd>This browser only</dd>
                  </div>
                  <div>
                    <dt>Units</dt>
                    <dd>km/h / C / litres</dd>
                  </div>
                </dl>
                <button className="button" onClick={() => go("Live telemetry")}>
                  <Link size={15} />
                  Connection settings
                </button>
              </section>
              <section className="settings-section">
                <h2>Account</h2>
                <p>
                  {user?.email ??
                    "Local mode. No account required for PC recordings."}
                </p>
                {user ? (
                  <button
                    className="button"
                    onClick={async () => {
                      const { error } = await supabase.auth.signOut();
                      setAuthError(error?.message ?? "");
                    }}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => setAuthOpen(true)}
                  >
                    Sign in / Create account
                  </button>
                )}
                {authError && <p role="alert">{authError}</p>}
                <p className="muted">
                  Account-statistics sync is unavailable until provider API
                  access is configured.
                </p>
              </section>
            </div>
          )}
          <footer>
            <span>GT PADDOCK / DRIVER ANALYSIS</span>
            <span>
              {transport === "local"
                ? "Local recordings"
                : "Cloud session summaries"}
            </span>
          </footer>
        </main>
      </div>
      {authOpen && (
        <Modal title="GT Paddock account" onClose={() => setAuthOpen(false)}>
          <AuthForm />
        </Modal>
      )}
    </div>
  );
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      <Icon size={17} />
    </button>
  );
}

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header>
          <h2>{title}</h2>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        {children}
      </div>
    </dialog>
  );
}

function AuthForm() {
  const [mode, setMode] = useState("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!supabase)
    return (
      <p className="auth-notice">
        Cloud sign-in is not configured for this deployment. Local recordings
        remain on this PC.
      </p>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const { error } =
            mode === "Sign in"
              ? await supabase.auth.signInWithPassword({ email, password })
              : await supabase.auth.signUp({
                  email,
                  password,
                  options: { emailRedirectTo: location.origin },
                });
          setMessage(
            error
              ? error.message
              : mode === "Sign in"
                ? "Signed in. Close this dialog to enter your workspace."
                : "Check your email to confirm your account.",
          );
        } catch (e) {
          setMessage(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="tabs">
        {["Sign in", "Create account"].map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              setMode(v);
              setMessage("");
            }}
            className={mode === v ? "selected" : ""}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="auth-fields">
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "Sign in" ? "current-password" : "new-password"
            }
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="form-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Please wait..." : mode}
        </button>
      </div>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
