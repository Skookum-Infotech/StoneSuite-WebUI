import { tenantClient } from '@/api/tenantClient';
import type {
  Tenant,
  CreateTenantResult,
  InviteDetails,
  CatalogResponse,
  Role,
  Grant,
  Workflow,
  WorkflowDefinition,
  WorkflowRecord,
  Scope,
} from '@/types/tenant';

// ----- Onboarding (public invite acceptance) --------------------------------

export const onboardingService = {
  getInvite: (token: string) =>
    tenantClient.get<InviteDetails>(`/onboarding/tenant-invite/${token}`).then((r) => r.data),
  accept: (token: string, fullName: string, password: string) =>
    tenantClient
      .post('/onboarding/tenant-accept', { token, fullName, password })
      .then((r) => r.data),
};

// ----- Platform admin (Phase 1) ---------------------------------------------

/** Rich customer-onboarding form. Only companyName + superAdminEmail are
 *  strictly required; the backend derives slug/displayName/contactEmail and
 *  stores the rest as tenant metadata, then provisions + invites. */
export interface OnboardCustomerPayload {
  companyName: string;
  legalName?: string;
  industry?: string;
  website?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  taxId?: string;
  billingAddress?: string;
  shippingAddress?: string;
  returnAddress?: string;
  superAdminName?: string;
  superAdminEmail: string;
  superAdminPhone?: string;
  superAdminJobTitle?: string;
  financeName?: string;
  financeEmail?: string;
  financePhone?: string;
}

export const platformService = {
  listTenants: () =>
    tenantClient
      .get<{ success: boolean; tenants: Tenant[] }>('/platform/tenants')
      .then((r) => r.data.tenants ?? []),
  createTenant: (payload: OnboardCustomerPayload) =>
    tenantClient.post<CreateTenantResult>('/platform/tenants', payload).then((r) => r.data),
  lifecycle: (tenantId: string, action: 'suspend' | 'restore' | 'delete') =>
    tenantClient.post(`/platform/tenants/${tenantId}/${action}`).then((r) => r.data),
};

// ----- RBAC (Phase 2) --------------------------------------------------------

export const rbacService = {
  catalog: () => tenantClient.get<CatalogResponse>('/tenant/permissions/catalog').then((r) => r.data),
  listRoles: () =>
    tenantClient.get<{ success: boolean; roles: Role[] }>('/tenant/roles').then((r) => r.data.roles),
  createRole: (key: string, name: string, description: string, permissions: Grant[]) =>
    tenantClient
      .post('/tenant/roles', { key, name, description, permissions })
      .then((r) => r.data),
  deleteRole: (id: string) => tenantClient.delete(`/tenant/roles/${id}`).then((r) => r.data),
};

// ----- Workflow engine (Phase 3) --------------------------------------------

/**
 * Go marshals empty slices as `null`, so array-typed fields can arrive as null.
 * Normalize a definition so the UI can rely on arrays always being arrays.
 */
function normalizeDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    workflow: def.workflow,
    states: def.states ?? [],
    transitions: (def.transitions ?? []).map((t) => ({
      ...t,
      guard: { requiredFields: t.guard?.requiredFields ?? [] },
    })),
    fields: (def.fields ?? []).map((f) => ({
      ...f,
      options: f.options ?? [],
      validation: f.validation ?? {},
    })),
  };
}

export const workflowService = {
  list: () =>
    tenantClient
      .get<{ success: boolean; workflows: Workflow[] }>('/tenant/workflows')
      .then((r) => r.data.workflows ?? []),
  get: (id: string) =>
    tenantClient
      .get<{ success: boolean; definition: WorkflowDefinition }>(`/tenant/workflows/${id}`)
      .then((r) => normalizeDefinition(r.data.definition)),
  setEnabled: (id: string, enabled: boolean) =>
    tenantClient.post(`/tenant/workflows/${id}/enabled`, { enabled }).then((r) => r.data),
  createField: (
    workflowId: string,
    field: {
      key: string;
      label: string;
      dataType: string;
      required: boolean;
      options: string[];
    },
  ) => tenantClient.post(`/tenant/workflows/${workflowId}/fields`, field).then((r) => r.data),
  deleteField: (workflowId: string, fieldId: string) =>
    tenantClient.delete(`/tenant/workflows/${workflowId}/fields/${fieldId}`).then((r) => r.data),

  listRecords: (workflowId: string) =>
    tenantClient
      .get<{ success: boolean; scope: Scope; records: WorkflowRecord[] }>(
        `/tenant/workflows/${workflowId}/records`,
      )
      .then((r) => r.data),
  createRecord: (
    workflowId: string,
    body: { coreFields: Record<string, unknown>; customFields: Record<string, unknown> },
  ) =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/workflows/${workflowId}/records`,
        body,
      )
      .then((r) => r.data.record),
  updateRecord: (recordId: string, customFields: Record<string, unknown>) =>
    tenantClient.patch(`/tenant/records/${recordId}`, { customFields }).then((r) => r.data),
  transition: (recordId: string, toStateId: string) =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/records/${recordId}/transition`,
        { toStateId },
      )
      .then((r) => r.data.record),
};
