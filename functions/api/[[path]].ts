/**
 * Same-origin proxy for the backend API.
 *
 * Why this exists: the browser refuses to store the backend's `auth_token`
 * cookie when the API is a different *site*. The cookie is issued
 * `SameSite=Lax`, and a Lax cookie returned from a cross-site response is
 * dropped — so `stonesuite.app` calling `fly.dev` directly means no session
 * cookie is ever stored, the JWT lives only in page memory, and any refresh or
 * deep link logs the user out.
 *
 * Routing /api/* through this function makes the API same-origin with the app,
 * so the Lax cookie is stored and sent as intended — and Lax keeps its CSRF
 * protection, which the backend has no other defense for. Relaxing the cookie
 * to SameSite=None would have fixed the refresh bug by removing that defense.
 *
 * Requires API_ORIGIN to be set in the Pages project (see DEPLOY_FRONTEND.md).
 */

interface Env {
  API_ORIGIN?: string;
}

const DEFAULT_API_ORIGIN = 'https://stonesuite-backend.fly.dev';

// Hop-by-hop headers must not be forwarded to the origin.
const STRIPPED_REQUEST_HEADERS = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'];

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const incoming = new URL(request.url);
  const apiOrigin = env.API_ORIGIN || DEFAULT_API_ORIGIN;

  // Preserve the full path (/api/...) and query string.
  const target = new URL(incoming.pathname + incoming.search, apiOrigin);

  const headers = new Headers(request.headers);
  for (const h of STRIPPED_REQUEST_HEADERS) headers.delete(h);

  const response = await fetch(
    new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }),
  );

  // Response is returned verbatim: Set-Cookie now arrives from this origin, so
  // the browser stores it. CORS headers from the backend are harmless here —
  // the browser no longer treats these as cross-origin requests at all.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
