import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

// Routes under /auth that stay reachable while signed in. A reset-password link
// arrives by email and must still work for a user who already has a session.
const ALLOWED_WHILE_AUTHENTICATED = ['/auth/reset-password'];

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { pathname } = useLocation();

  // A signed-in user must never see the sign-in form. Without this guard, walking
  // back through history re-rendered LoginPage on top of a live session, which
  // looked like the session had been lost.
  if (isAuthenticated && !ALLOWED_WHILE_AUTHENTICATED.includes(pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
