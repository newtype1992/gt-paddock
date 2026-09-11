import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Headphones, Play, Square, Volume2, VolumeX, Radio, Settings2, X, Link, ArrowRight } from 'lucide-react';
import { useTelemetry } from './telemetry-store';
import { EngineerRules, ConnectionAlerts, activeDriving, parseTargetTime } from './engineer-model';
import { LapComparison } from './TelemetryInstruments';
import { CarIdentity } from './GT7';
import { lapTime, connectionState } from './gt7-model';
import './engineer.css';

function EngineerSettings({ running, open, close, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (!running) return;
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [running, open]);
  if (!running) return <div>{children}</div>;
  return <dialog ref={dialog} className="engineer-drawer" aria-labelledby="engineer-settings-title" onCancel={close}>
    <header><h2 id="engineer-settings-title">Engineer settings</h2><button className="button" aria-label="Close engineer settings" title="Close settings" onClick={close}><X size={18} /></button></header>
    {children}
  </dialog>;
}

export function RaceEngineer({ visible, go, openSession }) {
  const { status, connected, error: connectionError } = useTelemetry();
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState('race');
  const [frequency, setFrequency] = useState('every');
  const [volume, setVolume] = useState(0.8);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [online, setOnline] = useState(false);
  const [totalLaps, setTotalLaps] = useState('');
  const [pitLap, setPitLap] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [paceTrend, setPaceTrend] = useState(true);
  const [raceProgress, setRaceProgress] = useState(true);
  const [pitPreparation, setPitPreparation] = useState(true);
  const [raceBest, setRaceBest] = useState(true);
  const [fiveLapConsistency, setFiveLapConsistency] = useState(true);
  const [previousLap, setPreviousLap] = useState(true);
  const [targetStreaks, setTargetStreaks] = useState(true);
  const [connectionAlerts, setConnectionAlerts] = useState(false);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const utteranceRef = useRef(null);
  const rules = useRef(new EngineerRules());
  const connectionRules = useRef(new ConnectionAlerts());
  const speechKind = useRef(null);
  const latest = useRef({ status, connected });
  latest.current = { status, connected };
  const synth = typeof window !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null;
  const voiceChoices = voices.filter(v => online || v.localService);
  const voice = voiceChoices.find(v => v.voiceURI === voiceURI) ?? voiceChoices.find(v => v.lang.startsWith('en')) ?? voiceChoices[0];
  const cancel = () => { utteranceRef.current = null; synth?.cancel(); speechKind.current = null; setSpeaking(false); };
  useEffect(() => { if (!visible) setSettingsOpen(false); }, [visible]);
  useEffect(() => {
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    update(); synth.addEventListener('voiceschanged', update);
    return () => { utteranceRef.current = null; synth.removeEventListener('voiceschanged', update); synth.cancel(); };
  }, [synth]);
  useEffect(() => { cancel(); }, [muted, volume, voiceURI, online]);
  function speak(text, kind = 'driving') {
    if (!synth || !voice || muted || volume === 0) return;
    cancel();
    speechKind.current = kind;
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.voice = voice; utterance.volume = volume; utterance.rate = 1;
    utterance.onstart = () => {
      if (utteranceRef.current === utterance) { setSpeaking(true); setSpokenText(text); }
    };
    utterance.onend = () => {
      if (utteranceRef.current === utterance) { utteranceRef.current = null; setSpeaking(false); speechKind.current = null; }
    };
    utterance.onerror = e => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null; setSpeaking(false); speechKind.current = null;
      if (!['interrupted', 'canceled'].includes(e.error)) setError('Voice playback failed. Callouts remain in the history.');
    };
    try { synth.speak(utterance); }
    catch { utteranceRef.current = null; setSpeaking(false); speechKind.current = null; setError('Voice playback failed. Callouts remain in the history.'); }
  }
  useEffect(() => {
    function tick() {
      const { status: next, connected: linked } = latest.current;
      const driving = activeDriving(next, linked);
      setActive(driving);
      if (!running || (!driving && speechKind.current !== 'connection')) cancel();
      if (!running) return;
      const connectionEvent = connectionRules.current.step(next, linked, connectionAlerts);
      const lapEvent = rules.current.step(next, linked, {
        mode, frequency, totalLaps: totalLaps === '' ? null : Number(totalLaps),
        pitLap: pitLap === '' ? null : Number(pitLap),
        targetLapMs: parseTargetTime(targetTime), paceTrend, raceProgress, pitPreparation,
        raceBest, fiveLapConsistency, previousLap, targetStreaks,
      });
      const event = connectionEvent ?? lapEvent;
      if (event) {
        setLog(rows => [event, ...rows].slice(0, 50));
        speak(event.source === 'simulation' ? 'Test data. ' + event.text : event.text, event.priority === 'connection' ? 'connection' : 'driving');
      }
    }
    tick();
    const timer = setInterval(tick, 250);
    return () => { clearInterval(timer); if (running) cancel(); };
  }, [running, mode, frequency, totalLaps, pitLap, targetTime, paceTrend, raceProgress, pitPreparation, raceBest, fiveLapConsistency, previousLap, targetStreaks, connectionAlerts, muted, volume, voiceURI, voices, online]);
  useEffect(() => {
    if (!activeDriving(status, connected) && speechKind.current !== 'connection') cancel();
  }, [status, connected]);
  function start() {
    setError('');
    if (!connected || !status) { setError('Connect the companion in Live telemetry and wait for its status before starting.'); return; }
    if (targetTime.trim() && parseTargetTime(targetTime) === null) {
      setError('Enter a positive target lap time as m:ss or m:ss.SSS, for example 1:30.500.'); return;
    }
    const valid = value => value === '' || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999);
    if (mode === 'race' && (!valid(totalLaps) || !valid(pitLap) || (totalLaps && pitLap && Number(pitLap) > Number(totalLaps)))) {
      setError('Race length and pit lap must be whole numbers from 1 to 999, with the pit lap within the race.'); return;
    }
    rules.current.reset(); connectionRules.current.reset(); setSettingsOpen(false); setSpokenText(''); setLog([]); setRunning(true);
    // User gesture primes browser speech, but never speaks while off track.
    if (activeDriving(status, connected)) speak('Engineer ready.');
  }
  const laps = status?.session?.laps?.filter(l => Number.isFinite(l.time_ms) && l.time_ms > 0) ?? [];
  const connectionLabel = !connected ? 'Not connected' : !status ? connectionError ? 'Connection unavailable' : 'Connecting' : 'Connected';
  const drivingLabel = !connected || !status ? 'Unavailable' : connectionState(status);
  const audioLabel = muted || volume === 0 ? 'Muted / text callouts' : !voice ? 'Text only / no permitted voice' : `${voice.name} / ${voice.localService ? 'local' : 'online'}`;
  const radioState = muted || volume === 0 ? 'Muted' : speaking ? 'Transmitting' : !connected ? 'Disconnected' :
    !active ? status?.sample?.paused ? 'Paused' : 'Waiting for active driving' : !voice ? 'Text only' : 'Monitoring';
  function stopEngineer() {
    setRunning(false); cancel(); rules.current.reset(); connectionRules.current.reset();
    if (!visible) document.querySelector('main h1')?.focus();
  }
  function toggleMute() { cancel(); setMuted(v => !v); }
  const barSlot = document.getElementById('engineer-bar-slot');
  return <>
    {running && !visible && barSlot && createPortal(<section className="engineer-global-bar" aria-label="Running engineer">
      <div className="engineer-global-state"><Headphones size={19} aria-hidden="true" /><div><strong>{mode === 'race' ? 'Race' : 'Time trial'} engineer{status?.source === 'simulation' ? ' / TEST' : ''}</strong><span role="status">{radioState}</span></div></div>
      <div className="engineer-global-actions"><button className="button" onClick={() => go('Race engineer')}><ArrowRight size={16} />Return to engineer</button>
        <button className="button" aria-label={muted ? 'Unmute engineer' : 'Mute engineer'} title={muted ? 'Unmute engineer' : 'Mute engineer'} aria-pressed={muted} onClick={toggleMute}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
        <button className="button" aria-label="Stop engineer" title="Stop engineer" onClick={stopEngineer}><Square size={17} /></button></div>
    </section>, barSlot)}
    <div hidden={!visible}>
    <section className="engineer-controls">
      <header className="engineer-heading"><Headphones size={24} /><div><h2>Race engineer</h2><p role="status">{running ? active ? 'Listening to live telemetry' : 'Waiting for active driving' : 'Stopped'}{status?.source === 'simulation' ? ' / TEST DATA' : ''}</p></div></header>
      {!running && <section className="engineer-readiness" aria-label="Engineer readiness">
        <dl><div><dt>Companion</dt><dd>{connectionLabel}</dd></div><div><dt>Driving data</dt><dd>{drivingLabel}</dd></div><div><dt>Audio</dt><dd>{audioLabel}</dd></div></dl>
      </section>}
      {running && <section className="engineer-plan" aria-label="Current engineer plan"><span>{mode === 'race' ? 'Race' : 'Time trial'}</span><span>Target: {parseTargetTime(targetTime) ? lapTime(parseTargetTime(targetTime)) : 'Not set'}</span>
        {mode === 'race' && <><span>Race length: {totalLaps ? `${totalLaps} laps` : 'Not set'}</span><span>Pit lap: {pitLap || 'Not set'}</span></>}
        <span>{frequency === 'every' ? 'Every completed lap' : 'Key updates'}</span></section>}
      <div className="engineer-actions">
        <button className="button primary" onClick={running ? stopEngineer : start}>{running ? <Square size={16} /> : <Play size={16} />}{running ? 'Stop engineer' : 'Start engineer'}</button>
        <button className="button" aria-pressed={muted} onClick={toggleMute}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{muted ? 'Unmute engineer' : 'Mute engineer'}</button>
        <label className="engineer-master-volume">Volume<input aria-label="Engineer volume" type="range" min="0" max="1" step="0.1" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
        {running && <button className="button" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings2 size={16} />Settings</button>}
      </div>
      {!connected && <div className="engineer-actions"><button className="button" onClick={() => go('Live telemetry')}><Link size={16} />Connect companion</button></div>}
      {connected && !status?.session && status?.last_session && <div className="engineer-actions"><button className="button" onClick={() => openSession(status.last_session)}><ArrowRight size={16} />Review saved session</button></div>}
      {error && <p role="alert" className="error">{error}</p>}
      <EngineerSettings running={running} open={settingsOpen} close={() => setSettingsOpen(false)}>
      <fieldset disabled={running} className="engineer-mode"><legend>Session mode</legend>{[['race','Race'],['trial','Time trial']].map(([value,label]) => <label key={value}><input type="radio" name="engineer-mode" checked={mode === value} onChange={() => { setMode(value); rules.current.reset(); }} />{label}</label>)}</fieldset>
      <div className="engineer-fields">
        <label>Target lap time<input disabled={running} type="text" maxLength="9" placeholder="m:ss.SSS (optional)" value={targetTime} onChange={e => setTargetTime(e.target.value)} /></label>
        {mode === 'race' && <><label>Race length (laps)<input disabled={running} type="number" min="1" max="999" step="1" placeholder="Unknown" value={totalLaps} onChange={e => setTotalLaps(e.target.value)} /></label><label>Planned pit lap<input disabled={running} type="number" min="1" max="999" step="1" placeholder="Not planned" value={pitLap} onChange={e => setPitLap(e.target.value)} /></label></>}
      </div>
      <details className="engineer-advanced"><summary>Advanced settings</summary>
      <div className="engineer-fields">
        <label>Callout frequency<select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="every">Every completed lap</option><option value="key">Key updates</option></select></label>
        <label>Voice<select aria-label="Engineer voice" value={voice?.voiceURI ?? ''} onChange={e => setVoiceURI(e.target.value)}>{!voiceChoices.length && <option value="">Text only / no permitted voice</option>}{voiceChoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang}){v.localService ? '' : ' / online'}</option>)}</select></label>
      </div>
      <fieldset disabled={running} className="engineer-callouts"><legend>Additional callouts</legend>
        <label><input type="checkbox" checked={paceTrend} onChange={e => setPaceTrend(e.target.checked)} />Recorded pace trends</label>
        <label><input type="checkbox" checked={fiveLapConsistency} onChange={e => setFiveLapConsistency(e.target.checked)} />Five-lap consistency</label>
        {mode === 'trial' && <><label><input type="checkbox" checked={previousLap} onChange={e => setPreviousLap(e.target.checked)} />Previous-lap comparison</label>
          <label><input type="checkbox" checked={targetStreaks} onChange={e => setTargetStreaks(e.target.checked)} />Target streaks (entered target)</label></>}
        <label><input type="checkbox" checked={connectionAlerts} onChange={e => setConnectionAlerts(e.target.checked)} />Connection alerts (including off-track)</label>
        {mode === 'race' && <label><input type="checkbox" checked={raceBest} onChange={e => setRaceBest(e.target.checked)} />Session-best comparisons</label>}
        {mode === 'race' && <><label><input type="checkbox" checked={raceProgress} onChange={e => setRaceProgress(e.target.checked)} />Race progress (entered plan)</label>
          <label><input type="checkbox" checked={pitPreparation} onChange={e => setPitPreparation(e.target.checked)} />Pit preparation (entered plan)</label></>}
      </fieldset>
      <label className="engineer-online"><input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} />Allow online voices (callout text may be sent to the voice provider)</label>
      </details>
      {!voice && <p className="muted">Voice unavailable. Callouts will appear as text.</p>}
      {mode === 'race' && <p className="muted">Fuel-to-finish estimates need a race length and three consistent measured laps of fuel use. Pit reminders follow your entered plan.</p>}
      {mode === 'trial' && <p className="muted">Reference: current session best. Lap validity is not independently verified.</p>}
      </EngineerSettings>
    </section>
    {running && <section className="pit-radio" aria-label="Pit radio console" data-speaking={speaking && !muted && volume > 0}>
      <div className="pit-radio-top"><span><Radio size={18} /> PIT RADIO / {mode === 'race' ? 'RACE' : 'TIME TRIAL'}</span><strong role="status">{radioState}</strong></div>
      <div className="pit-radio-signal" aria-hidden="true">{Array.from({length:35},(_,i) => <i key={i} style={{'--bar-height':`${18 + ((i * 37 + 19) % 79)}%`, '--delay':`${-(i % 9) * 0.13}s`}} />)}</div>
      <div className="pit-radio-message"><span>{speaking ? 'ON AIR' : log.length ? 'LAST CALLOUT' : 'CHANNEL READY'}{status?.source === 'simulation' ? ' / TEST DATA' : ''}</span>
        <p>{speaking ? spokenText : log[0]?.text ?? 'Standing by for your next completed lap.'}</p></div>
      <dl className="pit-radio-stats"><div><dt>Current lap</dt><dd>{active && Number.isInteger(status?.sample?.lap) && status.sample.lap > 0 ? status.sample.lap : '--'}</dd></div>
        <div><dt>Last recorded lap</dt><dd>{lapTime(laps.at(-1)?.time_ms)}</dd></div><div><dt>Session best</dt><dd>{lapTime(laps.length ? Math.min(...laps.map(l=>l.time_ms)) : null)}</dd></div></dl>
    </section>}
    {status?.sample && <CarIdentity id={status.sample.car_id} source={status.source} label="Engineer car" />}
    <section className="engineer-history"><h2><Radio size={18} /> Callout history</h2>{log.length ? <ol>{log.map((event, i) => <li key={`${event.at}-${i}`}><span>{new Date(event.at).toLocaleTimeString()} / {event.lap === null ? 'Connection' : `Lap ${event.lap}`}{event.source === 'simulation' ? ' / TEST' : ''}</span><p>{event.text}</p></li>)}</ol> : <p className="muted">No callouts yet.</p>}</section>
    <LapComparison laps={status?.session?.laps ?? []} />
  </div></>;
}
