import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
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
import { PermissionGuard } from '@/components/PermissionGuard';

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

      // Prospects
      {
        path: 'prospects',
        element: <PermissionGuard resource="prospect" action="read"><ProspectListPage /></PermissionGuard>,
      },
      {
        path: 'prospects/new',
        element: <PermissionGuard resource="prospect" action="create"><AddProspectPage /></PermissionGuard>,
      },
      {
        path: 'prospects/:id',
        element: <PermissionGuard resource="prospect" action="read"><ProspectViewPage /></PermissionGuard>,
      },

      // CRM: Leads
      {
        path: 'crm/lead',
        element: <PermissionGuard resource="lead" action="read"><LeadPage /></PermissionGuard>,
      },
      {
        path: 'crm/lead/new',
        element: <PermissionGuard resource="lead" action="create"><AddLeadPage /></PermissionGuard>,
      },

      // Configuration hub
      { path: 'config', element: <ConfigHomePage /> },
      {
        path: 'config/workflows',
        element: <PermissionGuard resource="workflow" action="read"><ConfigWorkflowsPage /></PermissionGuard>,
      },
      {
        path: 'config/workflows/:id',
        element: <PermissionGuard resource="workflow" action="read"><WorkflowBuilderPage /></PermissionGuard>,
      },
      {
        path: 'config/roles',
        element: <PermissionGuard resource="role" action="read"><RolesPage /></PermissionGuard>,
      },
      {
        path: 'config/roles/new',
        element: <PermissionGuard resource="role" action="create"><CreateRolePage /></PermissionGuard>,
      },
      {
        path: 'config/users',
        element: <PermissionGuard resource="user" action="read"><UsersPage /></PermissionGuard>,
      },

      // Platform-owner only: customer onboarding (provisions tenants).
      {
        path: 'customer/onboarding',
        element: <PermissionGuard platformAdminOnly><OnboardingPage /></PermissionGuard>,
      },
      {
        path: 'customer/onboarding/new',
        element: <PermissionGuard platformAdminOnly><AddCustomerPage /></PermissionGuard>,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '*',
    element: <div className="p-8"><h1>404 - Not Found</h1></div>,
  },
]);
