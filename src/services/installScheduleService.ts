import { isAxiosError } from 'axios';
import type { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type {
  Appointment,
  AppointmentFeed,
  AppointmentFeedParams,
  AppointmentHistoryEntry,
  AppointmentWriteResult,
  CancelAppointmentInput,
  CompleteAppointmentInput,
  ConflictResponse,
  CreateAppointmentInput,
  CrewOption,
  StaleVersionResponse,
  UpdateAppointmentInput,
} from '@/types/installSchedule';

// Install Schedule API wrapper: `/api/tenant/install-appointments*` plus the
// per-job list under `/api/tenant/fabrication-jobs/{uuid}/install-appointments`.
// The server enforces tenancy, RBAC (`install_appointment:*`), scope and IDOR.
const BASE = '/tenant/install-appointments';
const JOB_BASE = '/tenant/fabrication-jobs';
const HTTP_CONFLICT = 409;
const CODE_CONFLICT = 'conflict';
const CODE_STALE = 'stale_version';

function errorCode(err: unknown): string | undefined {
  if (!isAxiosError(err) || err.response?.status !== HTTP_CONFLICT) return undefined;
  return (err.response.data as { code?: string } | undefined)?.code;
}

/** True for a 409 `conflict`: overlaps the caller must acknowledge before booking. */
export function isConflictError(err: unknown): err is AxiosError<ConflictResponse> {
  return errorCode(err) === CODE_CONFLICT;
}

/** True for a 409 `stale_version`: someone else changed the visit first. */
export function isStaleError(err: unknown): err is AxiosError<StaleVersionResponse> {
  return errorCode(err) === CODE_STALE;
}

export const installScheduleService = {
  getFeed: (params: AppointmentFeedParams): Promise<AppointmentFeed> => {
    const { from, to, employeeId, visitType, includeCancelled } = params;
    return tenantClient
      .get<AppointmentFeed>(BASE, {
        params: {
          from,
          to,
          ...(employeeId !== null && employeeId !== undefined ? { employeeId } : {}),
          ...(visitType ? { visitType } : {}),
          ...(includeCancelled ? { includeCancelled: true } : {}),
        },
      })
      .then((r) => ({
        appointments: r.data.appointments ?? [],
        truncated: Boolean(r.data.truncated),
        timezone: r.data.timezone ?? '',
      }));
  },

  getAppointment: (uuid: string): Promise<Appointment> =>
    tenantClient.get<{ appointment: Appointment }>(`${BASE}/${uuid}`).then((r) => r.data.appointment),

  createAppointment: (input: CreateAppointmentInput): Promise<AppointmentWriteResult> =>
    tenantClient.post<AppointmentWriteResult>(BASE, input).then(toWriteResult),

  updateAppointment: (uuid: string, input: UpdateAppointmentInput): Promise<AppointmentWriteResult> =>
    tenantClient.patch<AppointmentWriteResult>(`${BASE}/${uuid}`, input).then(toWriteResult),

  cancelAppointment: (uuid: string, input: CancelAppointmentInput): Promise<AppointmentWriteResult> =>
    tenantClient.post<AppointmentWriteResult>(`${BASE}/${uuid}/cancel`, input).then(toWriteResult),

  completeAppointment: (uuid: string, input: CompleteAppointmentInput): Promise<AppointmentWriteResult> =>
    tenantClient.post<AppointmentWriteResult>(`${BASE}/${uuid}/complete`, input).then(toWriteResult),

  getHistory: (uuid: string): Promise<AppointmentHistoryEntry[]> =>
    tenantClient
      .get<{ history: AppointmentHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.history ?? []),

  listForJob: (jobUuid: string): Promise<Appointment[]> =>
    tenantClient
      .get<{ appointments: Appointment[] }>(`${JOB_BASE}/${jobUuid}/install-appointments`)
      .then((r) => r.data.appointments ?? []),

  getCrewOptions: (): Promise<CrewOption[]> =>
    tenantClient.get<{ crew: CrewOption[] }>(`${BASE}/crew-options`).then((r) => r.data.crew ?? []),
};

function toWriteResult(r: { data: AppointmentWriteResult }): AppointmentWriteResult {
  return { appointment: r.data.appointment, emailSent: Boolean(r.data.emailSent) };
}
