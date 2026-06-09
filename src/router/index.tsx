import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import OnboardingPage from '@/pages/customer/OnboardingPage';
import AddCustomerPage from '@/pages/customer/AddCustomerPage';
import OnboardingApplyPage from '@/pages/onboarding/OnboardingApplyPage';
import SetPasswordPage from '@/pages/onboarding/SetPasswordPage';
import AcceptInvitePage from '@/pages/onboarding/AcceptInvitePage';
import ProspectListPage from '@/pages/prospect/ProspectListPage';
import AddProspectPage from '@/pages/prospect/AddProspectPage';
import ProspectViewPage from '@/pages/prospect/ProspectViewPage';
import LeadPage from '@/pages/crm/LeadPage';
import AddLeadPage from '@/pages/crm/AddLeadPage';
import ConfigHomePage from '@/pages/config/ConfigHomePage';
import ConfigWorkflowsPage from '@/pages/config/WorkflowsPage';
import WorkflowBuilderPage from '@/pages/config/WorkflowBuilderPage';
import RolesPage from '@/pages/config/RolesPage';
import CreateRolePage from '@/pages/config/CreateRolePage';
import UsersPage from '@/pages/config/UsersPage';

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
  // Public workspace invite acceptance route.
  {
    path: '/accept-invite',
    element: <AcceptInvitePage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Prospects: NetSuite-style create / list / view.
      { path: 'prospects', element: <ProspectListPage /> },
      { path: 'prospects/new', element: <AddProspectPage /> },
      { path: 'prospects/:id', element: <ProspectViewPage /> },

      // CRM: Leads
      { path: 'crm/lead', element: <LeadPage /> },
      { path: 'crm/lead/new', element: <AddLeadPage /> },

      // Configuration hub: build/configure workflows + roles.
      { path: 'config', element: <ConfigHomePage /> },
      { path: 'config/workflows', element: <ConfigWorkflowsPage /> },
      { path: 'config/workflows/:id', element: <WorkflowBuilderPage /> },
      { path: 'config/roles', element: <RolesPage /> },
      { path: 'config/roles/new', element: <CreateRolePage /> },
      { path: 'config/users', element: <UsersPage /> },

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
