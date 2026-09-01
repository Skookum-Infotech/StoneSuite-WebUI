import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Matches any absolute URL ("https://host/api", "//host/api"), i.e. anything
// that is not a same-origin relative path.
const ABSOLUTE_URL_PATTERN = /^([a-z][a-z0-9+.-]*:)?\/\//i
// Only a full "https://host[:port]/path" URL is acceptable for the opt-in
// cross-origin case below — "//host/api" (protocol-relative) is rejected so a
// misconfigured build fails loudly instead of resolving against an unexpected
// scheme.
const ABSOLUTE_HTTPS_URL_PATTERN = /^https:\/\//i

const API_BASE_URL_VAR = 'VITE_API_BASE_URL'
const CROSS_ORIGIN_API_VAR = 'VITE_CROSS_ORIGIN_API'

const NOTIFY_BASE_URL_VAR = 'VITE_NOTIFY_BASE_URL'
// Only loopback may drop to http:// — see assertNotifyBaseUrl.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

/** URL parse that reports failure as undefined rather than throwing, so callers
 *  can treat "malformed" and "wrong scheme" as one rejection path. */
function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

/**
 * A deployed build must call the API through a same-origin relative path,
 * unless it explicitly opts in via VITE_CROSS_ORIGIN_API=true.
 *
 * The backend issues its auth cookies (auth_token, refresh_token, csrf_token)
 * host-only. Point a same-origin build at an absolute backend URL and the
 * browser scopes csrf_token to the backend's host, where document.cookie
 * cannot read it — so src/api/client.ts never attaches X-CSRF-Token and every
 * mutating request is rejected with "Request rejected: missing or invalid
 * CSRF token." The refresh_token round-trip breaks the same way.
 *
 * Same-origin builds route traffic through the Cloudflare Pages Function
 * (functions/api/[[path]].ts), which is what makes those cookies first-party.
 * That's still the default and what prod uses.
 *
 * A build can instead call the backend directly, cross-origin, by setting
 * VITE_CROSS_ORIGIN_API=true — this is for the Azure DevOps dev pipeline
 * (dev-stonesuite-webui.pages.dev -> dev-stonesuite-api.fly.dev). It only
 * works because that backend deployment runs with COOKIE_SAME_SITE_MODE=none
 * and APP_ENV=production (so cookies carry Secure), which activates the CSRF
 * double-submit check in middleware/csrf.go — src/api/client.ts already
 * echoes the csrf_token cookie back as X-CSRF-Token unconditionally, so no
 * frontend change is needed to use it. Do not set this for prod: prod's
 * backend still runs SameSite=Lax with no CSRF token issued, and cross-origin
 * cookies would silently fail to persist there.
 */
export function assertSameOriginApiBase(apiBaseUrl: string | undefined, crossOriginOptIn: boolean): void {
  const isAbsolute = !!apiBaseUrl && ABSOLUTE_URL_PATTERN.test(apiBaseUrl)

  if (crossOriginOptIn) {
    if (apiBaseUrl && ABSOLUTE_HTTPS_URL_PATTERN.test(apiBaseUrl)) return

    throw new Error(
      `${CROSS_ORIGIN_API_VAR}=true requires ${API_BASE_URL_VAR} to be a well-formed ` +
        `absolute https:// URL (e.g. "https://dev-stonesuite-api.fly.dev/api"); got ` +
        `${apiBaseUrl ? `"${apiBaseUrl}"` : '(unset)'}.`,
    )
  }

  if (!isAbsolute) return

  throw new Error(
    `${API_BASE_URL_VAR} is set to "${apiBaseUrl}", but a build must use a same-origin ` +
      `relative path (e.g. "/api").\n\n` +
      `An absolute URL makes the API cross-origin, so the browser scopes the backend's ` +
      `csrf_token cookie to the backend host. The app cannot read it, X-CSRF-Token is ` +
      `never sent, and the backend rejects every POST/PUT/PATCH/DELETE with 403 ` +
      `"missing or invalid CSRF token".\n\n` +
      `Set ${API_BASE_URL_VAR}=/api and set API_ORIGIN on the Cloudflare Pages project ` +
      `so functions/api/[[path]].ts proxies to the backend (see DEPLOY_FRONTEND.md).\n` +
      `To target a different backend while developing, use ` +
      `VITE_DEV_API_ORIGIN=<origin> npm run dev instead.\n\n` +
      `If this build is meant to call the backend cross-origin on purpose (e.g. the ` +
      `Azure dev pipeline), set ${CROSS_ORIGIN_API_VAR}=true — this requires the target ` +
      `backend to run with COOKIE_SAME_SITE_MODE=none and APP_ENV=production ` +
      `(stonesuite-backend/middleware/csrf.go and config/config.go).`,
  )
}

