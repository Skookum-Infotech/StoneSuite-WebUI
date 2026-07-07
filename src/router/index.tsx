/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import MainLayout from "@/layouts/MainLayout";

// Wraps lazy() so that a ChunkLoadError (stale CDN chunk after a new deploy)
// triggers a one-time hard reload instead of showing a crash screen.
function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const reloadKey = "chunk_reload_attempted";
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
        // Return a never-resolving promise — reload takes over.
        return new Promise<never>(() => {});
      }
      return Promise.reject(err);
    }),
  );
}

import { PermissionGuard } from "@/components/PermissionGuard";

const LoginPage = lazyWithRetry(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazyWithRetry(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazyWithRetry(() => import("@/pages/auth/ResetPasswordPage"));
const DashboardPage = lazyWithRetry(() => import("@/pages/dashboard/DashboardPage"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/customer/OnboardingPage"));
const AddCustomerPage = lazyWithRetry(() => import("@/pages/customer/AddCustomerPage"));
const OnboardingApplyPage = lazyWithRetry(
  () => import("@/pages/onboarding/OnboardingApplyPage"),
);
const SetPasswordPage = lazyWithRetry(
  () => import("@/pages/onboarding/SetPasswordPage"),
);
const AcceptInvitePage = lazyWithRetry(
  () => import("@/pages/onboarding/AcceptInvitePage"),
);
const ProspectListPage = lazyWithRetry(
  () => import("@/pages/crm/prospect/ProspectListPage"),
);
const AddProspectPage = lazyWithRetry(
  () => import("@/pages/crm/prospect/AddProspectPage"),
);
const ProspectViewPage = lazyWithRetry(
  () => import("@/pages/crm/prospect/ProspectViewPage"),
);
const EditProspectPage = lazyWithRetry(
  () => import("@/pages/crm/prospect/EditProspectPage"),
);
const LeadPage = lazyWithRetry(() => import("@/pages/crm/lead/LeadPage"));
const AddLeadPage = lazyWithRetry(() => import("@/pages/crm/lead/AddLeadPage"));
const EditLeadPage = lazyWithRetry(() => import("@/pages/crm/lead/EditLeadPage"));
const LeadDetailPage = lazyWithRetry(() => import("@/pages/crm/lead/LeadDetailPage"));
const CustomerListPage = lazyWithRetry(
  () => import("@/pages/crm/customer/CustomerListPage"),
);
const AddCRMCustomerPage = lazyWithRetry(
  () => import("@/pages/crm/customer/AddCustomerPage"),
);
const CustomerDetailPage = lazyWithRetry(
  () => import("@/pages/crm/customer/CustomerDetailPage"),
);
const EditCustomerPage = lazyWithRetry(
  () => import("@/pages/crm/customer/EditCustomerPage"),
);
const ConfigHomePage = lazyWithRetry(() => import("@/pages/config/ConfigHomePage"));
const ConfigWorkflowsPage = lazyWithRetry(() => import("@/pages/config/workflows/WorkflowsPage"));
const WorkflowBuilderPage = lazyWithRetry(
  () => import("@/pages/config/workflows/WorkflowBuilderPage"),
);
const RolesPage = lazyWithRetry(() => import("@/pages/config/roles-access/RolesPage"));
const CreateRolePage = lazyWithRetry(() => import("@/pages/config/roles-access/CreateRolePage"));
const EditRolePage = lazyWithRetry(() => import("@/pages/config/roles-access/EditRolePage"));
const UsersPage = lazyWithRetry(() => import("@/pages/config/users/UsersPage"));
const RecordNumberingPage = lazyWithRetry(
  () => import("@/pages/config/record-numbering/RecordNumberingPage"),
);
const WorkflowPlaceholderPage = lazyWithRetry(
  () => import("@/pages/common/WorkflowPlaceholderPage"),
);
const AccountSettingsPage = lazyWithRetry(
  () => import("@/pages/account/AccountSettingsPage"),
);
const TransactionsPage = lazyWithRetry(
  () => import("@/pages/transactions/TransactionsPage"),
);
const SalesOrderListPage = lazyWithRetry(
  () => import("@/pages/sales/SalesOrderListPage"),
);
const AddSalesOrderPage = lazyWithRetry(() => import("@/pages/sales/AddSalesOrderPage"));
const InvoiceListPage = lazyWithRetry(
  () => import("@/pages/sales/InvoiceListPage"),
);
const AddInvoicePage = lazyWithRetry(() => import("@/pages/sales/AddInvoicePage"));
const PaymentListPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentListPage"),
);
const AddPaymentPage = lazyWithRetry(() => import("@/pages/sales/AddPaymentPage"));

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
      { path: "account/settings", element: lazy_(<AccountSettingsPage />) },
      { path: "transactions", element: lazy_(<TransactionsPage />) },

      // CRM: Prospects
      {
        path: "crm/prospect",
        element: lazy_(
          <PermissionGuard resource="prospect" action="read">
            <ProspectListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/new",
        element: lazy_(
          <PermissionGuard resource="prospect" action="create">
            <AddProspectPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/:id",
        element: lazy_(
          <PermissionGuard resource="prospect" action="read">
            <ProspectViewPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/:id/edit",
        element: lazy_(
          <PermissionGuard resource="prospect" action="update">
            <EditProspectPage />
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
      {
        path: "crm/lead/:id",
        element: lazy_(
          <PermissionGuard resource="lead" action="read">
            <LeadDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/lead/:id/edit",
        element: lazy_(
          <PermissionGuard resource="lead" action="update">
            <EditLeadPage />
          </PermissionGuard>,
        ),
      },

      // CRM: Customers (tenant-side, not platform onboarding)
      {
        path: "crm/customer",
        element: lazy_(
          <PermissionGuard resource="customer" action="read">
            <CustomerListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/new",
        element: lazy_(
          <PermissionGuard resource="customer" action="create">
            <AddCRMCustomerPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/:id",
        element: lazy_(
          <PermissionGuard resource="customer" action="read">
            <CustomerDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/:id/edit",
        element: lazy_(
          <PermissionGuard resource="customer" action="update">
            <EditCustomerPage />
          </PermissionGuard>,
        ),
      },

      // Sales Orders (specific routes must come before the catch-all)
      {
        path: "sales/sales_order",
        element: lazy_(<SalesOrderListPage />),
      },
      {
        path: "sales/sales_order/new",
        element: lazy_(<AddSalesOrderPage />),
      },

      // Invoices (specific routes must come before the catch-all)
      {
        path: "sales/invoice",
        element: lazy_(<InvoiceListPage />),
      },
      {
        path: "sales/invoice/new",
        element: lazy_(<AddInvoicePage />),
      },

      // Payments (specific routes must come before the catch-all)
      {
        path: "sales/payment",
        element: lazy_(<PaymentListPage />),
      },
      {
        path: "sales/payment/new",
        element: lazy_(<AddPaymentPage />),
      },

      // Sales & Purchases modules (placeholder pages — full functionality coming soon)
      {
        path: "sales/:moduleKey",
        element: lazy_(<WorkflowPlaceholderPage />),
      },
      {
        path: "purchases/:moduleKey",
        element: lazy_(<WorkflowPlaceholderPage />),
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
      {
        path: "config/record-numbering",
        element: lazy_(
          <PermissionGuard resource="workflow_config" action="configure">
            <RecordNumberingPage />
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
