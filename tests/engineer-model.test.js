import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineerRules, ConnectionAlerts, activeDriving, parseTargetTime } from '../src/engineer-model.js';

const options = { mode: 'trial', frequency: 'every' };
function fixture() {
  const rules = new EngineerRules();
  let now = 100000;
  const status = { source: 'console', stale: false, session: { id: 'one', laps: [] },
    sample: { captured_at: 100, on_track: true, paused: false, loading: false, lap: 1, fuel: 90 } };
  function tick(ms = 1000, config = options) {
    now += ms; status.sample.captured_at = now / 1000;
    return rules.step(status, true, config, now);
  }
  function lap(time = 90000, fuel = 80, config = options) {
    for (let i = 0; i < 8; i++) tick(1000, config);
    status.session.laps.push({ lap: status.sample.lap++, time_ms: time });
    status.sample.fuel = fuel;
    return tick(1000, config);
  }
  tick();
  return { rules, status, tick, lap };
}
test('requires fresh, explicit active driving flags', () => {
  const { status } = fixture();
  assert.equal(activeDriving(status, true, 101000), true);
  for (const flag of ['paused', 'loading']) {
    status.sample[flag] = true;
    assert.equal(activeDriving(status, true, 101000), false);
    status.sample[flag] = false;
  }
  assert.equal(activeDriving(status, false, 101000), false);
  assert.equal(activeDriving(status, true, 105000), false);
  status.sample.on_track = false;
  assert.equal(activeDriving(status, true, 101000), false);
});
test('deduplicates laps and announces session best improvements', () => {
  const f = fixture();
  assert.match(f.lap().text, /Lap 1/);
  assert.equal(f.tick(), null);
  assert.match(f.lap(89000).text, /New session best/);
  assert.equal(f.tick(), null);
});
test('pause, missing connection intervals and new sessions never replay history', () => {
  const f = fixture();
  f.lap(); f.status.sample.paused = true; assert.equal(f.tick(), null);
  f.status.session.laps.push({ lap: 2, time_ms: 80000 }); f.status.sample.lap = 3;
  f.status.sample.paused = false; assert.equal(f.tick(), null);
  assert.equal(f.tick(4000), null);
  f.status.session.id = 'new'; assert.equal(f.tick(), null);
});
test('race pit reminders follow entered plan', () => {
  const f = fixture();
  assert.match(f.lap(90000, 80, { mode: 'race', frequency: 'key', pitLap: 2 }).text, /Pit this lap/);
});
test('fuel warning requires three full consistent measured burns and race length', () => {
  const f = fixture(), config = { mode: 'race', frequency: 'every', totalLaps: 12 };
  for (const fuel of [70, 60, 50]) assert.doesNotMatch(f.lap(90000, fuel, config).text, /Fuel/);
  assert.match(f.lap(90000, 40, config).text, /4.0 laps remaining/);
  assert.doesNotMatch(f.lap(90000, 90, config).text, /Fuel/);
  assert.doesNotMatch(f.lap(90000, null, config).text, /Fuel/);
});
test('unknown race distance and unstable consumption suppress fuel advice', () => {
  const f = fixture();
  for (const fuel of [70, 60, 50, 40]) assert.doesNotMatch(f.lap(90000, fuel, {mode:'race',frequency:'every'}).text, /Fuel/);
  const g = fixture();
  for (const fuel of [70, 60, 30, 20]) assert.doesNotMatch(g.lap(90000, fuel, {mode:'race',frequency:'every',totalLaps:20}).text, /Fuel/);
});
test('recovered batches and invalid timing do not generate callouts', () => {
  const f = fixture();
  f.status.session.laps = [{lap:1,time_ms:90000},{lap:2,time_ms:88000}];
  f.status.sample.lap = 3; assert.equal(f.tick(), null);
  f.status.session.laps.push({lap:3,time_ms:-1});
  f.status.sample.lap = 4; assert.equal(f.tick(), null);
});

