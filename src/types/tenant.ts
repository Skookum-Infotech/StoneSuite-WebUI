// Shared types for the multi-tenant platform (Phases 1–3).

export interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
}

export interface TenantAuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: TenantUser;
}

// ----- Platform (Phase 1) ----------------------------------------------------

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  migrationStatus: string;
  dbName: string;
  createdAt: string;
  hardDeleteAfter?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateTenantResult {
  success: boolean;
  tenantId: string;
  slug: string;
  inviteLink?: string;
  passwordSetupLink?: string;
  expiresAt?: string;
  emailSent?: boolean;
}

// Returned by GET /onboarding/apply/{token} for the public self-service form.
export interface OnboardingApplyDetails {
  success: boolean;
  valid: boolean;
  status: string;
  contactEmail: string;
  tenantName: string;
  prefill: Record<string, unknown>;
}

// An async_jobs row (e.g. tenant provisioning), used to surface long-running
// task status/progress and let admins retry failed/dead jobs.
export interface AsyncJob {
  id: string;
  jobType: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'dead' | string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  progress?: { step?: string } & Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// An onboarding invite (the token is the shareable "invite key").
export interface TenantInvite {
  id: string;
  contactEmail: string;
  token: string;
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  expired: boolean;
  inviteLink: string;
}

export interface InviteDetails {
  success: boolean;
  valid: boolean;
  status: string;
  contactEmail: string;
  tenantName: string;
}

// ----- RBAC (Phase 2) --------------------------------------------------------

export type Scope = 'all' | 'team' | 'own';

export interface Permission {
  resource: string;
  action: string;
}

export interface Grant {
  resource: string;
  action: string;
  scope: Scope;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Grant[];
}

export interface CatalogResponse {
  success: boolean;
  permissions: Permission[];
  scopes: Scope[];
}

// ----- Workflow engine (Phase 3) --------------------------------------------

export interface Workflow {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  isDefault: boolean;
  pipelineOrder: number;
  // Up to 2 active users (see MAX_APPROVERS) whose sign-off is required before
  // records created under this workflow can be approved. Empty = no approval required.
  approverUserIds: string[];
}

export interface WorkflowState {
  id: string;
  workflowId: string;
  key: string;
  name: string;
  isInitial: boolean;
  isTerminal: boolean;
  sortOrder: number;
  color: string;
}

export interface WorkflowTransition {
  id: string;
  workflowId: string;
  fromStateId: string;
  toStateId: string;
  name: string;
  requiredPermission: string;
  guard: { requiredFields?: string[] };
  sortOrder: number;
}

export type FieldType = 'string' | 'number' | 'date' | 'bool' | 'enum' | 'email';

export interface FieldDefinition {
  id: string;
  workflowId: string;
  key: string;
  label: string;
  dataType: FieldType;
  required: boolean;
  options: string[];
  validation: { regex?: string; min?: number; max?: number };
  sortOrder: number;
}

export interface WorkflowDefinition {
  workflow: Workflow;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  fields: FieldDefinition[];
}

export interface WorkflowRecord {
  id: string;
  workflowId: string;
  currentStateId: string;
  ownerUserId?: string;
  teamId?: string;
  parentRecordId?: string;
  coreFields: Record<string, unknown>;
  customFields: Record<string, unknown>;
  recordNumber?: string;
  createdAt: string;
  updatedAt: string;
  // Server-authoritative: whether the logged-in caller may approve this record
  // right now (accounts for "already approved by you" when 2 approvers are
  // configured). Attached client-side from the sibling `canApprove` field the
  // GET endpoint returns alongside the record — see crmService.getRecord.
  canApprove?: boolean;
}

// The record's actual approval state ('none' | 'pending' | 'approved') lives
// in coreFields.approval_status (snake_case, set by the backend), not as a
// top-level field — read it via this helper rather than record.approvalStatus.
export function recordApprovalState(record: Pick<WorkflowRecord, 'coreFields'>): 'none' | 'pending' | 'approved' {
  const v = record.coreFields.approval_status;
  return v === 'pending' || v === 'approved' ? v : 'none';
}

// ── Record filter / pagination (server-side search engine) ───────────────────

export type FilterOperator =
  | 'eq' | 'neq' | 'contains' | 'startswith' | 'in'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'is_empty' | 'is_null';

export interface FilterClause {
  field: string;        // logical key: "status", "core:customer_name", "cf:budget"
  op: FilterOperator;
  value?: unknown;
}

export interface SortKey {
  field: string;        // "created_at" | "updated_at" | "record_number"
  dir: 'asc' | 'desc';
}

export interface FilterRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
}

export interface RecordPage {
  records: WorkflowRecord[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}

export interface WorkflowNumberingConfig {
  workflowId: string;
  enabled: boolean;
  prefix: string;
  suffix: string;
  minDigits: number;
  nextNumber: number;
}

// ── SSO configuration (Configuration → Authentication) ───────────────────────
// Configuration only — no login flow yet. client_secret is write-only and
// never appears on SSOConfig (the read model).

export type SSOProvider = 'entra' | 'cognito' | 'okta';

export interface SSOConfig {
  id: string;
  tenantId: string;
  provider: SSOProvider;
  clientId: string;
  issuer: string;
  redirectUri: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SSOConfigCreatePayload {
  provider: SSOProvider;
  clientId: string;
  clientSecret: string;
  issuer?: string;
  redirectUri?: string;
  enabled: boolean;
}

// Full-replace on PUT: provider/clientId are re-sent every time. clientSecret
// omitted (or empty) keeps the stored value — the server never returns it, so
// there is nothing to prefill and no way to tell client-side whether it's set.
export interface SSOConfigUpdatePayload {
  provider: SSOProvider;
  clientId: string;
  clientSecret?: string;
  issuer?: string;
  redirectUri?: string;
  enabled: boolean;
}

export interface StatusInfo {
  stateId: string;
  stateKey: string;
  statusLabel: string;
  workflowKey: string;
  workflowName: string;
  isInitial: boolean;
  isTerminal: boolean;
  sortOrder: number;
  color: string;
}

export interface CRMCreatePayload {
  ownerUserId?: string;
  teamId?: string;
  crmStatusId?: string;
  coreFields: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

// ----- User management (Phase 4) --------------------------------------------

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
}

export interface WorkspaceUser {
  id: string;
  identityId: string;
  email: string;
  fullName: string;
  status: 'active' | 'suspended' | 'disabled';
  createdAt: string;
  updatedAt: string;
  roles: RoleSummary[];
}

// Serialized from tenancy.UserInvite (no json tags → Go default PascalCase keys).
export interface UserInvite {
  ID: string;
  TenantID: string;
  Email: string;
  FullName: string;
  InitialRoleID: string;
  Token: string;
  Status: 'pending' | 'accepted' | 'revoked';
  InvitedBy: string;
  ExpiresAt: string;
  AcceptedAt: string | null;
  CreatedAt: string;
}
