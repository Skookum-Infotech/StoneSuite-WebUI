// sessionStorage keys used to carry the SAML provider across the login
// redirect chain. The ACS redirect (POST /api/auth/saml/exchange) and its
// response both carry only `code`, never `provider` -- LoginPage stashes it
// before redirecting to /initiate, SsoCallbackPage promotes it once the
// session is live, and MainLayout's logout reads it back to decide whether
// to call the SAML logout endpoint.
export const SAML_PENDING_PROVIDER_KEY = 'saml_pending_provider';
export const SAML_ACTIVE_PROVIDER_KEY = 'saml_active_provider';
