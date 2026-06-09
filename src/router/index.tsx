/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import MainLayout from "@/layouts/MainLayout";
import{ PermissionGuard } from "@/components/PermissionGuard";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const OnboardingPage = lazy(() => import("@/pages/customer/OnboardingPage"));
const AddCustomerPage = lazy(() => import("@/pages/customer/AddCustomerPage"));
const OnboardingApplyPage = lazy(
  () => import("@/pages/onboarding/OnboardingApplyPage"),
);
const SetPasswordPage = lazy(
  () => import("@/pages/onboarding/SetPasswordPage"),
);
const AcceptInvitePage = lazy(
  () => import("@/pages/onboarding/AcceptInvitePage"),
);
const ProspectListPage = lazy(
  () => import("@/pages/prospect/ProspectListPage"),
);
const AddProspectPage = lazy(() => import("@/pages/prospect/AddProspectPage"));
const ProspectViewPage = lazy(
  () => import("@/pages/prospect/ProspectViewPage"),
);
const LeadPage = lazy(() => import("@/pages/crm/LeadPage"));
const AddLeadPage = lazy(() => import("@/pages/crm/AddLeadPage"));
const ConfigHomePage = lazy(() => import("@/pages/config/ConfigHomePage"));
const ConfigWorkflowsPage = lazy(() => import("@/pages/config/WorkflowsPage"));
const WorkflowBuilderPage = lazy(
  () => import("@/pages/config/WorkflowBuilderPage"),
);
const RolesPage = lazy(() => import("@/pages/config/RolesPage"));
const CreateRolePage = lazy(() => import("@/pages/config/CreateRolePage"));
const EditRolePage = lazy(() => import("@/pages/config/EditRolePage"));
const UsersPage = lazy(() => import("@/pages/config/UsersPage"));

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
    path: "/onboarding/apply",
    element: lazy_(<OnboardingApplyPage />),
  },
  {
    path: "/onboarding/set-password",
    element: lazy_(<SetPasswordPage />),
  },
  // Public workspace invite acceptance route.
  {
    path: "/accept-invite",
    element: lazy_(<AcceptInvitePage />),
  },
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { path: "", element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: lazy_(<DashboardPage />) },

      // Prospects
      {
        path: "prospects",
        element: lazy_(
          <PermissionGuard resource="prospect" action="read">
            <ProspectListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "prospects/new",
        element: lazy_(
          <PermissionGuard resource="prospect" action="create">
            <AddProspectPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "prospects/:id",
        element: lazy_(
          <PermissionGuard resource="prospect" action="read">
            <ProspectViewPage />
          </PermissionGuard>,
        ),
      },

      // CRM: Leads
      {
        path: "crm/lead",
        element: lazy_(
          <PermissionGuard resource="lead" action="read">
            <LeadPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/lead/new",
        element: lazy_(
          <PermissionGuard resource="lead" action="create">
            <AddLeadPage />
          </PermissionGuard>,
        ),
      },

      // Configuration hub
      { path: "config", element: lazy_(<ConfigHomePage />) },
      {
        path: "config/workflows",
        element: lazy_(
          <PermissionGuard resource="workflow" action="read">
            <ConfigWorkflowsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/workflows/:id",
        element: lazy_(
          <PermissionGuard resource="workflow" action="read">
            <WorkflowBuilderPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/roles",
        element: lazy_(
          <PermissionGuard resource="role" action="read">
            <RolesPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/roles/new",
        element: lazy_(
          <PermissionGuard resource="role" action="create">
            <CreateRolePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/roles/:id/edit",
        element: lazy_(
          <PermissionGuard resource="role" action="update">
            <EditRolePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/users",
        element: lazy_(
          <PermissionGuard resource="user" action="read">
            <UsersPage />
          </PermissionGuard>,
        ),
      },

      // Platform-owner only: customer onboarding (provisions tenants).
      {
        path: "customer/onboarding",
        element: lazy_(
          <PermissionGuard platformAdminOnly>
            <OnboardingPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "customer/onboarding/new",
        element: lazy_(
          <PermissionGuard platformAdminOnly>
            <AddCustomerPage />
          </PermissionGuard>,
        ),
      },
    ],
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: lazy_(<LoginPage />) },
      { path: "forgot-password", element: lazy_(<ForgotPasswordPage />) },
      { path: "reset-password", element: lazy_(<ResetPasswordPage />) },
    ],
  },
  {
    path: "*",
    element: (
      <div className="p-8">
        <h1>404 - Not Found</h1>
      </div>
    ),
  },
]);
