# Account Onboarding and Private Profiles

## Implemented

- Email/password registration with repeated-password validation, verification instructions and resend confirmation.
- Sign-in, sign-out, reset-email request and PASSWORD_RECOVERY callback with password update form. Invalid/expired callback links show a recovery message.
- First-login routing to Settings profile setup, profile editing and sidebar display name. Local-only driving remains available without an account.
- `driver_profiles` is separate from provider snapshots. Only the authenticated owner can select/insert/update/delete; ownership reassignment and public visibility are rejected. No anonymous grants or public profiles.
- Optional PSN/GT7 links are self-reported, unverified associations, not OAuth or proof of ownership. Credentials are never stored in profile records.
- Auth changes remount the user-scoped workspace. Profile requests are aborted on unmount; drafts and companion pairing reset between accounts.

## Verification

`node --test tests/driver-profile.test.js` checks validation and executes migrations in PGlite, testing two-user isolation, anonymous denial, ownership protection, private-only visibility and cloud-session isolation.

`npm test` includes isolated Supabase-response fixtures for registration, resend, reset email, recovery callback/password update, expired links, profile save/reload, account switching and mobile overflow. These do not send emails or create real users. Existing recording workflows remain in the suite.

The migration is applied to the GT Paddock Supabase project. Live catalog queries verify RLS and grants; the security advisor reported no lints. No existing account or recording data was changed.

## Launch Gates

1. Configure custom SMTP and a verified sending identity. No SMTP credentials are included in the frontend or repository. Keep email confirmation enabled.
2. Deploy and set the exact production Site URL and allowed redirect origins. Both email confirmation and recovery use the current app origin; no user-supplied redirect destination is accepted.
3. With two real inboxes, verify delivery, confirmation, sign-in/out, recovery and profile isolation against the hosted app. No real-inbox test was performed in this milestone.
4. Configure abuse controls and review email rate limits before public registration. Account deletion and a production privacy notice are separate release work.

Local companion recordings are PC-scoped, not Supabase-user-scoped. A cloud sign-in does not isolate SQLite from another person with the same companion pairing code. Do not describe local shared-PC recordings as private per cloud account.

## References

- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
