# CAPTCHA + Google Auth Setup

The frontend support for Cloudflare Turnstile and Google OAuth is configuration-gated.

Do not enable Supabase CAPTCHA protection until the Turnstile site key has been added to Vercel and a deployment containing the CAPTCHA UI is live. Otherwise email/password authentication will start requiring CAPTCHA tokens before the browser can provide them.

## Cloudflare Turnstile

1. In Cloudflare, create a Turnstile widget.
2. Use **Managed** mode.
3. Add the production hostname:
   `opportunity-dashboard-olive.vercel.app`
4. Add localhost only when you need local CAPTCHA testing.
5. Copy the Turnstile **Site Key** and **Secret Key**.
6. In Vercel, add the public site key:
   - Name: `VITE_TURNSTILE_SITE_KEY`
   - Value: the Turnstile Site Key
   - Enable it for Production. Add Preview only if preview URLs are also allowlisted in Cloudflare.
7. Redeploy the app so Vite can embed the site key.
8. In Supabase Dashboard open **Authentication → Attack Protection**.
9. Enable CAPTCHA protection, select **Cloudflare Turnstile**, enter the Turnstile **Secret Key**, and save.
10. Test sign-up, sign-in, and forgot-password from an incognito browser.

The Turnstile secret must stay only in Supabase/Cloudflare configuration. Never put it in a `VITE_*` variable.

## Google OAuth

Supabase callback URI for this project:

`https://vetnjqadmajyweebmxxi.supabase.co/auth/v1/callback`

Production app origin:

`https://opportunity-dashboard-olive.vercel.app`

1. Open Google Cloud Console and create/select a project.
2. Configure the OAuth consent screen.
3. For a private beta, keep the app in testing mode and add the intended tester emails if Google requires test users.
4. Create an **OAuth 2.0 Client ID** with application type **Web application**.
5. Add this Authorized JavaScript origin:
   `https://opportunity-dashboard-olive.vercel.app`
6. Add this Authorized redirect URI:
   `https://vetnjqadmajyweebmxxi.supabase.co/auth/v1/callback`
7. Copy the Google Client ID and Client Secret.
8. In Supabase Dashboard open **Authentication → Sign In / Providers → Google**.
9. Enable Google and paste the Client ID and Client Secret. Save.
10. In **Authentication → URL Configuration**:
    - set the Site URL to `https://opportunity-dashboard-olive.vercel.app`
    - ensure the same production origin is allowed as a redirect URL
11. In Vercel add:
    - Name: `VITE_GOOGLE_AUTH_ENABLED`
    - Value: `true`
    - Environment: Production
12. Redeploy.

The Google Client Secret belongs only in Supabase. Do not place it in Vercel browser-visible `VITE_*` variables.

## Expected new-user flow

Both email/password and Google OAuth end in the same app session flow:

`Authenticated user → workspace lookup → create incomplete workspace when missing → onboarding → dashboard`

Google OAuth does not bypass workspace RLS or onboarding.
