import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import OnboardingPage from '@/pages/customer/OnboardingPage';
import AddCustomerPage from '@/pages/customer/AddCustomerPage';
import OnboardingApplyPage from '@/pages/onboarding/OnboardingApplyPage';
import SetPasswordPage from '@/pages/onboarding/SetPasswordPage';
import WorkflowRecordsPage from '@/pages/workspace/WorkflowRecordsPage';
import ProspectListPage from '@/pages/prospect/ProspectListPage';
import AddProspectPage from '@/pages/prospect/AddProspectPage';
import ProspectViewPage from '@/pages/prospect/ProspectViewPage';
import ConfigHomePage from '@/pages/config/ConfigHomePage';
import ConfigWorkflowsPage from '@/pages/config/WorkflowsPage';
import WorkflowBuilderPage from '@/pages/config/WorkflowBuilderPage';
import RolesPage from '@/pages/config/RolesPage';

export const router = createBrowserRouter([
  // Public onboarding routes: self-service application + password setup.
  {
    path: '/onboarding/apply',
    element: <OnboardingApplyPage />,
  },
  {
    path: '/onboarding/set-password',
    element: <SetPasswordPage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Workspace: daily use of an enabled workflow (dynamic sidebar links here).
      { path: 'workflows/:id', element: <WorkflowRecordsPage /> },

      // Prospects: NetSuite-style create / list / view.
      { path: 'prospects', element: <ProspectListPage /> },
      { path: 'prospects/new', element: <AddProspectPage /> },
      { path: 'prospects/:id', element: <ProspectViewPage /> },

      // Configuration hub: build/configure workflows + roles.
      { path: 'config', element: <ConfigHomePage /> },
      { path: 'config/workflows', element: <ConfigWorkflowsPage /> },
      { path: 'config/workflows/:id', element: <WorkflowBuilderPage /> },
      { path: 'config/roles', element: <RolesPage /> },

      // Platform-owner only: customer onboarding (provisions tenants).
      { path: 'customer/onboarding', element: <OnboardingPage /> },
      { path: 'customer/onboarding/new', element: <AddCustomerPage /> },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [{ path: 'login', element: <LoginPage /> }],
  },
  {
    path: '*',
    element: <div className="p-8"><h1>404 - Not Found</h1></div>,
  },
]);
