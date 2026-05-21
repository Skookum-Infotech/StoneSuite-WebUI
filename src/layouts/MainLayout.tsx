import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export default function MainLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar / Navbar can go here */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
