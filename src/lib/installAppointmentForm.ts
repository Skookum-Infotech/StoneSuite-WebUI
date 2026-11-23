// Pure form logic for the install-visit dialog: defaults, the start/duration
// arithmetic, and the request bodies. Kept out of the component so it is tested
// without a DOM. Times are zone-less wall-clock strings, as the API takes them.

import { splitWallClock } from '@/lib/salesOrderSchedule';
import type {
  Appointment,
  CreateAppointmentInput,
  CrewInput,
  UpdateAppointmentInput,
  VisitType,
} from '@/types/installSchedule';

const STEP_MINUTES = 15;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MAX_TIMED_MINUTES = 12 * MINUTES_PER_HOUR;
const MS_PER_MINUTE = 60_000;
const DEFAULT_START = '08:00';

export const VISIT_TYPES: VisitType[] = ['template', 'install', 'service'];
export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  template: 'Template',
  install: 'Install',
  service: 'Service',
};
/** Default length of a visit by type (plan Q7). */
export const DEFAULT_DURATION: Record<VisitType, number> = { template: 60, install: 240, service: 120 };
export const NOTES_MAX = 2000;

export interface VisitForm {
  jobId: string;
  visitType: VisitType;
  date: string;
  /** Inclusive last day; only used when `allDay`. */
  endDate: string;
  allDay: boolean;
  startTime: string;
  durationMin: number;
  crew: CrewInput[];
  notes: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "08:15" -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * MINUTES_PER_HOUR + m;
}

/** Wall-clock `yyyy-mm-ddThh:mm` plus a number of minutes. */
export function addMinutesLocal(local: string, minutes: number): string {
  const parts = splitWallClock(local);
  if (!parts) return local;
  const [y, mo, d] = parts.date.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, 0, timeToMinutes(parts.time) + minutes));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** Minutes from `start` to `end` (both wall-clock), 0 when either is malformed. */
export function minutesBetween(start: string, end: string): number {
  const a = splitWallClock(start);
  const b = splitWallClock(end);
  if (!a || !b) return 0;
  const ms = (p: { date: string; time: string }) => {
    const [y, mo, d] = p.date.split('-').map(Number);
    return Date.UTC(y, mo - 1, d, 0, timeToMinutes(p.time));
  };
  return Math.round((ms(b) - ms(a)) / MS_PER_MINUTE);
}

/** Every quarter hour of the day, "00:00" to "23:45". */
export const START_TIMES: string[] = Array.from({ length: MINUTES_PER_DAY / STEP_MINUTES }, (_, i) => {
  const mins = i * STEP_MINUTES;
  return `${pad(Math.floor(mins / MINUTES_PER_HOUR))}:${pad(mins % MINUTES_PER_HOUR)}`;
});

/** "1 h 15 min" for a duration in minutes. */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Duration choices in 15-minute steps; a stored duration outside the list stays selectable. */
export function durationOptions(current: number): number[] {
  const out: number[] = [];
  for (let m = STEP_MINUTES; m <= MAX_TIMED_MINUTES; m += STEP_MINUTES) out.push(m);
  return out.includes(current) || current <= 0 ? out : [...out, current].sort((a, b) => a - b);
}

/** A blank form for a new visit; `date` is the day the calendar is showing. */
export function emptyForm(date: string, jobId = ''): VisitForm {
  return {
    jobId,
    visitType: 'install',
    date,
    endDate: date,
    allDay: false,
    startTime: DEFAULT_START,
    durationMin: DEFAULT_DURATION.install,
    crew: [],
    notes: '',
  };
}

/** The form for editing an existing visit. */
export function formFromAppointment(a: Appointment): VisitForm {
  const start = splitWallClock(a.startLocal);
  return {
    jobId: a.fabricationJobId,
    visitType: a.visitType,
    date: a.localStartDate,
    endDate: a.localEndDate,
    allDay: a.allDay,
    startTime: start?.time ?? DEFAULT_START,
    durationMin: a.allDay ? DEFAULT_DURATION[a.visitType] : minutesBetween(a.startLocal, a.endLocal),
    crew: a.crew.map((c) => ({ employeeId: c.employeeId, role: c.role })),
    notes: a.notes,
  };
}

/** Changing the type resets the duration to that type's default. */
export function withVisitType(form: VisitForm, visitType: VisitType): VisitForm {
  return { ...form, visitType, durationMin: DEFAULT_DURATION[visitType] };
}

/** The `startLocal`/`endLocal` the API takes (date-only, end inclusive, for all-day). */
export function toLocalRange(form: VisitForm): { startLocal: string; endLocal: string } {
  if (form.allDay) return { startLocal: form.date, endLocal: form.endDate || form.date };
  const startLocal = `${form.date}T${form.startTime}`;
  return { startLocal, endLocal: addMinutesLocal(startLocal, form.durationMin) };
}

/** The first problem with the form, or '' when it can be submitted. */
export function formProblem(form: VisitForm): string {
  if (!form.jobId) return 'Choose the fabrication job for this visit.';
  if (!form.date) return 'Choose a date.';
  if (form.allDay && form.endDate < form.date) return 'The last day cannot be before the first.';
  if (form.notes.length > NOTES_MAX) return `Notes can be at most ${NOTES_MAX} characters.`;
  return '';
}

/** Create body without the idempotency key or acknowledgement. */
export function toCreateBase(form: VisitForm): Omit<CreateAppointmentInput, 'requestId' | 'acknowledgeConflicts'> {
  return {
    fabricationJobId: form.jobId,
    visitType: form.visitType,
    ...toLocalRange(form),
    allDay: form.allDay,
    crew: form.crew,
    notes: form.notes,
  };
}

/** Full-replacement PATCH body for an edit. */
export function toUpdateInput(form: VisitForm, expectedVersion: number, acknowledge: boolean): UpdateAppointmentInput {
  return {
    visitType: form.visitType,
    ...toLocalRange(form),
    allDay: form.allDay,
    crew: form.crew,
    notes: form.notes,
    expectedVersion,
    ...(acknowledge ? { acknowledgeConflicts: true } : {}),
  };
}
