import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/auth/LoginPage';

// You can create this placeholder later, for now we will just use a div
const DashboardPlaceholder = () => <div className="p-8"><h1>Dashboard</h1><p>Welcome to the dashboard!</p></div>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      // You can add register page here later
      // { path: 'register', element: <RegisterPage /> }
    ],
  },
  {
    path: '/dashboard',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <DashboardPlaceholder />,
      },
    ],
  },
  {
    path: '*',
    element: <div className="p-8"><h1>404 - Not Found</h1></div>,
  },
]);
