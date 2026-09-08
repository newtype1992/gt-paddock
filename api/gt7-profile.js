import { createClient } from '@supabase/supabase-js';
import { profileIdentifier } from '../src/gt7-model.js';

export function normalizeDriver(driver) {
  if (!driver || typeof driver.PSN_ID !== 'string') throw new Error('The statistics provider returned an invalid driver.');
  const source = driver.stats ?? {};
  const stats = {};
  for (const key of ['total_races','victories','poles','fastest_laps','clean_races','collector_level','garage_count','dr_points']) {
    const value = source[key];
    stats[key] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }
  return { psn: driver.PSN_ID, nickname: driver.Nickname ?? driver.PSN_ID,
    driver_rating: driver.DR ?? null, sportsmanship_rating: driver.SR ?? null,
    stats, provider_updated_at: driver.last_sync ?? null, synced_at: new Date().toISOString(), source: 'GT GridStats' };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  const send = (code, value) => { res.statusCode = code; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
  if (req.method !== 'POST') return send(405,{ error:'Use POST.' });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send(503,{error:'Connect this deployment to Supabase before syncing account statistics.'});
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return send(401,{error:'Sign in to GT Paddock first.'});
  const db = createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError} = await db.auth.getUser(token);
  if (authError || !auth.user) return send(401,{error:'Your session expired. Sign in again.'});
  if (!process.env.GRIDSTATS_API_TOKEN) return send(503,{error:'GT GridStats API access is not configured. Your profile can still be saved locally.'});
  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 2048) return send(413,{error:'Request too large.'}); }
      body = JSON.parse(raw);
    }
    if (typeof body === 'string') body = JSON.parse(body);
    const identifier = profileIdentifier(String(body.identifier ?? ''));
    const {data:existing,error:readError} = await db.from('gt7_profiles').select('payload').eq('owner_id',auth.user.id).maybeSingle();
    if (readError) return send(503,{error:'Apply the GT7 database migration before syncing.'});
    if (existing?.payload?.synced_at && Date.now()-Date.parse(existing.payload.synced_at)<60000) return send(429,{error:'Please wait one minute between statistics syncs.'});
    const response = await fetch(`https://gt-gridstats.com/api/racers/${encodeURIComponent(identifier)}`,{headers:{Authorization:`Bearer ${process.env.GRIDSTATS_API_TOKEN}`,Accept:'application/json'},signal:AbortSignal.timeout(20000),redirect:'error'});
    if (!response.ok) return send(502,{error:`Statistics provider unavailable (${response.status}). Try again later.`});
    const result = await response.json();
    const driver = result.drivers?.find(d => d.PSN_ID?.toLowerCase() === identifier.toLowerCase() || d.GUID?.toLowerCase() === identifier.toLowerCase());
    if (!driver) return send(404,{error:'The provider has no statistics for this profile.'});
    const profile = normalizeDriver(driver);
    const {error} = await db.from('gt7_profiles').upsert({owner_id:auth.user.id,payload:profile});
    if (error) return send(500,{error:'Statistics were fetched but could not be saved.'});
    return send(200,profile);
  } catch(error) {
    if (error instanceof SyntaxError || /Enter your|profile URL|GT7 profile/.test(error.message)) return send(400,{error:error.message});
    return send(502,{error:'Account statistics could not be retrieved. Please try again.'});
  }
}
