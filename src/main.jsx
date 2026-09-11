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
  Headphones,
} from "lucide-react";
import { supabase } from "./store";
import { AccountAccess, DriverProfile, useDriverProfile } from "./Account";
import { TelemetryProvider, useTelemetry } from "./telemetry-store";
import { Telemetry } from "./GT7";
import { RaceEngineer } from './RaceEngineer';
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
  ["Race engineer", Headphones],
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
  const [authError, setAuthError] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).has("error")
      ? "This account link is invalid or expired. Request a new confirmation or password reset email."
      : "",
  );
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <TelemetryProvider key={user?.id ?? "local"} user={user}>
      <Workspace
        user={user}
        authError={authError}
        setAuthError={setAuthError}
        recovery={recovery}
        setRecovery={setRecovery}
      />
    </TelemetryProvider>
  );
}
function Workspace({ user, authError, setAuthError, recovery, setRecovery }) {
  const driver = useDriverProfile(user);
  const [page, setPage] = useState(route);
  const [mobile, setMobile] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selection, setSelection] = useState(null);
  const headingRef = useRef(null);
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    headingRef.current?.focus();
  }, [page, page === 'Sessions' ? selection : null]);
  useEffect(() => {
    if (!mobile) return;
    sidebarRef.current?.querySelector('nav button[aria-current="page"]')?.focus();
    const dismiss = (event) => {
      if (event.key === 'Escape') {
        setMobile(false);
        toggleRef.current?.focus();
      }
    };
    const outside = (event) => {
      if (!sidebarRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) setMobile(false);
    };
    const resized = () => { if (innerWidth > 760) setMobile(false); };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resized);
    };
  }, [mobile]);
  useEffect(() => {
    if (user && !driver.loading && !driver.error && !driver.profile)
      go("Settings");
  }, [user?.id, driver.loading, driver.error, driver.profile]);
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
    if (value === page) headingRef.current?.focus();
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
      <button className="skip-navigation" onClick={() => headingRef.current?.focus()}>Skip to main content</button>
      <aside ref={sidebarRef} id="workspace-navigation" className={"sidebar " + (mobile ? "mobile-open" : "")}>
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
        <nav aria-label="Workspace">
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              aria-current={page === label ? 'page' : undefined}
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
              <strong>
                {driver.profile?.display_name ?? user?.email ?? "Local driver"}
              </strong>
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
              ref={toggleRef}
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
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
        <div id="engineer-bar-slot" />
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">GT7 / DRIVER WORKSPACE</div>
              <h1 ref={headingRef} tabIndex={-1}>{page}</h1>
            </div>
          </div>
          {error && page !== "Live telemetry" && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {authError && (
            <p role="alert" className="error">
              {authError}
            </p>
          )}
          {page === "Overview" && (
            <DrivingOverview go={go} notes={notes} open={open} />
          )}
          {page === "Live telemetry" && <Telemetry user={user} go={go} openSession={open} />}
          <RaceEngineer visible={page === 'Race engineer'} go={go} openSession={open} />
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
            <LapAnalysis
              go={go}
              selected={selection}
              open={open}
              notes={notes}
            />
          )}
          {page === "Settings" && (
            <div className="settings-layout">
              {user && <DriverProfile user={user} state={driver} />}
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
                    <dd>
                      {transport === "local"
                        ? "Saved edits: PC / SQLite"
                        : "This browser only"}
                    </dd>
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
                      try {
                        const { error } = await supabase.auth.signOut();
                        setAuthError(error?.message ?? "");
                      } catch (e) {
                        setAuthError(e.message);
                      }
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
      {(authOpen || recovery) && (
        <Modal
          title={recovery ? "Set new password" : "GT Paddock account"}
          onClose={() => {
            setAuthOpen(false);
            setRecovery(false);
          }}
        >
          <AccountAccess
            key={recovery ? "recovery" : "access"}
            recovery={recovery}
            onDone={() => {
              setAuthOpen(false);
              setRecovery(false);
              setAuthError("");
              go("Settings");
            }}
          />
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

createRoot(document.getElementById("root")).render(<App />);
