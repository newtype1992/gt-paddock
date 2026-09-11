import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "./store";
import { connectionState } from "./gt7-model";
import { mergeFinishedSession } from "./session-model";
const Context = createContext(null);
export const local = "http://127.0.0.1:4181";
export function TelemetryProvider({ user, children }) {
  const [transport, setTransport] = useState("local");
  const [pairing, setPairing] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const generation = useRef(0);
  useEffect(() => {
    setConnected(false);
    setStatus(null);
    setSessions([]);
    setHistory([]);
    setSelected(null);
  }, [user?.id]);
  useEffect(() => {
    if (!connected) return;
    const current = ++generation.current;
    let timer;
    const controller = new AbortController();
    let rounds = 0;
    async function poll() {
      try {
        let next, saved;
        if (transport === "local") {
          const request = async (path) => {
            const r = await fetch(local + path, {
              headers: { Authorization: `Bearer ${pairing}` },
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(4000),
              ]),
            });
            if (r.status === 401) {
              if (current === generation.current && !controller.signal.aborted) {
                setConnected(false);
                setPairing('');
              }
              throw new Error('Pairing code expired or invalid. Copy the current code from the GT Paddock Companion window and reconnect.');
            }
            if (!r.ok)
              throw new Error(
                r.status === 401
                  ? "Pairing code is invalid."
                  : "Companion request failed.",
              );
            return r.json();
          };
          next = await request("/status");
          if (current !== generation.current || controller.signal.aborted) return;
          setStatus(next);
          setSessions((rows) => mergeFinishedSession(rows, next?.last_session));
          if (rounds % 6 === 0) saved = await request("/sessions");
        } else {
          if (!user)
            throw new Error("Sign in to GT Paddock for cloud telemetry.");
          const live = await supabase
            .from("gt7_live")
            .select("payload")
            .eq("owner_id", user.id)
            .maybeSingle()
            .abortSignal(controller.signal);
          if (live.error) throw live.error;
          next = live.data?.payload ?? null;
          if (rounds % 3 === 0) {
            const rows = await supabase
              .from("gt7_sessions")
              .select("payload")
              .eq("owner_id", user.id)
              .limit(50)
              .abortSignal(controller.signal);
            if (rows.error) throw rows.error;
            saved = rows.data
              .map((r) => r.payload)
              .sort((a, b) => b.started_at - a.started_at);
          }
        }
        if (current !== generation.current) return;
        setStatus(next);
        setSessions((rows) => mergeFinishedSession(saved ?? rows, next?.last_session, rows));
        setError(next?.errors?.receiver || next?.errors?.cloud || "");
        if (next?.sample && ["Live", "Simulation"].includes(connectionState(next)))
          setHistory((h) =>
            h.at(-1)?.packet_id === next.sample.packet_id
              ? h
              : [
                  ...h
                    .filter(
                      (s) => next.sample.captured_at - s.captured_at <= 120,
                    )
                    .slice(-239),
                  next.sample,
                ],
          );
      } catch (e) {
        if (!controller.signal.aborted && current === generation.current) {
          setStatus(null);
          setError(
            e.message === "Failed to fetch"
              ? "Companion unreachable. Start it on this PC and check the pairing code."
              : e.message,
          );
        }
      } finally {
        if (!controller.signal.aborted && current === generation.current) {
          rounds++;
          timer = setTimeout(poll, transport === "local" ? 500 : 2000);
        }
      }
    }
    poll();
    return () => {
      generation.current++;
      controller.abort();
      clearTimeout(timer);
    };
  }, [connected, transport, user?.id, pairing]);

  async function samplesFor(id, signal) {
    if (transport !== "local")
      throw new Error(
        "Raw lap samples are stored on your PC. Select This PC and connect the companion for lap analysis.",
      );
    if (!connected)
      throw new Error("Connect the companion in Live telemetry first.");
    const response = await fetch(
      local + "/export?session=" + encodeURIComponent(id),
      {
        headers: { Authorization: "Bearer " + pairing },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        "Could not load samples. Check the companion connection.",
      );
    return response.json();
  }
  async function companionRequest(path, body) {
    if (transport !== "local" || !connected)
      throw new Error("Connect This PC in Live telemetry first.");
    const response = await fetch(local + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Bearer " + pairing, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Companion request failed. Restart the updated companion if this action is unavailable.");
    return data;
  }
  return (
    <Context.Provider
      value={{
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
        samplesFor,
        companionRequest,
        user,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTelemetry() {
  return useContext(Context);
}