test('target parser rejects ambiguous, zero and invalid times', () => {
  assert.equal(parseTargetTime('1:30.500'), 90500);
  assert.equal(parseTargetTime('2:01.2'), 121200);
  for (const input of ['', '90', '1:60', '0:00', '-1:30', '1:30.0001', 'NaN'])
    assert.equal(parseTargetTime(input), null);
});
test('target comparisons are exact and key mode only reports crossings', () => {
  const f = fixture(), config = { mode:'race', frequency:'key', targetLapMs:90000, paceTrend:false };
  assert.equal(f.lap(91000,80,config), null);
  assert.match(f.lap(89999,80,config).text, /0.001 seconds quicker than your target/);
  assert.doesNotMatch(f.lap(89000,80,config).text, /target/);
  assert.match(f.lap(90500,80,config).text, /0.500 seconds slower than your target/);
  assert.match(f.lap(90000,80,config).text, /Exactly on your target/);
});
test('pace trends require three consecutive progressively changing laps', () => {
  const f = fixture(), config = {mode:'race',frequency:'key'};
  f.lap(93000,80,config); f.lap(92000,80,config);
  assert.match(f.lap(91000,80,config).text, /progressively quicker/);
  assert.equal(f.lap(90000,80,config), null);
  f.lap(92000,80,config);
  assert.match(f.lap(93000,80,config).text, /progressively slower/);
  const g = fixture();
  g.lap(90000); g.lap(89950);
  assert.doesNotMatch(g.lap(89900).text, /progressively/);
  const h = fixture();
  h.lap(93000); h.lap(92000); h.status.sample.lap = 4;
  assert.doesNotMatch(h.lap(91000).text, /progressively/);
});
test('plan progress has correct remaining laps without claiming actual race finish', () => {
  const f = fixture(), config = {mode:'race',frequency:'every',totalLaps:3};
  assert.match(f.lap(90000,80,config).text, /2 laps remaining in your entered race plan/);
  assert.match(f.lap(90000,80,config).text, /1 lap remaining in your entered race plan/);
  assert.match(f.lap(90000,80,config).text, /Entered race distance reached/);
  assert.doesNotMatch(f.lap(90000,80,config).text, /entered race|distance reached/i);
});
test('pit preparation precedes pit reminder and respects disabled callouts', () => {
  const f = fixture(), config = {mode:'race',frequency:'key',pitLap:3};
  assert.match(f.lap(90000,80,config).text, /Planned pit stop next lap/);
  assert.equal(f.tick(1000,config),null);
  assert.match(f.lap(90000,80,config).text, /Pit this lap according to your plan/);
  const g = fixture(), disabled = {...config,totalLaps:5,pitPreparation:false,raceProgress:false,paceTrend:false};
  assert.equal(g.lap(93000,80,disabled),null);
  g.lap(92000,80,disabled);
  assert.doesNotMatch(g.lap(91000,80,disabled).text, /progressively|remaining/);
});

test('race best comparisons require history and respect frequency and opt-out', () => {
  const f = fixture(), config = {mode:'race',frequency:'every',raceBest:true};
  assert.doesNotMatch(f.lap(90000,80,config).text, /session best/);
  assert.match(f.lap(90500,80,config).text, /0.500 seconds off session best/);
  assert.match(f.lap(90000,80,config).text, /Matched your session best/);
  assert.match(f.lap(89000,80,{...config,frequency:'key'}).text, /New session best/);
  assert.doesNotMatch(f.lap(88000,80,{...config,raceBest:false}).text, /session best/);
});
test('five-lap consistency uses a rolling consecutive window and resets on pause', () => {
  const f = fixture(), config = {mode:'race',frequency:'every',fiveLapConsistency:true,paceTrend:false};
  for (const time of [90000,90200,90400,90600]) assert.doesNotMatch(f.lap(time,80,config).text, /Last five/);
  assert.match(f.lap(90800,80,config).text, /Last five recorded laps within 0.800 seconds/);
  assert.match(f.lap(90200,80,config).text, /Last five recorded laps within 0.600 seconds/);
  f.status.sample.paused = true; f.tick(); f.status.sample.paused = false; f.tick();
  assert.doesNotMatch(f.lap(90000,80,config).text, /Last five/);
});
test('connection alerts debounce, deduplicate and ignore fresh off-track packets', () => {
  const rules = new ConnectionAlerts();
  const status = {sample:{captured_at:100,paused:true,on_track:false},stale:false};
  assert.equal(rules.step(status,true,false,100000),null);
  assert.equal(rules.step(status,true,true,100000),null);
  status.stale = true;
  assert.equal(rules.step(status,true,true,101000),null);
  assert.equal(rules.step(status,true,true,102000),null);
  assert.match(rules.step(status,true,true,103000).text,/connection lost/);
  assert.equal(rules.step(status,true,true,110000),null);
  status.stale = false; status.sample.captured_at = 110;
  assert.equal(rules.step(status,true,true,110000),null);
  assert.match(rules.step(status,true,true,111000).text,/connection restored/);
  assert.equal(rules.step(status,true,true,112000),null);
  rules.step(status,false,true,113000);
  assert.equal(rules.step(status,false,false,116000),null);
});
test('connection startup and brief outages do not produce invented transitions', () => {
  const rules = new ConnectionAlerts(), status = {sample:{captured_at:100}};
  assert.equal(rules.step(null,false,true,90000),null);
  assert.equal(rules.step(status,true,true,100000),null);
  rules.step(status,false,true,101000);
  assert.equal(rules.step(status,true,true,102000),null);
  rules.step(status,false,true,103000);
  assert.equal(rules.step(status,false,true,104000),null);
});

