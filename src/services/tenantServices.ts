import { tenantClient } from '@/api/tenantClient';
import { normalizeScope, normalizeScopeList } from '@/lib/scope';
import type {
  Tenant,
  TenantInvite,
  AsyncJob,
  CreateTenantResult,
  CatalogResponse,
  Permission,
  Role,
  Grant,
  Workflow,
  WorkflowStatus,
  WorkflowDefinition,
  WorkflowRecord,
  WorkflowNumberingConfig,
  FieldDefinition,
  OnboardingApplyDetails,
  WorkspaceUser,
  UserInvite,
  ApprovalGate,
  ApprovalChainEmployee,
} from '@/types/tenant';

// Flat onboarding form data keyed by Customer-workflow field keys (snake_case),
// e.g. { company_name, super_admin_email, ...customExtras }.
export type OnboardingFormData = Record<string, unknown>;

// ----- Public onboarding (self-service) -------------------------------------

export const onboardingService = {
  formSchema: () =>
    tenantClient
      .get<{ success: boolean; fields: FieldDefinition[] }>('/onboarding/form-schema')
      .then((r) => r.data.fields ?? []),
  getApply: (token: string) =>
    tenantClient.get<OnboardingApplyDetails>(`/onboarding/apply/${token}`).then((r) => r.data),
  submitApply: (token: string, formData: OnboardingFormData) =>
    tenantClient.post('/onboarding/apply', { token, formData }).then((r) => r.data),
  getSetPassword: (token: string) =>
    tenantClient
      .get<{ success: boolean; valid: boolean; email: string; fullName: string }>(
        `/onboarding/set-password/${token}`,
      )
      .then((r) => r.data),
  setPassword: (token: string, password: string) =>
    tenantClient
      .post<{ success: boolean; email: string }>('/onboarding/set-password', { token, password })
      .then((r) => r.data),
};

// ----- Platform admin (Phase 1) ---------------------------------------------

export const platformService = {
  listTenants: () =>
    tenantClient
      .get<{ success: boolean; tenants: Tenant[] }>('/platform/tenants')
      .then((r) => r.data.tenants ?? []),
  // Owner-filled form → provisions immediately (no approval).
  onboardCustomer: (formData: OnboardingFormData) =>
    tenantClient.post<CreateTenantResult>('/platform/tenants', { formData }).then((r) => r.data),
  // Lightweight invite → customer self-fills the form (approval path).
  inviteCustomer: (payload: {
    companyName: string;
    recipientName?: string;
    contactEmail: string;
  }) => tenantClient.post<CreateTenantResult>('/platform/invites', payload).then((r) => r.data),
  approveTenant: (tenantId: string) =>
    tenantClient
      .post<{ success: boolean; passwordSetupLink?: string }>(`/platform/tenants/${tenantId}/approve`)
      .then((r) => r.data),
  rejectTenant: (tenantId: string) =>
    tenantClient.post(`/platform/tenants/${tenantId}/reject`).then((r) => r.data),
  lifecycle: (tenantId: string, action: 'suspend' | 'restore' | 'delete') =>
    tenantClient.post(`/platform/tenants/${tenantId}/${action}`).then((r) => r.data),

  // Invite management (keys / expiry / retry).
  listInvites: (tenantId: string) =>
    tenantClient
      .get<{ success: boolean; invites: TenantInvite[] }>(`/platform/tenants/${tenantId}/invites`)
      .then((r) => r.data.invites ?? []),
  resendInvite: (tenantId: string, opts: { contactEmail?: string } = {}) =>
    tenantClient
      .post<{ success: boolean; invite: TenantInvite; emailSent: boolean }>(
        `/platform/tenants/${tenantId}/invites`,
        opts,
      )
      .then((r) => r.data),

  // Async job status (e.g. tenant provisioning) + retry for failed/dead jobs.
  listJobs: (tenantId: string) =>
    tenantClient
      .get<{ success: boolean; jobs: AsyncJob[] }>(`/platform/tenants/${tenantId}/jobs`)
      .then((r) => r.data.jobs ?? []),
  retryJob: (tenantId: string, jobId: string) =>
    tenantClient.post(`/platform/tenants/${tenantId}/jobs/${jobId}/retry`).then((r) => r.data),
};

// ----- RBAC (Phase 2) --------------------------------------------------------

// Scope arrives as a bare string: a tenant provisioned before the `team` scope
// was retired can still have `scope = 'team'` rows in role_permissions. This is
// the single choke point that maps those onto the two-level model, so no page
// has to know the legacy value ever existed.
interface GrantWire {
  resource: string;
  action: string;
  scope: string;
}

