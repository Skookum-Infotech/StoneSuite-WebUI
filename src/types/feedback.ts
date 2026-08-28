// In-app feedback tickets — frontend contract types.
//
// Mirrors `StoneSuite-Backend/feedback/feedback.go`. Tickets live in the
// control-plane DB (cross-tenant), served from `/api/tenant/feedback*` and
// `/api/portal/feedback*` (reporter-facing, scoped to the caller's own
// tickets) and `/api/platform/feedback*` (platform-admin, cross-tenant).

export type FeedbackReporterKind = 'staff' | 'portal';

export type FeedbackCommentAuthorKind = 'staff' | 'portal' | 'platform_admin';

export type FeedbackCategory =
  | 'bug'
  | 'feature_request'
  | 'ux_improvement'
  | 'performance'
  | 'general';

// Which section of the app the reporter had open. Named "area", not
// "workspace" — that word already means the tenant a customer-portal
// session is signed into (see PortalWorkspace in types/auth.ts).
export type FeedbackArea =
  | 'dashboard'
  | 'crm'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'finance'
  | 'configuration'
  | 'account'
  | 'other';

export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent';

export type FeedbackCommentEventType = 'comment' | 'status_change';

/** One feedback ticket. `internalNotes` is present only in an admin response —
 *  the backend never selects it for a reporter-facing route. */
export interface FeedbackTicket {
  id: string;
  ticketSeq: number;
  ticketNumber: string;
  tenantId: string;
  tenantName?: string;
  reporterIdentityId?: string;
  reporterKind: FeedbackReporterKind;
  reporterEmail: string;
  reporterName: string;
  category: FeedbackCategory;
  area?: FeedbackArea | '';
  rating?: number | null;
  description: string;
  pageUrl?: string;
  userAgent?: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  assignedAdminIdentityId?: string;
  assignedAdminName?: string;
  internalNotes?: string;
  reporterLastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

/** One entry in a ticket's timeline — a reply, or a status-change marker.
 *  `isInternal` rows only ever appear in an admin response. */
export interface FeedbackComment {
  id: string;
  feedbackId: string;
  authorIdentityId?: string;
  authorKind: FeedbackCommentAuthorKind;
  authorName: string;
  body?: string;
  isInternal: boolean;
  eventType: FeedbackCommentEventType;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

/** One file attached to a ticket. */
export interface FeedbackAttachment {
  id: string;
  feedbackId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256?: string;
  createdAt: string;
}

/** POST /api/{tenant,portal}/feedback body. */
export interface FeedbackSubmitInput {
  category: FeedbackCategory;
  area?: FeedbackArea | '';
  rating?: number | null;
  description: string;
  pageUrl?: string;
}

/** One page of a reporter's own tickets. */
export interface FeedbackTicketPage {
  tickets: FeedbackTicket[];
  nextCursor: string;
}

/** A ticket plus its reporter-visible timeline and attachments —
 *  GET /api/{tenant,portal}/feedback/{id}. */
export interface FeedbackTicketDetail {
  ticket: FeedbackTicket;
  comments: FeedbackComment[];
  attachments: FeedbackAttachment[];
}

/** Filters for the platform-admin ticket list — GET /api/platform/feedback. */
export interface FeedbackAdminFilters {
  status?: FeedbackStatus | '';
  category?: FeedbackCategory | '';
  priority?: FeedbackPriority | '';
  tenantId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

/** PATCH /api/platform/feedback/{id} body — every field optional, undefined
 *  means "leave unchanged". Pass an empty string for assignedAdminIdentityId
 *  to clear the assignment. */
export interface FeedbackAdminPatch {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  assignedAdminIdentityId?: string;
  internalNotes?: string;
}

/** GET /api/platform/feedback/stats — ticket counts by status. */
export interface FeedbackStats {
  new: number;
  inProgress: number;
  done: number;
  cancelled: number;
  total: number;
}

/** Presign request/response shapes, shared with attachmentService's pattern. */
export interface FeedbackPresignFileIn {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface FeedbackPresignFileOut {
  fileName: string;
  storageKey: string;
  uploadUrl: string;
}

export interface FeedbackConfirmAttachmentIn {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string;
}
