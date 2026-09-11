import React, { useEffect, useState } from "react";
import { LockKeyhole, Save } from "lucide-react";
import { supabase } from "./store";
import { validateDriverProfile } from "./driver-profile";
import { SocialSignIn } from './SocialSignIn';

export function useDriverProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setProfile(null);
    setError("");
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    supabase
      .from("driver_profiles")
      .select("owner_id,display_name,psn_id,gt7_profile_url,visibility")
      .eq("owner_id", user.id)
      .maybeSingle()
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        setProfile(data);
        setError(error?.message ?? "");
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [user?.id, retry]);
  return {
    profile,
    setProfile,
    loading,
    error,
    retry: () => setRetry((n) => n + 1),
  };
}

export function DriverProfile({ user, state }) {
  const { profile, setProfile, loading, error, retry } = state;
  const [draft, setDraft] = useState({
    display_name: "",
    psn_id: "",
    gt7_profile_url: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft({
      display_name: profile?.display_name ?? "",
      psn_id: profile?.psn_id ?? "",
      gt7_profile_url: profile?.gt7_profile_url ?? "",
    });
  }, [profile]);
  if (loading) return <p role="status">Loading driver profile...</p>;
  if (error)
    return (
      <div role="alert">
        {error}
        <button className="button" onClick={retry}>
          Retry profile
        </button>
      </div>
    );
  return (
    <section className="settings-section driver-profile">
      <h2>{profile ? "Driver profile" : "Set up your driver profile"}</h2>
      <p className="muted">
        <LockKeyhole size={15} /> Private / only your account can access this
        profile.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const fields = validateDriverProfile(draft);
            const { data, error } = await supabase
              .from("driver_profiles")
              .upsert({ owner_id: user.id, ...fields })
              .select()
              .single();
            if (error) throw error;
            setProfile(data);
            setMessage("Private profile saved.");
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="auth-fields">
          <label>
            Display name
            <input
              required
              maxLength={60}
              autoComplete="nickname"
              value={draft.display_name}
              onChange={(e) =>
                setDraft({ ...draft, display_name: e.target.value })
              }
            />
          </label>
          <label>
            PSN ID (optional)
            <input
              maxLength={16}
              autoComplete="off"
              value={draft.psn_id}
              onChange={(e) => setDraft({ ...draft, psn_id: e.target.value })}
            />
          </label>
          <label>
            GT7 profile URL (optional)
            <input
              type="url"
              maxLength={200}
              value={draft.gt7_profile_url}
              onChange={(e) =>
                setDraft({ ...draft, gt7_profile_url: e.target.value })
              }
            />
          </label>
        </div>
        <p className="muted">
          Unverified account association. This does not connect PlayStation
          sign-in or enable Sport Mode statistics.
        </p>
        <button className="button primary" disabled={busy}>
          <Save size={15} />
          {busy ? "Saving..." : "Save private profile"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}

export function AccountAccess({ recovery = false, onDone }) {
  const [mode, setMode] = useState(recovery ? "Set new password" : "Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 60000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  if (!supabase)
    return (
      <p>Cloud sign-in is not configured. Local recordings remain available.</p>
    );
  const passwordMode = [
    "Sign in",
    "Create account",
    "Set new password",
  ].includes(mode);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          if (
            ["Create account", "Set new password"].includes(mode) &&
            password !== confirm
          )
            throw new Error("Passwords do not match.");
          let result;
          if (mode === "Sign in")
            result = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
          else if (mode === "Create account")
            result = await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: location.origin },
            });
          else if (mode === "Reset password")
            result = await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: location.origin,
            });
          else if (mode === "Resend confirmation")
            result = await supabase.auth.resend({
              type: "signup",
              email: email.trim(),
              options: { emailRedirectTo: location.origin },
            });
          else result = await supabase.auth.updateUser({ password });
          if (result.error) throw result.error;
          setPassword("");
          setConfirm("");
          if (
            mode === "Sign in" ||
            mode === "Set new password" ||
            result.data?.session
          ) {
            onDone();
            return;
          }
          setCooldown(true);
          setMessage(
            mode === "Reset password"
              ? "If this address has an account, a reset link will arrive by email."
              : "Check your email for a confirmation link. If already registered, sign in or reset your password.",
          );
        } catch (e) {
          setMessage(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!recovery && (
        <div className="tabs">
          {["Sign in", "Create account"].map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              className={mode === v ? "selected" : ""}
              onClick={() => {
                setMode(v);
                setMessage("");
                setPassword("");
                setConfirm("");
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {!recovery && ['Sign in', 'Create account'].includes(mode) && <SocialSignIn busy={busy} setBusy={setBusy} setMessage={setMessage} />}
      <div className="auth-fields">
        {!recovery && (
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
        )}
        {passwordMode && (
          <label>
            {recovery ? "New password" : "Password"}
            <input
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "Sign in" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {["Create account", "Set new password"].includes(mode) && (
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      <button
        className="button primary"
        disabled={busy || (cooldown && !passwordMode)}
      >
        {busy ? "Please wait..." : mode}
      </button>
      {!recovery && (
        <div className="form-actions">
          {["Reset password", "Resend confirmation"].map((v) => (
            <button
              type="button"
              className="text-button"
              key={v}
              disabled={busy}
              onClick={() => {
                setMode(v);
                setMessage("");
                setPassword("");
                setConfirm("");
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
