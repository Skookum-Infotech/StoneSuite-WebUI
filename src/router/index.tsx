import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import OnboardingPage from '@/pages/customer/OnboardingPage';
import AddCustomerPage from '@/pages/customer/AddCustomerPage';
import LeadPage from '@/pages/crm/LeadPage';
import AddLeadPage from '@/pages/crm/AddLeadPage';
import PublicOnboardingPage from '@/pages/onboarding/PublicOnboardingPage';

export const router = createBrowserRouter([
  {
    path: '/onboarding/invite/:token',
    element: <PublicOnboardingPage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'customer/onboarding',
        element: <OnboardingPage />,
      },
      {
        path: 'customer/onboarding/new',
        element: <AddCustomerPage />,
      },
      {
        path: 'crm/lead',
        element: <LeadPage />,
      },
      {
        path: 'crm/lead/new',
        element: <AddLeadPage />,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '*',
    element: <div className="p-8"><h1>404 - Not Found</h1></div>,
  },
]);