function toGrant(g: GrantWire): Grant {
  return { resource: g.resource, action: g.action, scope: normalizeScope(g.scope) };
}

type RoleWire = Omit<Role, 'permissions'> & { permissions: GrantWire[] | null };

function toRole(r: RoleWire): Role {
  return { ...r, permissions: (r.permissions ?? []).map(toGrant) };
}

export const rbacService = {
  catalog: (): Promise<CatalogResponse> =>
    tenantClient
      .get<{ success: boolean; permissions: Permission[] | null; scopes: string[] | null }>(
        '/tenant/permissions/catalog',
      )
      .then((r) => ({
        success: r.data.success,
        permissions: r.data.permissions ?? [],
        scopes: normalizeScopeList(r.data.scopes),
      })),
  listRoles: () =>
    tenantClient
      .get<{ success: boolean; roles: RoleWire[] | null }>('/tenant/roles')
      .then((r) => (r.data.roles ?? []).map(toRole)),
  createRole: (key: string, name: string, description: string, permissions: Grant[]) =>
    tenantClient
      .post('/tenant/roles', { key, name, description, permissions })
      .then((r) => r.data),
  updateRole: (id: string, name: string, description: string, permissions: Grant[]) =>
    tenantClient
      .put(`/tenant/roles/${id}`, { name, description, permissions })
      .then((r) => r.data),
  deleteRole: (id: string) => tenantClient.delete(`/tenant/roles/${id}`).then((r) => r.data),
  // activeRoleId is '' when the caller has no active-role restriction (all
  // assigned roles' grants apply, unioned) — the server-side source of truth
  // for which role, if any, the switch-role flow last narrowed to.
  myPermissions: () =>
    tenantClient
      .get<{ success: boolean; grants: GrantWire[] | null; activeRoleId: string }>(
        '/tenant/users/me/permissions',
      )
      .then((r) => ({
        grants: (r.data.grants ?? []).map(toGrant),
        activeRoleId: r.data.activeRoleId ?? '',
      })),
  // Sets (or clears, when roleId is '') which one of the caller's assigned
  // roles is enforced server-side. Returns a freshly-signed token — the
  // caller must persist it, since the old token still carries the previous
  // (or no) active-role claim.
  switchRole: (roleId: string) =>
    tenantClient
      .post<{ success: boolean; token: string; expiresAt: number; activeRoleId: string }>(
        '/tenant/auth/switch-role',
        { roleId },
      )
      .then((r) => r.data),
};

// ----- Workflow engine (Phase 3) --------------------------------------------

/**
 * Go marshals empty slices as `null`, so array-typed fields can arrive as null.
 * Normalize a definition so the UI can rely on arrays always being arrays.
 */
function normalizeDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    workflow: { ...def.workflow, approverUserIds: def.workflow.approverUserIds ?? [] },
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
  // Unlike list() above (gated server-side by workflow:read, a
  // Configuration-only permission), this is callable by any authenticated
  // tenant member — it exists so a user with e.g. only lead:read can still
  // learn whether the "lead" workflow is disabled, for UI-hiding purposes.
  listEnabled: () =>
    tenantClient
      .get<{ success: boolean; workflows: WorkflowStatus[] }>('/tenant/workflows/enabled')
      .then((r) => r.data.workflows ?? []),
  get: (id: string) =>
    tenantClient
      .get<{ success: boolean; definition: WorkflowDefinition }>(`/tenant/workflows/${id}`)
      .then((r) => normalizeDefinition(r.data.definition)),
  setEnabled: (id: string, enabled: boolean) =>
    tenantClient.post(`/tenant/workflows/${id}/enabled`, { enabled }).then((r) => r.data),
  updateApprovers: (id: string, approverUserIds: string[]) =>
    tenantClient
      .patch<{ success: boolean; approverUserIds: string[] }>(`/tenant/workflows/${id}/approvers`, {
        approverUserIds,
      })
      .then((r) => r.data.approverUserIds),
  // Module approval chain (Estimate/Quote/SalesOrder/PurchaseOrder/
  // Requisition/VendorBill/VendorPayment/Expense/Fabrication). One or more
  // named gates per workflow -- see APPROVAL_CHAIN_WORKFLOWS in
  // WorkflowBuilderPage for which workflow keys have one. Read uses
  // workflow_config:read, write uses workflow_config:configure, matching
  // every other workflow config endpoint. The UI caps selection at
  // MAX_APPROVERS (see ApproverPicker); the backend accepts any number.
  // Employees come bundled in the same response, gated by the same
  // workflow_config permission -- not sourced from /tenant/crm/lookups,
  // whose employees field requires a separate user:read grant.
  getApprovalChain: (workflowId: string) =>
    tenantClient
      .get<{ success: boolean; gates: ApprovalGate[]; employees: ApprovalChainEmployee[] }>(
        `/tenant/workflows/${workflowId}/approval-chain`,
      )
      .then((r) => ({ gates: r.data.gates ?? [], employees: r.data.employees ?? [] })),
  setApprovalChain: (workflowId: string, statusCode: string, approverEmployeeIds: string[]) =>
    tenantClient
      .put<{ success: boolean; statusCode: string; approverEmployeeIds: string[] }>(
        `/tenant/workflows/${workflowId}/approval-chain`,
        { statusCode, approverEmployeeIds },
      )
      .then((r) => r.data.approverEmployeeIds ?? []),
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
      .get<{ success: boolean; scope: string; records: WorkflowRecord[] | null }>(
        `/tenant/workflows/${workflowId}/records`,
      )
      .then((r) => ({
        success: r.data.success,
        scope: normalizeScope(r.data.scope),
        records: r.data.records ?? [],
      })),
  getRecord: (recordId: string) =>
    tenantClient
      .get<{ success: boolean; record: WorkflowRecord }>(`/tenant/records/${recordId}`)
      .then((r) => r.data.record),
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