test('previous-lap comparison uses consecutive recorded laps, exact deltas and opt-out', () => {
  const f = fixture(), config = {...options, previousLap:true};
  assert.doesNotMatch(f.lap(90000,80,config).text,/previous recorded/);
  assert.match(f.lap(89999,80,config).text,/0.001 seconds quicker than your previous recorded lap/);
  assert.match(f.lap(90500,80,config).text,/0.501 seconds slower than your previous recorded lap/);
  assert.match(f.lap(90500,80,config).text,/Matched your previous recorded lap/);
  assert.doesNotMatch(f.lap(90000,80,{...config,previousLap:false}).text,/previous recorded/);
  f.status.sample.lap += 1;
  assert.doesNotMatch(f.lap(89000,80,config).text,/previous recorded/);
});
test('key updates limits previous-lap comparisons to improvements of at least a tenth', () => {
  const f = fixture(), config = {...options,frequency:'key',previousLap:true};
  f.lap(90000,80,config);
  assert.doesNotMatch(f.lap(89950,80,config).text,/previous recorded/);
  assert.match(f.lap(89850,80,config).text,/0.100 seconds quicker than your previous recorded lap/);
});
test('target streaks count equality, reset on misses, and use key milestones', () => {
  const f = fixture(), config = {...options,frequency:'key',targetStreaks:true,targetLapMs:90000,paceTrend:false};
  f.lap(90000,80,config); f.lap(90000,80,config);
  assert.match(f.lap(90000,80,config).text,/3 consecutive recorded laps at or below your target/);
  assert.equal(f.tick(1000,config),null);
  assert.equal(f.lap(90000,80,config),null);
  assert.match(f.lap(90000,80,config).text,/5 consecutive recorded laps/);
  f.lap(90001,80,config);
  assert.doesNotMatch(f.lap(90000,80,config).text,/consecutive recorded laps/);
});
test('streaks and previous comparisons reset on pause, new sessions and recovered batches', () => {
  for (const reset of ['pause','session','batch']) {
    const f = fixture(), config = {...options,targetStreaks:true,targetLapMs:90000,previousLap:true};
    f.lap(90000,80,config); f.lap(90000,80,config);
    if (reset === 'pause') { f.status.sample.paused = true; f.tick(); f.status.sample.paused = false; f.tick(); }
    if (reset === 'session') { f.status.session.id = 'changed'; f.tick(); }
    if (reset === 'batch') { f.status.session.laps.push({lap:3,time_ms:90000},{lap:4,time_ms:90000}); f.status.sample.lap = 5; f.tick(); }
    assert.doesNotMatch(f.lap(90000,80,config).text,/consecutive recorded laps|previous recorded/);
  }
});
test('streaks require enabled time-trial mode and the same explicit target', () => {
  for (const overrides of [{targetLapMs:null},{targetStreaks:false},{mode:'race'}]) {
    const f = fixture(), config = {...options,previousLap:true,targetStreaks:true,targetLapMs:90000,...overrides};
    for (let i=0;i<4;i++) assert.doesNotMatch(f.lap(90000,80,config).text,/consecutive recorded laps at or below/);
  }
  const f = fixture(), config = {...options,targetStreaks:true,targetLapMs:90000};
  f.lap(90000,80,config); f.lap(90000,80,config);
  assert.doesNotMatch(f.lap(90000,80,{...config,targetLapMs:91000}).text,/consecutive recorded laps at or below/);
});
