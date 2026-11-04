// Mirrors the backend `installschedule` JSON (plan §5.2). Field names are the
// wire names; the backend is authoritative.

export type VisitType = 'template' | 'install' | 'service';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type CrewRole = 'lead' | 'member';

/** Error `code` values carried by install-schedule error bodies (§5.4). */
export type InstallErrorCode =
  | 'invalid_input'
  | 'invalid_time'
  | 'not_found'
  | 'stale_version'
  | 'conflict'
  | 'job_closed'
  | 'invalid_status'
  | 'not_started'
  | 'forbidden'
  | 'internal';

export interface CrewMember {
  employeeId: number;
  name: string;
  role: CrewRole;
}

export interface Appointment {
  id: string;
  fabricationJobId: string;
  jobNumber: string;
  customerName: string;
  siteCity: string;
  visitType: VisitType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  /** Wall-clock `YYYY-MM-DDTHH:mm` in the tenant zone (`YYYY-MM-DD` when allDay). */
  startLocal: string;
  endLocal: string;
  timezone: string;
  allDay: boolean;
  localStartDate: string;
  localEndDate: string;
  crew: CrewMember[];
  notes: string;
  cancelReason: string | null;
  version: number;
}

export interface Conflict {
  type: string;
  severity: string;
  employeeId?: number;
  employeeName?: string;
  appointmentId?: string;
  jobNumber?: string;
  startLocal: string;
  endLocal: string;
}

/** Body of a 409 `conflict` response. */
export interface ConflictResponse {
  success: false;
  message: string;
  code: 'conflict';
  requiresAcknowledgement: true;
  conflicts: Conflict[];
  moreConflicts?: number;
}

/** Body of a 409 `stale_version` response. */
export interface StaleVersionResponse {
  success: false;
  message: string;
  code: 'stale_version';
  currentVersion?: number;
}

export interface CrewInput {
  employeeId: number;
  role: CrewRole;
}

export interface CreateAppointmentInput {
  fabricationJobId: string;
  visitType: VisitType;
  startLocal: string;
  endLocal: string;
  allDay: boolean;
  crew: CrewInput[];
  notes?: string;
  requestId: string;
  acknowledgeConflicts?: boolean;
}

export interface UpdateAppointmentInput {
  startLocal?: string;
  endLocal?: string;
  allDay?: boolean;
  /** Full replacement list. */
  crew?: CrewInput[];
  notes?: string;
  visitType?: VisitType;
  expectedVersion: number;
  acknowledgeConflicts?: boolean;
  reason?: string;
}

export interface CancelAppointmentInput {
  expectedVersion: number;
  reason: string;
}

export interface CompleteAppointmentInput {
  expectedVersion: number;
}

export interface CrewOption {
  employeeId: number;
  name: string;
  hasLogin: boolean;
}

export interface AppointmentHistoryEntry {
  id: number;
  action: string;
  at: string;
  fromStartsAt: string | null;
  fromEndsAt: string | null;
  toStartsAt: string | null;
  toEndsAt: string | null;
  reason: string;
  conflictsAcknowledgedCount: number;
  actorName: string;
  actorEmployeeId: number;
}

export interface AppointmentFeedParams {
  from: string;
  to: string;
  employeeId?: number | null;
  visitType?: VisitType;
  includeCancelled?: boolean;
}

export interface AppointmentFeed {
  appointments: Appointment[];
  truncated: boolean;
  timezone: string;
}

/** A write's result; `emailSent` is false when no crew email went out. */
export interface AppointmentWriteResult {
  appointment: Appointment;
  emailSent: boolean;
}
