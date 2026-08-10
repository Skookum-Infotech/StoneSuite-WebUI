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
 * It must be set in BOTH the Production and Preview variable sets — Pages keeps
 * them separate, and which one applies depends on whether the deploy's branch
 * matches the project's production branch.
 */

interface Env {
  API_ORIGIN?: string;
}

// Hop-by-hop headers must not be forwarded to the origin.
const STRIPPED_REQUEST_HEADERS = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'];

/** Names the upstream this response was proxied to. Present on every response
 *  the function produces, so its absence in DevTools means the function is not
 *  running at all and Pages is serving the SPA's index.html for /api/* — the
 *  failure that surfaces as a 405 on POST and `text/html` on GET. */
const UPSTREAM_HEADER = 'X-Proxied-To';

/** Config errors are returned in the backend's error shape so the frontend's
 *  existing error handling renders them like any other API failure. */
function configError(message: string): Response {
  return new Response(JSON.stringify({ success: false, message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const incoming = new URL(request.url);

  // Deliberately no default origin. A missing API_ORIGIN used to fall back to
  // the production backend, which meant a misconfigured DEV or preview deploy
  // silently read and wrote production data instead of failing. Fail loudly.
  const apiOrigin = env.API_ORIGIN?.trim();
  if (!apiOrigin) {
    return configError('API_ORIGIN is not configured for this Pages environment.');
  }

  // Preserve the full path (/api/...) and query string.
  let target: URL;
  try {
    target = new URL(incoming.pathname + incoming.search, apiOrigin);
  } catch {
    return configError(`API_ORIGIN is not a valid URL: ${apiOrigin}`);
  }

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
  // Headers are copied because the fetch response's own Headers are immutable.
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set(UPSTREAM_HEADER, apiOrigin);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
