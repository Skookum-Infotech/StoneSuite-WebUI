import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

// Routes under /auth that stay reachable while signed in. A reset-password link
// arrives by email and must still work for a user who already has a session.
// The SSO callback also needs this: it calls setAuth() itself, then navigates
// to return_to (or /dashboard) on its own terms -- without this, this layout's
// redirect below would race that navigation and always win with /dashboard,
// silently dropping return_to.
const ALLOWED_WHILE_AUTHENTICATED = ['/auth/reset-password', '/auth/sso/callback'];

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPortal = useAuthStore((s) => s.kind === 'portal');
  const { pathname } = useLocation();

  // A signed-in user must never see the sign-in form. Without this guard, walking
  // back through history re-rendered LoginPage on top of a live session, which
  // looked like the session had been lost.
  //
  // A customer-portal session lands on its own home (sales orders), never on
  // /dashboard — that route renders staff-only widgets a customer session has
  // no permissions to load.
  if (isAuthenticated && !ALLOWED_WHILE_AUTHENTICATED.includes(pathname)) {
    return <Navigate to={isPortal ? '/sales/sales_order' : '/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
