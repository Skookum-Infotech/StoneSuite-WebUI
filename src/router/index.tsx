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
const AuditLogPage = lazyWithRetry(
  () => import("@/pages/config/audit/AuditLogPage"),
);
const SsoConfigPage = lazyWithRetry(
  () => import("@/pages/config/authentication/SsoConfigPage"),
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
const SubscriptionPage = lazyWithRetry(
  () => import("@/pages/subscription/SubscriptionPage"),
);
const EstimateListPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateListPage"),
);
const AddEstimatePage = lazyWithRetry(() => import("@/pages/sales/AddEstimatePage"));
const EstimateDetailPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateDetailPage"),
);
const EditEstimatePage = lazyWithRetry(
  () => import("@/pages/sales/EditEstimatePage"),
);
const QuoteListPage = lazyWithRetry(
  () => import("@/pages/sales/QuoteListPage"),
);
const AddQuotePage = lazyWithRetry(() => import("@/pages/sales/AddQuotePage"));
const QuoteDetailPage = lazyWithRetry(
  () => import("@/pages/sales/QuoteDetailPage"),
);
const EditQuotePage = lazyWithRetry(
  () => import("@/pages/sales/EditQuotePage"),
);
const SalesOrderListPage = lazyWithRetry(
  () => import("@/pages/sales/SalesOrderListPage"),
);
const AddSalesOrderPage = lazyWithRetry(() => import("@/pages/sales/AddSalesOrderPage"));
const SalesOrderDetailPage = lazyWithRetry(
  () => import("@/pages/sales/SalesOrderDetailPage"),
);
const EditSalesOrderPage = lazyWithRetry(
  () => import("@/pages/sales/EditSalesOrderPage"),
);
const FabricationJobListPage = lazyWithRetry(
  () => import("@/pages/sales/FabricationJobListPage"),
);
const AddFabricationJobPage = lazyWithRetry(
  () => import("@/pages/sales/AddFabricationJobPage"),
);
const FabricationJobDetailPage = lazyWithRetry(
  () => import("@/pages/sales/FabricationJobDetailPage"),
);
const EditFabricationJobPage = lazyWithRetry(
  () => import("@/pages/sales/EditFabricationJobPage"),
);
const InvoiceListPage = lazyWithRetry(
  () => import("@/pages/sales/InvoiceListPage"),
);
const AddInvoicePage = lazyWithRetry(() => import("@/pages/sales/AddInvoicePage"));
const InvoiceDetailPage = lazyWithRetry(
  () => import("@/pages/sales/InvoiceDetailPage"),
);
const EditInvoicePage = lazyWithRetry(
  () => import("@/pages/sales/EditInvoicePage"),
);
const PaymentListPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentListPage"),
);
const AddPaymentPage = lazyWithRetry(() => import("@/pages/sales/AddPaymentPage"));
const PaymentDetailPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentDetailPage"),
);
const EditPaymentPage = lazyWithRetry(
  () => import("@/pages/sales/EditPaymentPage"),
);
const CreditMemoListPage = lazyWithRetry(
  () => import("@/pages/sales/CreditMemoListPage"),
);
const AddCreditMemoPage = lazyWithRetry(() => import("@/pages/sales/AddCreditMemoPage"));
const CreditMemoDetailPage = lazyWithRetry(
  () => import("@/pages/sales/CreditMemoDetailPage"),
);
const EditCreditMemoPage = lazyWithRetry(
  () => import("@/pages/sales/EditCreditMemoPage"),
);
const RefundListPage = lazyWithRetry(
  () => import("@/pages/sales/RefundListPage"),
);
const AddRefundPage = lazyWithRetry(() => import("@/pages/sales/AddRefundPage"));
const RefundDetailPage = lazyWithRetry(
  () => import("@/pages/sales/RefundDetailPage"),
);
const EditRefundPage = lazyWithRetry(
  () => import("@/pages/sales/EditRefundPage"),
);
const VendorListPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor/VendorListPage"),
);
const AddVendorPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor/AddVendorPage"),
);
const VendorDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor/VendorDetailPage"),
);
const EditVendorPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor/EditVendorPage"),
);
const PurchaseOrderListPage = lazyWithRetry(
  () => import("@/pages/purchases/purchase-order/PurchaseOrderListPage"),
);
const AddPurchaseOrderPage = lazyWithRetry(
  () => import("@/pages/purchases/purchase-order/AddPurchaseOrderPage"),
);
const PurchaseOrderDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/purchase-order/PurchaseOrderDetailPage"),
);
const EditPurchaseOrderPage = lazyWithRetry(
  () => import("@/pages/purchases/purchase-order/EditPurchaseOrderPage"),
);
const ItemReceiptListPage = lazyWithRetry(
  () => import("@/pages/purchases/item-receipt/ItemReceiptListPage"),
);
const ReceiveItemsPage = lazyWithRetry(
  () => import("@/pages/purchases/item-receipt/ReceiveItemsPage"),
);
const ItemReceiptDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/item-receipt/ItemReceiptDetailPage"),
);
const EditItemReceiptPage = lazyWithRetry(
  () => import("@/pages/purchases/item-receipt/EditItemReceiptPage"),
);
const ChartOfAccountsPage = lazyWithRetry(
  () => import("@/pages/finance/chart-of-accounts/ChartOfAccountsPage"),
);
const AccountDetailPage = lazyWithRetry(
  () => import("@/pages/finance/chart-of-accounts/AccountDetailPage"),
);
const AccountDefaultsPage = lazyWithRetry(
  () => import("@/pages/finance/account-defaults/AccountDefaultsPage"),
);

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
      { path: "subscription", element: lazy_(<SubscriptionPage />) },

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

      // Estimates (specific routes must come before the catch-all)
      {
        path: "sales/estimate",
        element: lazy_(
          <PermissionGuard resource="estimate" action="read">
            <EstimateListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/new",
        element: lazy_(
          <PermissionGuard resource="estimate" action="create">
            <AddEstimatePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/:id",
        element: lazy_(
          <PermissionGuard resource="estimate" action="read">
            <EstimateDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/:id/edit",
        element: lazy_(
          <PermissionGuard resource="estimate" action="update">
            <EditEstimatePage />
          </PermissionGuard>,
        ),
      },

      // Quotes (specific routes must come before the catch-all)
      {
        path: "sales/quote",
        element: lazy_(
          <PermissionGuard resource="quote" action="read">
            <QuoteListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/new",
        element: lazy_(
          <PermissionGuard resource="quote" action="create">
            <AddQuotePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id",
        element: lazy_(
          <PermissionGuard resource="quote" action="read">
            <QuoteDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id/edit",
        element: lazy_(
          <PermissionGuard resource="quote" action="update">
            <EditQuotePage />
          </PermissionGuard>,
        ),
      },

      // Sales Orders (specific routes must come before the catch-all)
      {
        path: "sales/sales_order",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="read">
            <SalesOrderListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/new",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="create">
            <AddSalesOrderPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/:id",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="read">
            <SalesOrderDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/:id/edit",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="update">
            <EditSalesOrderPage />
          </PermissionGuard>,
        ),
      },

      // Installation / Fabrication (specific routes must come before the catch-all)
      {
        path: "sales/installation",
        element: lazy_(
          <PermissionGuard resource="installation" action="read">
            <FabricationJobListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/new",
        element: lazy_(
          <PermissionGuard resource="installation" action="create">
            <AddFabricationJobPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/:id",
        element: lazy_(
          <PermissionGuard resource="installation" action="read">
            <FabricationJobDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/:id/edit",
        element: lazy_(
          <PermissionGuard resource="installation" action="update">
            <EditFabricationJobPage />
          </PermissionGuard>,
        ),
      },

      // Invoices (specific routes must come before the catch-all)
      {
        path: "sales/invoice",
        element: lazy_(
          <PermissionGuard resource="invoice" action="read">
            <InvoiceListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/new",
        element: lazy_(
          <PermissionGuard resource="invoice" action="create">
            <AddInvoicePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/:id",
        element: lazy_(
          <PermissionGuard resource="invoice" action="read">
            <InvoiceDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/:id/edit",
        element: lazy_(
          <PermissionGuard resource="invoice" action="update">
            <EditInvoicePage />
          </PermissionGuard>,
        ),
      },

      // Payments (specific routes must come before the catch-all)
      {
        path: "sales/payment",
        element: lazy_(
          <PermissionGuard resource="payment" action="read">
            <PaymentListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/new",
        element: lazy_(
          <PermissionGuard resource="payment" action="create">
            <AddPaymentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id",
        element: lazy_(
          <PermissionGuard resource="payment" action="read">
            <PaymentDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id/edit",
        element: lazy_(
          <PermissionGuard resource="payment" action="update">
            <EditPaymentPage />
          </PermissionGuard>,
        ),
      },

      // Credit Memos (specific routes must come before the catch-all)
      {
        path: "sales/credit_memo",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="read">
            <CreditMemoListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/new",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="create">
            <AddCreditMemoPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/:id",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="read">
            <CreditMemoDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/:id/edit",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="update">
            <EditCreditMemoPage />
          </PermissionGuard>,
        ),
      },

      // Refunds (specific routes must come before the catch-all)
      {
        path: "sales/refund",
        element: lazy_(
          <PermissionGuard resource="refund" action="read">
            <RefundListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/new",
        element: lazy_(
          <PermissionGuard resource="refund" action="create">
            <AddRefundPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/:id",
        element: lazy_(
          <PermissionGuard resource="refund" action="read">
            <RefundDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/:id/edit",
        element: lazy_(
          <PermissionGuard resource="refund" action="update">
            <EditRefundPage />
          </PermissionGuard>,
        ),
      },

      // Vendors (specific routes must come before the purchases catch-all)
      {
        path: "purchases/vendor",
        element: lazy_(
          <PermissionGuard resource="vendor" action="read">
            <VendorListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/new",
        element: lazy_(
          <PermissionGuard resource="vendor" action="create">
            <AddVendorPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/:id",
        element: lazy_(
          <PermissionGuard resource="vendor" action="read">
            <VendorDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/:id/edit",
        element: lazy_(
          <PermissionGuard resource="vendor" action="update">
            <EditVendorPage />
          </PermissionGuard>,
        ),
      },

      // Purchase Orders (specific routes must come before the catch-all)
      {
        path: "purchases/purchase_order",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="read">
            <PurchaseOrderListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/new",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="create">
            <AddPurchaseOrderPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/:id",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="read">
            <PurchaseOrderDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/:id/edit",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="update">
            <EditPurchaseOrderPage />
          </PermissionGuard>,
        ),
      },

      // Item Receipts (specific routes must come before the catch-all)
      {
        path: "purchases/item_receipt",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="read">
            <ItemReceiptListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/new",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="create">
            <ReceiveItemsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/:id",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="read">
            <ItemReceiptDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/:id/edit",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="update">
            <EditItemReceiptPage />
          </PermissionGuard>,
        ),
      },

      // Finance: Chart of Accounts (specific routes must come before any future catch-all)
      {
        path: "finance/chart-of-accounts",
        element: lazy_(
          <PermissionGuard resource="chart_of_account" action="read">
            <ChartOfAccountsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "finance/chart-of-accounts/:id",
        element: lazy_(
          <PermissionGuard resource="chart_of_account" action="read">
            <AccountDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "finance/account-defaults",
        element: lazy_(
          <PermissionGuard resource="chart_of_account" action="configure">
            <AccountDefaultsPage />
          </PermissionGuard>,
        ),
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
      {
        path: "config/audit",
        element: lazy_(
          <PermissionGuard resource="audit" action="read">
            <AuditLogPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/authentication",
        element: lazy_(
          <PermissionGuard resource="sso_config" action="read">
            <SsoConfigPage />
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
