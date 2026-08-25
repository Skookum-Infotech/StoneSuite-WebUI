import { create } from 'zustand';
import type { UserProfile, PortalCustomer, PortalWorkspace } from '@/types/auth';
import { queryClient } from '@/lib/queryClient';

// Token is set as httpOnly cookie by the backend on login.
// Do not store in localStorage — any XSS script can read localStorage.
// The cookie is sent automatically by the browser on every request
// when withCredentials: true is set on the Axios instance.

const USER_KEY = 'auth-user';
const SESSION_EXPIRY_KEY = 'auth-session-expiry';
// Portal-only. Absent means a staff session — mirrors the backend JWT
// convention where staff tokens carry no `kind` claim.
const KIND_KEY = 'auth-kind';
// Portal-only, persisted (unlike a staff session, which never sends a tenant
// id client-side): POST /api/portal/auth/refresh requires the caller to
// resend the active workspace's tenantId, because the access token is
// already expired by the time refresh runs and the server has nothing else
// to recover it from. Omitting it resumes the *first* linked workspace,
// which is wrong for a multi-workspace customer mid-session in a later one.
const ACTIVE_TENANT_KEY = 'auth-active-tenant';
const CUSTOMER_KEY = 'auth-customer';

function loadUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function loadSessionExpiry(): number | null {
  const raw = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  // Discard stale values — if the stored expiry is already past, treat as no expiry.
  return n > Date.now() ? n : null;
}

function loadKind(): 'portal' | null {
  return localStorage.getItem(KIND_KEY) === 'portal' ? 'portal' : null;
}

function loadActiveTenantId(): string | null {
  return localStorage.getItem(ACTIVE_TENANT_KEY);
}

function loadCustomer(): PortalCustomer | null {
  const raw = localStorage.getItem(CUSTOMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalCustomer;
  } catch {
    return null;
  }
}

interface AuthState {
  user: UserProfile | null;
  // Token held in memory only — not persisted to localStorage.
  // Used as a fallback Authorization header in environments that do not
  // support cookies (e.g. React Native). The backend httpOnly cookie is
  // the primary auth mechanism.
  token: string | null;
  // Unix timestamp (ms) when the current access token expires.
  // Drives the session-expiry warning timer in useSessionTimer.
  sessionExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Absent (undefined) for a staff session. 'portal' for a customer-portal
  // session — set only by setPortalAuth, never by setAuth.
  kind?: 'portal';
  // Which customer this portal session represents. Not returned by login —
  // fetched separately via GET /api/portal/me once the session exists — so
  // this starts null even immediately after setPortalAuth.
  customer: PortalCustomer | null;
  workspaces: PortalWorkspace[];
  activeTenantId: string | null;
  setAuth: (user: UserProfile, token: string, expiresAt: number) => void;
  // Establishes a customer-portal session. Separate from setAuth (rather than
  // an overload) so every existing staff call site — SSO callback, role
  // switch, tests — keeps working unchanged.
  setPortalAuth: (params: {
    user: UserProfile;
    token: string;
    expiresAt: number;
    tenantId: string;
    workspaces: PortalWorkspace[];
  }) => void;
  setCustomer: (customer: PortalCustomer) => void;
  setWorkspaces: (workspaces: PortalWorkspace[]) => void;
  // POST /switch-workspace mints a new token scoped to the new tenant, and
  // any cached data from the previous workspace is invalid for a customer
  // session — this always clears the query cache.
  applyWorkspaceSwitch: (tenantId: string, token: string, expiresAt: number) => void;
  setSessionExpiry: (expiresAt: number) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  // Patches the signed-in user's own profile fields (e.g. after editing your
  // own display name elsewhere) without touching token/session state.
  updateProfile: (patch: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Rehydrate non-sensitive display data (name, email, roles) from localStorage.
  // Authentication state is determined by whether the httpOnly cookie is present,
  // but we cannot read httpOnly cookies from JS — we infer it from the persisted user profile.
  user: loadUser(),
  token: null, // never persisted; lives in memory only
  sessionExpiresAt: loadSessionExpiry(),
  isAuthenticated: Boolean(localStorage.getItem(USER_KEY)),
  isLoading: false,
  kind: loadKind() ?? undefined,
  customer: loadCustomer(),
  workspaces: [],
  activeTenantId: loadActiveTenantId(),
  setAuth: (user, token, expiresAt) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    // A staff sign-in always clears any stale portal state from a previous
    // session in this browser — one email cannot be both, but the same
    // browser can have signed out of a customer session and into a staff one.
    localStorage.removeItem(KIND_KEY);
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    set({
      user, token, sessionExpiresAt: expiresAt, isAuthenticated: true,
      kind: undefined, customer: null, workspaces: [], activeTenantId: null,
    });
  },
  setPortalAuth: ({ user, token, expiresAt, tenantId, workspaces }) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    localStorage.setItem(KIND_KEY, 'portal');
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    localStorage.removeItem(CUSTOMER_KEY); // fetched fresh via GET /portal/me
    set({
      user, token, sessionExpiresAt: expiresAt, isAuthenticated: true,
      kind: 'portal', customer: null, workspaces, activeTenantId: tenantId,
    });
  },
  setCustomer: (customer) => {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    set({ customer });
  },
  setWorkspaces: (workspaces) => set({ workspaces }),
  applyWorkspaceSwitch: (tenantId, token, expiresAt) => {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    const workspaces = get().workspaces.map((w) => ({ ...w, active: w.tenantId === tenantId }));
    queryClient.clear();
    set({ activeTenantId: tenantId, token, sessionExpiresAt: expiresAt, workspaces });
  },
  setSessionExpiry: (expiresAt) => {
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    set({ sessionExpiresAt: expiresAt });
  },
  updateProfile: (patch) =>
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user };
    }),
  logout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(KIND_KEY);
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    // Clear the whole cache, not just user-permissions: staff and a customer
    // portal session now share one queryClient (see CLAUDE.md's merged-login
    // design), so anything less would risk one tenant's cached sales-order/
    // invoice/etc. data surviving into the next session signed into this tab.
    queryClient.clear();
    set({
      user: null, token: null, sessionExpiresAt: null, isAuthenticated: false,
      kind: undefined, customer: null, workspaces: [], activeTenantId: null,
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));

// Usable outside React components (interceptors, services) — mirrors the
// existing useAuthStore.getState() calls already in api/client.ts.
export function isPortalSession(): boolean {
  return useAuthStore.getState().kind === 'portal';
}