// ----- Record Numbering -----------------------------------------------------

export const numberingService = {
  get: (workflowId: string) =>
    tenantClient
      .get<{ success: boolean; numbering: WorkflowNumberingConfig }>(
        `/tenant/workflows/${workflowId}/numbering`,
      )
      .then((r) => r.data.numbering),
  update: (workflowId: string, data: Omit<WorkflowNumberingConfig, 'workflowId'>) =>
    tenantClient
      .put<{ success: boolean; numbering: WorkflowNumberingConfig }>(
        `/tenant/workflows/${workflowId}/numbering`,
        data,
      )
      .then((r) => r.data),
};

// ----- User management (Phase 4) --------------------------------------------

export const userService = {
  listUsers: () =>
    tenantClient
      .get<{ success: boolean; users: WorkspaceUser[] }>('/tenant/users')
      .then((r) => r.data.users ?? []),

  getUser: (id: string) =>
    tenantClient
      .get<{ success: boolean; user: WorkspaceUser }>(`/tenant/users/${id}`)
      .then((r) => r.data.user),

  inviteUser: (payload: { email: string; fullName?: string; initialRoleId?: string }) =>
    tenantClient
      .post<{ success: boolean; message: string; inviteId: string; inviteLink: string }>(
        '/tenant/users/invite',
        payload,
      )
      .then((r) => r.data),

  updateUser: (id: string, payload: { fullName?: string; status?: 'active' | 'suspended' }) =>
    tenantClient
      .patch<{ success: boolean; user: WorkspaceUser }>(`/tenant/users/${id}`, payload)
      .then((r) => r.data.user),

  deactivateUser: (id: string) =>
    tenantClient
      .delete<{ success: boolean; message: string }>(`/tenant/users/${id}`)
      .then((r) => r.data),

  assignRole: (userId: string, roleId: string) =>
    tenantClient
      .post<{ success: boolean; message: string }>(`/tenant/users/${userId}/roles`, { roleId })
      .then((r) => r.data),

  removeRole: (userId: string, roleId: string) =>
    tenantClient
      .delete<{ success: boolean; message: string }>(`/tenant/users/${userId}/roles/${roleId}`)
      .then((r) => r.data),

  listInvites: () =>
    tenantClient
      .get<{ success: boolean; invites: UserInvite[] }>('/tenant/invites')
      .then((r) => r.data.invites ?? []),

  resendInvite: (id: string) =>
    tenantClient
      .post<{ success: boolean; message: string; inviteLink: string }>(
        `/tenant/invites/${id}/resend`,
      )
      .then((r) => r.data),

  revokeInvite: (id: string) =>
    tenantClient
      .delete<{ success: boolean; message: string }>(`/tenant/invites/${id}`)
      .then((r) => r.data),

  // Public — no auth required.
  getUserInvite: (token: string) =>
    tenantClient
      .get<{
        success: boolean;
        email: string;
        fullName: string;
        workspaceName: string;
        expiresAt: string;
      }>(`/onboarding/user-invite/${token}`)
      .then((r) => r.data),

  acceptUserInvite: (payload: { token: string; password: string; fullName: string }) =>
    tenantClient
      .post<{ success: boolean; message: string; email: string }>(
        '/onboarding/user-invite/accept',
        payload,
      )
      .then((r) => r.data),
};
