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
const SsoCallbackPage = lazyWithRetry(() => import("@/pages/auth/SsoCallbackPage"));
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
const PortalUsersPage = lazyWithRetry(
  () => import("@/pages/config/portal-users/PortalUsersPage"),
);
const DashboardWidgetsPage = lazyWithRetry(
  () => import("@/pages/config/dashboard-widgets/DashboardWidgetsPage"),
);
const AuditLogPage = lazyWithRetry(
  () => import("@/pages/config/audit/AuditLogPage"),
);
const FeedbackListPage = lazyWithRetry(
  () => import("@/pages/platform/feedback/FeedbackListPage"),
);
const FeedbackDetailPage = lazyWithRetry(
  () => import("@/pages/platform/feedback/FeedbackDetailPage"),
);
const SamlSetupPage = lazyWithRetry(
  () => import("@/pages/config/saml-setup/SamlSetupPage"),
);
const CognitoSamlSetupPage = lazyWithRetry(
  () => import("@/pages/config/saml-setup/CognitoSamlSetupPage"),
);
const EntraSamlSetupPage = lazyWithRetry(
  () => import("@/pages/config/saml-setup/EntraSamlSetupPage"),
);
const CustomSamlSetupPage = lazyWithRetry(
  () => import("@/pages/config/saml-setup/CustomSamlSetupPage"),
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
const RequisitionListPage = lazyWithRetry(
  () => import("@/pages/purchases/requisition/RequisitionListPage"),
);
const AddRequisitionPage = lazyWithRetry(
  () => import("@/pages/purchases/requisition/AddRequisitionPage"),
);
const RequisitionDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/requisition/RequisitionDetailPage"),
);
const EditRequisitionPage = lazyWithRetry(
  () => import("@/pages/purchases/requisition/EditRequisitionPage"),
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
const VendorBillListPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-bill/VendorBillListPage"),
);
const AddVendorBillPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-bill/AddVendorBillPage"),
);
const VendorBillDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-bill/VendorBillDetailPage"),
);
const EditVendorBillPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-bill/EditVendorBillPage"),
);
const VendorPaymentListPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-payment/VendorPaymentListPage"),
);
const AddVendorPaymentPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-payment/AddVendorPaymentPage"),
);
const VendorPaymentDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-payment/VendorPaymentDetailPage"),
);
const EditVendorPaymentPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-payment/EditVendorPaymentPage"),
);
const VendorCreditListPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-credit/VendorCreditListPage"),
);
const AddVendorCreditPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-credit/AddVendorCreditPage"),
);
const VendorCreditDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-credit/VendorCreditDetailPage"),
);
const EditVendorCreditPage = lazyWithRetry(
  () => import("@/pages/purchases/vendor-credit/EditVendorCreditPage"),
);
const ExpenseListPage = lazyWithRetry(
  () => import("@/pages/purchases/expense/ExpenseListPage"),
);
const AddExpensePage = lazyWithRetry(
  () => import("@/pages/purchases/expense/AddExpensePage"),
);
const ExpenseDetailPage = lazyWithRetry(
  () => import("@/pages/purchases/expense/ExpenseDetailPage"),
);
const EditExpensePage = lazyWithRetry(
  () => import("@/pages/purchases/expense/EditExpensePage"),
);
// Inventory module
const ItemListPage = lazyWithRetry(() => import("@/pages/inventory/item/ItemListPage"));
const AddItemPage = lazyWithRetry(() => import("@/pages/inventory/item/AddItemPage"));
const EditItemPage = lazyWithRetry(() => import("@/pages/inventory/item/EditItemPage"));
const ItemDetailPage = lazyWithRetry(() => import("@/pages/inventory/item/ItemDetailPage"));
const UnitListPage = lazyWithRetry(() => import("@/pages/inventory/unit/UnitListPage"));
const AddUnitPage = lazyWithRetry(() => import("@/pages/inventory/unit/AddUnitPage"));
const UnitDetailPage = lazyWithRetry(() => import("@/pages/inventory/unit/UnitDetailPage"));
const BinListPage = lazyWithRetry(() => import("@/pages/inventory/bin/BinListPage"));
const WarehouseListPage = lazyWithRetry(() => import("@/pages/inventory/warehouse/WarehouseListPage"));
const BundleListPage = lazyWithRetry(() => import("@/pages/inventory/bundle/BundleListPage"));
const BundleDetailPage = lazyWithRetry(() => import("@/pages/inventory/bundle/BundleDetailPage"));
const AdjustmentListPage = lazyWithRetry(() => import("@/pages/inventory/adjustment/AdjustmentListPage"));
const AddAdjustmentPage = lazyWithRetry(() => import("@/pages/inventory/adjustment/AddAdjustmentPage"));
const EditAdjustmentPage = lazyWithRetry(() => import("@/pages/inventory/adjustment/EditAdjustmentPage"));
const AdjustmentDetailPage = lazyWithRetry(() => import("@/pages/inventory/adjustment/AdjustmentDetailPage"));
const TransferListPage = lazyWithRetry(() => import("@/pages/inventory/transfer/TransferListPage"));
const AddTransferPage = lazyWithRetry(() => import("@/pages/inventory/transfer/AddTransferPage"));
const EditTransferPage = lazyWithRetry(() => import("@/pages/inventory/transfer/EditTransferPage"));
const TransferDetailPage = lazyWithRetry(() => import("@/pages/inventory/transfer/TransferDetailPage"));
const CountListPage = lazyWithRetry(() => import("@/pages/inventory/count/CountListPage"));
const AddCountPage = lazyWithRetry(() => import("@/pages/inventory/count/AddCountPage"));
const CountDetailPage = lazyWithRetry(() => import("@/pages/inventory/count/CountDetailPage"));
const InventorySetupPage = lazyWithRetry(() => import("@/pages/config/inventory-setup/InventorySetupPage"));

