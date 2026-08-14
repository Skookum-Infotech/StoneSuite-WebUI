import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Matches any absolute URL ("https://host/api", "//host/api"), i.e. anything
// that is not a same-origin relative path.
const ABSOLUTE_URL_PATTERN = /^([a-z][a-z0-9+.-]*:)?\/\//i

const API_BASE_URL_VAR = 'VITE_API_BASE_URL'

/**
 * A deployed build must call the API through a same-origin relative path.
 *
 * The backend issues its auth cookies (auth_token, refresh_token, csrf_token)
 * host-only. Point this at an absolute backend URL and the browser scopes
 * csrf_token to the backend's host, where document.cookie cannot read it — so
 * src/api/client.ts never attaches X-CSRF-Token and every mutating request is
 * rejected with "Request rejected: missing or invalid CSRF token." The
 * refresh_token round-trip breaks the same way.
 *
 * Keeping this relative routes traffic through the Cloudflare Pages Function
 * (functions/api/[[path]].ts), which is what makes those cookies first-party.
 * This previously failed only at runtime, in the deployed environment, as an
 * opaque 403 — failing the build names the cause instead.
 */
function assertSameOriginApiBase(apiBaseUrl: string | undefined): void {
  if (!apiBaseUrl || !ABSOLUTE_URL_PATTERN.test(apiBaseUrl)) return

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
      `VITE_DEV_API_ORIGIN=<origin> npm run dev instead.`,
  )
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Guard builds only. `npm run dev` proxies /api itself (see server.proxy
  // below), so pointing a dev session straight at a backend stays available.
  if (command === 'build') {
    const fileEnv = loadEnv(mode, process.cwd(), '')
    // Real environment variables (how CI/Pages inject config) take precedence
    // over .env files, matching Vite's own resolution order.
    assertSameOriginApiBase(process.env[API_BASE_URL_VAR] ?? fileEnv[API_BASE_URL_VAR])
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
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
          target: process.env.VITE_DEV_API_ORIGIN || 'https://stonesuite-backend.fly.dev',
          changeOrigin: true,
        },
      },
    },
  }
})
