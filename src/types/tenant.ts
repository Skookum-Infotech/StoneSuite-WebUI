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
}

export interface WorkflowNumberingConfig {
  workflowId: string;
  enabled: boolean;
  prefix: string;
  suffix: string;
  minDigits: number;
  nextNumber: number;
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
