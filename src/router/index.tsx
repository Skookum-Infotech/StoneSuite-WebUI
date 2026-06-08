/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const OnboardingPage = lazy(() => import('@/pages/customer/OnboardingPage'));
const AddCustomerPage = lazy(() => import('@/pages/customer/AddCustomerPage'));
const OnboardingApplyPage = lazy(() => import('@/pages/onboarding/OnboardingApplyPage'));
const SetPasswordPage = lazy(() => import('@/pages/onboarding/SetPasswordPage'));
const ProspectListPage = lazy(() => import('@/pages/prospect/ProspectListPage'));
const AddProspectPage = lazy(() => import('@/pages/prospect/AddProspectPage'));
const ProspectViewPage = lazy(() => import('@/pages/prospect/ProspectViewPage'));
const LeadPage = lazy(() => import('@/pages/crm/LeadPage'));
const AddLeadPage = lazy(() => import('@/pages/crm/AddLeadPage'));
const ConfigHomePage = lazy(() => import('@/pages/config/ConfigHomePage'));
const ConfigWorkflowsPage = lazy(() => import('@/pages/config/WorkflowsPage'));
const WorkflowBuilderPage = lazy(() => import('@/pages/config/WorkflowBuilderPage'));
const RolesPage = lazy(() => import('@/pages/config/RolesPage'));
const CreateRolePage = lazy(() => import('@/pages/config/CreateRolePage'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const lazy_ = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  // Public onboarding routes: self-service application + password setup.
  {
    path: '/onboarding/apply',
    element: lazy_(<OnboardingApplyPage />),
  },
  {
    path: '/onboarding/set-password',
    element: lazy_(<SetPasswordPage />),
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: lazy_(<DashboardPage />) },

      // Prospects: NetSuite-style create / list / view.
      { path: 'prospects', element: lazy_(<ProspectListPage />) },
      { path: 'prospects/new', element: lazy_(<AddProspectPage />) },
      { path: 'prospects/:id', element: lazy_(<ProspectViewPage />) },

      // CRM: Leads
      { path: 'crm/lead', element: lazy_(<LeadPage />) },
      { path: 'crm/lead/new', element: lazy_(<AddLeadPage />) },

      // Configuration hub: build/configure workflows + roles.
      { path: 'config', element: lazy_(<ConfigHomePage />) },
      { path: 'config/workflows', element: lazy_(<ConfigWorkflowsPage />) },
      { path: 'config/workflows/:id', element: lazy_(<WorkflowBuilderPage />) },
      { path: 'config/roles', element: lazy_(<RolesPage />) },
      { path: 'config/roles/new', element: lazy_(<CreateRolePage />) },

      // Platform-owner only: customer onboarding (provisions tenants).
      { path: 'customer/onboarding', element: lazy_(<OnboardingPage />) },
      { path: 'customer/onboarding/new', element: lazy_(<AddCustomerPage />) },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [{ path: 'login', element: lazy_(<LoginPage />) }],
  },
  {
    path: '*',
    element: <div className="p-8"><h1>404 - Not Found</h1></div>,
  },
]);
