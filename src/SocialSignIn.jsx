import React, { useEffect, useState } from 'react';
import { supabase } from './store';

export function SocialSignIn({ busy, setBusy, setMessage }) {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setProviders(null);
    async function load() {
      try {
        const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/auth/v1/settings', {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error('Social sign-in availability could not be checked.');
        const data = await response.json();
        if (!controller.signal.aborted) setProviders({ google: data.external?.google === true, apple: data.external?.apple === true });
      } catch (e) { if (!controller.signal.aborted) setError('Social sign-in availability could not be checked. Email sign-in is still available.'); }
    }
    load();
    return () => controller.abort();
  }, [retry]);
  async function signIn(provider) {
    if (!providers?.[provider] || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } });
      if (error) throw error;
    } catch (e) { setMessage(e.message || 'Social sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="social-sign-in" aria-label="Social sign-in">
    {['google', 'apple'].map(provider => <div key={provider}>
      <button type="button" className="button" disabled={busy || !providers?.[provider]} onClick={() => signIn(provider)}>
        Continue with {provider === 'google' ? 'Google' : 'Apple'}
      </button>
      {providers && !providers[provider] && <small>Not configured</small>}
    </div>)}
    {!providers && !error && <small>Checking sign-in providers...</small>}
    {error && <p role="alert">{error} <button type="button" className="text-button" onClick={() => setRetry(n => n + 1)}>Retry providers</button></p>}
  </section>;
}