const JournalEntryListPage = lazyWithRetry(
  () => import("@/pages/finance/journal-entries/JournalEntryListPage"),
);
const AddJournalEntryPage = lazyWithRetry(
  () => import("@/pages/finance/journal-entries/AddJournalEntryPage"),
);
const JournalEntryDetailPage = lazyWithRetry(
  () => import("@/pages/finance/journal-entries/JournalEntryDetailPage"),
);
const EditJournalEntryPage = lazyWithRetry(
  () => import("@/pages/finance/journal-entries/EditJournalEntryPage"),
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
const AccountingPeriodsPage = lazyWithRetry(
  () => import("@/pages/finance/accounting-periods/AccountingPeriodsPage"),
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
          <PermissionGuard resource="prospect" action="read" workflowKey="prospect">
            <ProspectListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/new",
        element: lazy_(
          <PermissionGuard resource="prospect" action="create" workflowKey="prospect">
            <AddProspectPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/:id",
        element: lazy_(
          <PermissionGuard resource="prospect" action="read" workflowKey="prospect">
            <ProspectViewPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/prospect/:id/edit",
        element: lazy_(
          <PermissionGuard resource="prospect" action="update" workflowKey="prospect">
            <EditProspectPage />
          </PermissionGuard>,
        ),
      },

      // CRM: Leads
      {
        path: "crm/lead",
        element: lazy_(
          <PermissionGuard resource="lead" action="read" workflowKey="lead">
            <LeadPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/lead/new",
        element: lazy_(
          <PermissionGuard resource="lead" action="create" workflowKey="lead">
            <AddLeadPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/lead/:id",
        element: lazy_(
          <PermissionGuard resource="lead" action="read" workflowKey="lead">
            <LeadDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/lead/:id/edit",
        element: lazy_(
          <PermissionGuard resource="lead" action="update" workflowKey="lead">
            <EditLeadPage />
          </PermissionGuard>,
        ),
      },

      // CRM: Customers (tenant-side, not platform onboarding)
      {
        path: "crm/customer",
        element: lazy_(
          <PermissionGuard resource="customer" action="read" workflowKey="customer">
            <CustomerListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/new",
        element: lazy_(
          <PermissionGuard resource="customer" action="create" workflowKey="customer">
            <AddCRMCustomerPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/:id",
        element: lazy_(
          <PermissionGuard resource="customer" action="read" workflowKey="customer">
            <CustomerDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "crm/customer/:id/edit",
        element: lazy_(
          <PermissionGuard resource="customer" action="update" workflowKey="customer">
            <EditCustomerPage />
          </PermissionGuard>,
        ),
      },

      // Estimates (specific routes must come before the catch-all)
      {
        path: "sales/estimate",
        element: lazy_(
          <PermissionGuard resource="estimate" action="read" workflowKey="estimate">
            <EstimateListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/new",
        element: lazy_(
          <PermissionGuard resource="estimate" action="create" workflowKey="estimate">
            <AddEstimatePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/:id",
        element: lazy_(
          <PermissionGuard resource="estimate" action="read" workflowKey="estimate">
            <EstimateDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/estimate/:id/edit",
        element: lazy_(
          <PermissionGuard resource="estimate" action="update" workflowKey="estimate">
            <EditEstimatePage />
          </PermissionGuard>,
        ),
      },

      // Quotes (specific routes must come before the catch-all)
      {
        path: "sales/quote",
        element: lazy_(
          <PermissionGuard resource="quote" action="read" workflowKey="quote">
            <QuoteListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/new",
        element: lazy_(
          <PermissionGuard resource="quote" action="create" workflowKey="quote">
            <AddQuotePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id",
        element: lazy_(
          <PermissionGuard resource="quote" action="read" workflowKey="quote">
            <QuoteDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id/edit",
        element: lazy_(
          <PermissionGuard resource="quote" action="update" workflowKey="quote">
            <EditQuotePage />
          </PermissionGuard>,
        ),
      },

      // Sales Orders (specific routes must come before the catch-all)
      {
        path: "sales/sales_order",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="read" workflowKey="sales_order">
            <SalesOrderListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/new",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="create" workflowKey="sales_order">
            <AddSalesOrderPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/:id",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="read" workflowKey="sales_order">
            <SalesOrderDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/sales_order/:id/edit",
        element: lazy_(
          <PermissionGuard resource="sales_order" action="update" workflowKey="sales_order">
            <EditSalesOrderPage />
          </PermissionGuard>,
        ),
      },

      // Installation / Fabrication (specific routes must come before the catch-all)
      {
        path: "sales/installation",
        element: lazy_(
          <PermissionGuard resource="installation" action="read" workflowKey="installation">
            <FabricationJobListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/new",
        element: lazy_(
          <PermissionGuard resource="installation" action="create" workflowKey="installation">
            <AddFabricationJobPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/:id",
        element: lazy_(
          <PermissionGuard resource="installation" action="read" workflowKey="installation">
            <FabricationJobDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/installation/:id/edit",
        element: lazy_(
          <PermissionGuard resource="installation" action="update" workflowKey="installation">
            <EditFabricationJobPage />
          </PermissionGuard>,
        ),
      },

      // Invoices (specific routes must come before the catch-all)
      {
        path: "sales/invoice",
        element: lazy_(
          <PermissionGuard resource="invoice" action="read" workflowKey="invoice">
            <InvoiceListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/new",
        element: lazy_(
          <PermissionGuard resource="invoice" action="create" workflowKey="invoice">
            <AddInvoicePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/:id",
        element: lazy_(
          <PermissionGuard resource="invoice" action="read" workflowKey="invoice">
            <InvoiceDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/invoice/:id/edit",
        element: lazy_(
          <PermissionGuard resource="invoice" action="update" workflowKey="invoice">
            <EditInvoicePage />
          </PermissionGuard>,
        ),
      },

      // Payments (specific routes must come before the catch-all)
      {
        path: "sales/payment",
        element: lazy_(
          <PermissionGuard resource="payment" action="read" workflowKey="payment">
            <PaymentListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/new",
        element: lazy_(
          <PermissionGuard resource="payment" action="create" workflowKey="payment">
            <AddPaymentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id",
        element: lazy_(
          <PermissionGuard resource="payment" action="read" workflowKey="payment">
            <PaymentDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id/edit",
        element: lazy_(
          <PermissionGuard resource="payment" action="update" workflowKey="payment">
            <EditPaymentPage />
          </PermissionGuard>,
        ),
      },

      // Credit Memos (specific routes must come before the catch-all)
      {
        path: "sales/credit_memo",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="read" workflowKey="credit_memo">
            <CreditMemoListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/new",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="create" workflowKey="credit_memo">
            <AddCreditMemoPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/:id",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="read" workflowKey="credit_memo">
            <CreditMemoDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/credit_memo/:id/edit",
        element: lazy_(
          <PermissionGuard resource="credit_memo" action="update" workflowKey="credit_memo">
            <EditCreditMemoPage />
          </PermissionGuard>,
        ),
      },

      // Refunds (specific routes must come before the catch-all)
      {
        path: "sales/refund",
        element: lazy_(
          <PermissionGuard resource="refund" action="read" workflowKey="refund">
            <RefundListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/new",
        element: lazy_(
          <PermissionGuard resource="refund" action="create" workflowKey="refund">
            <AddRefundPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/:id",
        element: lazy_(
          <PermissionGuard resource="refund" action="read" workflowKey="refund">
            <RefundDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/refund/:id/edit",
        element: lazy_(
          <PermissionGuard resource="refund" action="update" workflowKey="refund">
            <EditRefundPage />
          </PermissionGuard>,
        ),
      },

      // Vendors (specific routes must come before the purchases catch-all)
      {
        path: "purchases/vendor",
        element: lazy_(
          <PermissionGuard resource="vendor" action="read" workflowKey="vendor">
            <VendorListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/new",
        element: lazy_(
          <PermissionGuard resource="vendor" action="create" workflowKey="vendor">
            <AddVendorPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/:id",
        element: lazy_(
          <PermissionGuard resource="vendor" action="read" workflowKey="vendor">
            <VendorDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor/:id/edit",
        element: lazy_(
          <PermissionGuard resource="vendor" action="update" workflowKey="vendor">
            <EditVendorPage />
          </PermissionGuard>,
        ),
      },

      // Requisitions (specific routes must come before the catch-all)
      {
        path: "purchases/requisition",
        element: lazy_(
          <PermissionGuard resource="requisition" action="read" workflowKey="requisition">
            <RequisitionListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/requisition/new",
        element: lazy_(
          <PermissionGuard resource="requisition" action="create" workflowKey="requisition">
            <AddRequisitionPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/requisition/:id",
        element: lazy_(
          <PermissionGuard resource="requisition" action="read" workflowKey="requisition">
            <RequisitionDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/requisition/:id/edit",
        element: lazy_(
          <PermissionGuard resource="requisition" action="update" workflowKey="requisition">
            <EditRequisitionPage />
          </PermissionGuard>,
        ),
      },

      // Purchase Orders (specific routes must come before the catch-all)
      {
        path: "purchases/purchase_order",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="read" workflowKey="purchase_order">
            <PurchaseOrderListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/new",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="create" workflowKey="purchase_order">
            <AddPurchaseOrderPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/:id",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="read" workflowKey="purchase_order">
            <PurchaseOrderDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/purchase_order/:id/edit",
        element: lazy_(
          <PermissionGuard resource="purchase_order" action="update" workflowKey="purchase_order">
            <EditPurchaseOrderPage />
          </PermissionGuard>,
        ),
      },

      // Item Receipts (specific routes must come before the catch-all)
      {
        path: "purchases/item_receipt",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="read" workflowKey="item_receipt">
            <ItemReceiptListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/new",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="create" workflowKey="item_receipt">
            <ReceiveItemsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/:id",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="read" workflowKey="item_receipt">
            <ItemReceiptDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/item_receipt/:id/edit",
        element: lazy_(
          <PermissionGuard resource="item_receipt" action="update" workflowKey="item_receipt">
            <EditItemReceiptPage />
          </PermissionGuard>,
        ),
      },

      // Vendor Bills (specific routes must come before the catch-all)
      {
        path: "purchases/vendor_bill",
        element: lazy_(
          <PermissionGuard resource="vendor_bill" action="read" workflowKey="vendor_bill">
            <VendorBillListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_bill/new",
        element: lazy_(
          <PermissionGuard resource="vendor_bill" action="create" workflowKey="vendor_bill">
            <AddVendorBillPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_bill/:id",
        element: lazy_(
          <PermissionGuard resource="vendor_bill" action="read" workflowKey="vendor_bill">
            <VendorBillDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_bill/:id/edit",
        element: lazy_(
          <PermissionGuard resource="vendor_bill" action="update" workflowKey="vendor_bill">
            <EditVendorBillPage />
          </PermissionGuard>,
        ),
      },

      // Vendor Payments (specific routes must come before the catch-all)
      {
        path: "purchases/vendor_payment",
        element: lazy_(
          <PermissionGuard resource="vendor_payment" action="read" workflowKey="vendor_payment">
            <VendorPaymentListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_payment/new",
        element: lazy_(
          <PermissionGuard resource="vendor_payment" action="create" workflowKey="vendor_payment">
            <AddVendorPaymentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_payment/:id",
        element: lazy_(
          <PermissionGuard resource="vendor_payment" action="read" workflowKey="vendor_payment">
            <VendorPaymentDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_payment/:id/edit",
        element: lazy_(
          <PermissionGuard resource="vendor_payment" action="update" workflowKey="vendor_payment">
            <EditVendorPaymentPage />
          </PermissionGuard>,
        ),
      },

      // Vendor Credits (specific routes must come before the catch-all)
      {
        path: "purchases/vendor_credit",
        element: lazy_(
          <PermissionGuard resource="vendor_credit" action="read" workflowKey="vendor_credit">
            <VendorCreditListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_credit/new",
        element: lazy_(
          <PermissionGuard resource="vendor_credit" action="create" workflowKey="vendor_credit">
            <AddVendorCreditPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_credit/:id",
        element: lazy_(
          <PermissionGuard resource="vendor_credit" action="read" workflowKey="vendor_credit">
            <VendorCreditDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/vendor_credit/:id/edit",
        element: lazy_(
          <PermissionGuard resource="vendor_credit" action="update" workflowKey="vendor_credit">
            <EditVendorCreditPage />
          </PermissionGuard>,
        ),
      },

      // Expenses (specific routes must come before the catch-all)
      {
        path: "purchases/expense",
        element: lazy_(
          <PermissionGuard resource="expense" action="read" workflowKey="expense">
            <ExpenseListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/expense/new",
        element: lazy_(
          <PermissionGuard resource="expense" action="create" workflowKey="expense">
            <AddExpensePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/expense/:id",
        element: lazy_(
          <PermissionGuard resource="expense" action="read" workflowKey="expense">
            <ExpenseDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "purchases/expense/:id/edit",
        element: lazy_(
          <PermissionGuard resource="expense" action="update" workflowKey="expense">
            <EditExpensePage />
          </PermissionGuard>,
        ),
      },

      // Finance: Journal Entries (specific routes must come before any future catch-all)
      {
        path: "finance/journal-entries",
        element: lazy_(
          <PermissionGuard resource="cash_transfer" action="read">
            <JournalEntryListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "finance/journal-entries/new",
        element: lazy_(
          <PermissionGuard resource="cash_transfer" action="create">
            <AddJournalEntryPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "finance/journal-entries/:id",
        element: lazy_(
          <PermissionGuard resource="cash_transfer" action="read">
            <JournalEntryDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "finance/journal-entries/:id/edit",
        element: lazy_(
          <PermissionGuard resource="cash_transfer" action="update">
            <EditJournalEntryPage />
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

      // Finance: Accounting Periods
      {
        path: "finance/accounting-periods",
        element: lazy_(
          <PermissionGuard resource="accounting_period" action="read">
            <AccountingPeriodsPage />
          </PermissionGuard>,
        ),
      },

      // Inventory module
      {
        path: "inventory/item",
        element: lazy_(
          <PermissionGuard resource="inventory_item" action="read">
            <ItemListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/item/new",
        element: lazy_(
          <PermissionGuard resource="inventory_item" action="create">
            <AddItemPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/item/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_item" action="read">
            <ItemDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/item/:id/edit",
        element: lazy_(
          <PermissionGuard resource="inventory_item" action="update">
            <EditItemPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/unit",
        element: lazy_(
          <PermissionGuard resource="inventory_unit" action="read">
            <UnitListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/unit/new",
        element: lazy_(
          <PermissionGuard resource="inventory_unit" action="create">
            <AddUnitPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/unit/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_unit" action="read">
            <UnitDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/bin",
        element: lazy_(
          <PermissionGuard resource="inventory_bin" action="read">
            <BinListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/warehouse",
        element: lazy_(
          <PermissionGuard resource="warehouse" action="read">
            <WarehouseListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/bundle",
        element: lazy_(
          <PermissionGuard resource="inventory_bundle" action="read">
            <BundleListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/bundle/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_bundle" action="read">
            <BundleDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/adjustment",
        element: lazy_(
          <PermissionGuard resource="inventory_adjustment" action="read">
            <AdjustmentListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/adjustment/new",
        element: lazy_(
          <PermissionGuard resource="inventory_adjustment" action="create">
            <AddAdjustmentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/adjustment/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_adjustment" action="read">
            <AdjustmentDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/adjustment/:id/edit",
        element: lazy_(
          <PermissionGuard resource="inventory_adjustment" action="update">
            <EditAdjustmentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/transfer",
        element: lazy_(
          <PermissionGuard resource="inventory_transfer" action="read">
            <TransferListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/transfer/new",
        element: lazy_(
          <PermissionGuard resource="inventory_transfer" action="create">
            <AddTransferPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/transfer/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_transfer" action="read">
            <TransferDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/transfer/:id/edit",
        element: lazy_(
          <PermissionGuard resource="inventory_transfer" action="update">
            <EditTransferPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/count",
        element: lazy_(
          <PermissionGuard resource="inventory_count" action="read">
            <CountListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/count/new",
        element: lazy_(
          <PermissionGuard resource="inventory_count" action="create">
            <AddCountPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "inventory/count/:id",
        element: lazy_(
          <PermissionGuard resource="inventory_count" action="read">
            <CountDetailPage />
          </PermissionGuard>,
        ),
      },

      // Sales, Purchases & Inventory modules (placeholder pages — full functionality coming soon)
      {
        path: "sales/:moduleKey",
        element: lazy_(<WorkflowPlaceholderPage />),
      },
      {
        path: "purchases/:moduleKey",
        element: lazy_(<WorkflowPlaceholderPage />),
      },
      {
        path: "inventory/:moduleKey",
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
        path: "config/portal-users",
        element: lazy_(
          <PermissionGuard resource="portal_access" action="read">
            <PortalUsersPage />
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
        path: "config/dashboard-widgets",
        element: lazy_(
          <PermissionGuard resource="dashboard_widget" action="configure">
            <DashboardWidgetsPage />
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
        path: "config/inventory-setup",
        element: lazy_(
          <PermissionGuard resource="inventory_lookup" action="read">
            <InventorySetupPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/saml-setup",
        element: lazy_(
          <PermissionGuard resource="sso_config" action="read">
            <SamlSetupPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/saml-setup/cognito",
        element: lazy_(
          <PermissionGuard resource="sso_config" action="read">
            <CognitoSamlSetupPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/saml-setup/entra",
        element: lazy_(
          <PermissionGuard resource="sso_config" action="read">
            <EntraSamlSetupPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "config/saml-setup/:provider",
        element: lazy_(
          <PermissionGuard resource="sso_config" action="read">
            <CustomSamlSetupPage />
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

      // Platform-owner only: cross-tenant support ticket queue.
      {
        path: "platform/feedback",
        element: lazy_(
          <PermissionGuard platformAdminOnly>
            <FeedbackListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "platform/feedback/:id",
        element: lazy_(
          <PermissionGuard platformAdminOnly>
            <FeedbackDetailPage />
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
      { path: "sso/callback", element: lazy_(<SsoCallbackPage />) },
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
