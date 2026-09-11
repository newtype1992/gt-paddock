# Social Sign-In Setup

Google and Apple web OAuth buttons use Supabase `signInWithOAuth`. They are enabled only when the project's public Auth settings advertise the corresponding provider. The app returns to its own origin, then uses the existing private profile onboarding. Email/password and recovery remain available. No provider secret belongs in a VITE variable, browser storage, or this repository.

## Google

1. In https://console.cloud.google.com/auth/clients create an OAuth client of type Web application and configure the consent screen/audience. Add test users while the consent app is in testing.
2. Set authorized origins to the app's deployed origin and approved local development origin.
3. Set the authorized redirect URI to `https://zvemvophntoiluhdmwss.supabase.co/auth/v1/callback`.
4. Enter the client ID and secret privately in Supabase Authentication / Sign In Providers / Google, then enable it. Do not paste the secret into chat.

## Apple

Use an Apple Developer account, an App ID with Sign in with Apple enabled, an associated web Services ID, Team ID, Key ID and a signing key. Register the Supabase domain and the callback URI above. Configure the Services ID first in the Supabase Apple Client IDs list and add the generated client secret privately. Keep the .p8 key outside this repository. Web OAuth secrets need rotation at least every six months; expiry breaks sign-in.

Apple relay emails can differ from a driver's Google/email account. Do not assume those accounts are the same or merge them by display name/PSN ID. Manual provider linking is not implemented. Private profiles remain keyed by the authenticated Supabase user ID, not provider metadata.

## PlayStation

PlayStation is not a built-in Supabase social provider. A public third-party OAuth registration flow suitable for this companion could not be verified. An official Sony-approved integration and credentials would need to be established before implementing it. Do not reuse Sony first-party OAuth client IDs, scrape session cookies or request PlayStation passwords. A manually entered PSN/GT7 profile remains explicitly unverified.

## Verification and Deployment

Provider flags were checked live: both Google and Apple are currently disabled. Browser tests cover OAuth dispatch for both providers, fixed return origin, disabled states and settings-fetch retry. Existing tests cover authenticated callbacks/private onboarding. Real provider consent/login has not been tested and requires the developer configurations above. After configuration, reopen the account dialog to refresh provider availability. Production origins must be allowlisted in Supabase Auth URL Configuration.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://supabase.com/docs/guides/auth/social-login
- https://partners.playstation.net/
