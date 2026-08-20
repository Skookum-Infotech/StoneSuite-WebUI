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

// Two-level scope model. The `team` scope was retired backend-side; a legacy
// grant that still carries it is normalized to `own` in the service layer —
// see lib/scope.ts.
export type Scope = 'all' | 'own';

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

// Minimal {key, enabled} shape from GET /tenant/workflows/enabled — unlike
// Workflow above, this endpoint is callable by any authenticated tenant
// member regardless of RBAC grants, so it deliberately carries nothing more
// sensitive than the enabled flag itself.
export interface WorkflowStatus {
  key: string;
  enabled: boolean;
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

// One gate in a module's approval chain (e.g. "Pending Approval" for most
// modules, "Templating" and "QC Pending" for Fabrication Job) plus its
// currently configured approvers. See workflowService.getApprovalChain.
export interface ApprovalGate {
  statusCode: string;
  statusLabel: string;
  approverEmployeeIds: string[];
}

// An employee eligible to be picked as an approver, returned alongside the
// gates by workflowService.getApprovalChain -- gated by workflow_config:read,
// the same permission that already governs this whole page (not the
// separate user:read permission that /tenant/crm/lookups' employees field
// requires).
export interface ApprovalChainEmployee {
  id: string;
  name: string;
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
// A config is one of two protocols. client_secret (oidc) and the IdP
// certificate (saml) are write-only and never appear on the read model —
// saml exposes only a certificateFingerprint. SAML login is fully wired
// (see samlAuthService); OIDC remains configuration-only, no login flow.

export type SSOProtocol = 'oidc' | 'saml';
export type SSOProvider = 'entra' | 'cognito' | 'okta';
// entra/cognito get a first-class setup page with a vendor-specific
// walkthrough; any other lowercase slug (2-30 chars, letters/digits/hyphens,
// starting with a letter) is also accepted — see isValidSAMLProvider in the
// backend's controllers/sso.go — and gets the generic CustomSamlSetupPage.
// The `string & {}` branding keeps 'entra'/'cognito' autocompleting while
// still allowing an arbitrary slug (unlike a bare `string`, which would
// erase the two known literals from autocomplete).
export type SAMLProvider = 'entra' | 'cognito' | (string & {});

interface SSOConfigBase {
  id: string;
  tenantId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OIDCConfig extends SSOConfigBase {
  protocol: 'oidc';
  provider: SSOProvider;
  clientId: string;
  issuer: string;
  redirectUri: string;
}

export interface SAMLConfig extends SSOConfigBase {
  protocol: 'saml';
  provider: SAMLProvider;
  metadataUrl: string;
  idpEntityId: string;
  ssoUrl: string;
  sloUrl: string;
  certificateFingerprint: string;
  nameIdFormat: string;
  metadataFetchedAt: string | null;
  // Role auto-granted to a user JIT-provisioned via this config's SAML flow.
  // '' means none — the user is created with no role, same as before this
  // existed.
  defaultRoleId: string;
}

export type SSOConfig = OIDCConfig | SAMLConfig;

export type SSOConfigCreatePayload =
  | {
      protocol: 'oidc';
      provider: SSOProvider;
      clientId: string;
      clientSecret: string;
      issuer?: string;
      redirectUri?: string;
      enabled: boolean;
    }
  | {
      protocol: 'saml';
      provider: SAMLProvider;
      metadataUrl: string;
      enabled: boolean;
      defaultRoleId?: string;
    };

// An email domain registered against a SAML config for home-realm discovery
// on the login page (a user types their work email instead of a workspace
// slug — see samlAuthService.discover).
export interface SSODomain {
  id: string;
  ssoConfigId: string;
  domain: string;
  createdAt: string;
}

// Full-replace on PUT: provider (and metadataUrl for saml) are re-sent every
// time. oidc's clientSecret omitted (or empty) keeps the stored value — the
// server never returns it, so there is nothing to prefill and no way to tell
// client-side whether it's set. saml has no client secret to preserve, but
// metadata_url is always re-fetched server-side on every update regardless.
export type SSOConfigUpdatePayload =
  | {
      protocol: 'oidc';
      provider: SSOProvider;
      clientId: string;
      clientSecret?: string;
      issuer?: string;
      redirectUri?: string;
      enabled: boolean;
    }
  | {
      protocol: 'saml';
      provider: SAMLProvider;
      metadataUrl: string;
      enabled: boolean;
      defaultRoleId?: string;
    };

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