/**
 * A build must know stonesuite-notify's own origin.
 *
 * notifyClient falls back to `baseURL: undefined` when VITE_NOTIFY_BASE_URL is
 * missing (src/api/notifyClient.ts), which makes axios issue *relative* URLs.
 * Every notificationService call then requests /api/notifications/* against the
 * app's own host instead of the notify service — on a Pages deploy that means
 * functions/api/[[path]].ts proxies it to the main backend, which has no such
 * routes, so the bell silently 404s. Vite inlines VITE_* at build time, so
 * setting this on the Pages project or an App Service after the fact does
 * nothing: it has to be in the environment of the `npm run build` step itself
 * (in Azure DevOps a *secret* pipeline variable is not auto-exported — it needs
 * an explicit env: mapping on the task).
 *
 * https:// is required because the service is always a separate origin;
 * http:// is allowed only for loopback so a local `npm run ci` still builds
 * against the dev notify service in .env.example.
 */
export function assertNotifyBaseUrl(notifyBaseUrl: string | undefined): void {
  const value = notifyBaseUrl?.trim()
  const parsed = value ? parseUrl(value) : undefined

  if (parsed) {
    const isLoopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(parsed.hostname)
    if (parsed.protocol === 'https:' || isLoopbackHttp) return
  }

  throw new Error(
    `${NOTIFY_BASE_URL_VAR} must be the absolute origin of stonesuite-notify ` +
      `(e.g. "https://dev-stonesuite-notify.fly.dev"); got ` +
      `${value ? `"${value}"` : '(unset)'}.\n\n` +
      `Vite inlines VITE_* at build time. Left unset, src/api/notifyClient.ts falls back to a ` +
      `relative base URL, so every /api/notifications/* call hits this app's own origin instead ` +
      `of the notify service — on a Pages deploy functions/api/[[path]].ts then proxies it to ` +
      `the main backend, which has no notification routes, and the bell fails silently.\n\n` +
      `Set it in the environment of the build step itself, not on the hosting project ` +
      `(a Cloudflare Pages variable or an App Service app setting is read too late to be ` +
      `inlined). On Azure DevOps a secret pipeline variable is not auto-exported to the task ` +
      `environment — map it explicitly with env: on the npm build task. See DEPLOY_FRONTEND.md.`,
  )
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // loadEnv (unlike Vite's automatic import.meta.env exposure) is the only
  // thing that reads .env files into a value this config file can act on —
  // process.env itself is never populated from .env, only from real shell
  // env vars. Needed for both branches below: the build guard and the dev
  // proxy target.
  const fileEnv = loadEnv(mode, process.cwd(), '')

  // Guard builds only. `npm run dev` proxies /api itself (see server.proxy
  // below), so pointing a dev session straight at a backend stays available.
  if (command === 'build') {
    // Real environment variables (how CI/Pages inject config) take precedence
    // over .env files, matching Vite's own resolution order.
    const apiBaseUrl = process.env[API_BASE_URL_VAR] ?? fileEnv[API_BASE_URL_VAR]
    const crossOriginOptIn = (process.env[CROSS_ORIGIN_API_VAR] ?? fileEnv[CROSS_ORIGIN_API_VAR]) === 'true'
    assertSameOriginApiBase(apiBaseUrl, crossOriginOptIn)

    // Same resolution order: real env vars (how CI injects config) beat .env files.
    assertNotifyBaseUrl(process.env[NOTIFY_BASE_URL_VAR] ?? fileEnv[NOTIFY_BASE_URL_VAR])
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0', // bind to all interfaces so Docker can expose the port
      // Falls back to 5173 for local/Docker use; honors PORT so tooling that
      // assigns an alternate port (e.g. when 5173 is already taken) still works.
      port: Number(process.env.PORT) || 5173,
      // Mirrors the Cloudflare Pages Function at functions/api/[[path]].ts so the
      // API is same-origin in dev too. Without it the auth_token cookie is
      // cross-site, the browser drops it, and every refresh logs you out.
      proxy: {
        '/api': {
          // Shell env var wins over .env, matching the build branch's
          // resolution order above.
          target: process.env.VITE_DEV_API_ORIGIN || fileEnv.VITE_DEV_API_ORIGIN || 'https://stonesuite-backend.fly.dev',
          changeOrigin: true,
        },
      },
    },
  }
})
