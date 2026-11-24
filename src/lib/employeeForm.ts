// Employee form + status catalog (backend employee/transitions.go).
import type { Employee, EmployeeFields } from '@/types/employee';

// ── Status catalog ───────────────────────────────────────────────────────────

/** Every `lkp_record_status` row seeded for the EMPL record type. */
export const EMPLOYEE_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'PEND', label: 'Pending Approval' },
  { code: 'ACTV', label: 'Active' },
  { code: 'INAC', label: 'Inactive' },
];

/** Status badge color, shared by the list table and the detail page. */
export const EMPLOYEE_STATUS_COLORS: Record<string, string> = {
  PEND: '#f59e0b',
  ACTV: '#22c55e',
  INAC: '#a8a29e',
};

/** Legal manual moves per status — mirrors the backend `allowedTransitions`.
 *  Pending -> Active is further gated by the approval chain: it is offered only
 *  while nobody is configured to approve (see {@link canActivateByHand}). */
export const EMPLOYEE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PEND: ['ACTV', 'INAC'],
  ACTV: ['INAC'],
  INAC: ['ACTV'],
};

/** Button label per (from, to) pair. */
const TRANSITION_LABELS: Record<string, string> = {
  'PEND:ACTV': 'Activate',
  'PEND:INAC': 'Cancel hiring',
  'ACTV:INAC': 'Deactivate',
  'INAC:ACTV': 'Reactivate',
};

export function employeeTransitionLabel(from: string, to: string): string {
  return TRANSITION_LABELS[`${from}:${to}`] ?? employeeStatusLabel(to);
}

export function employeeStatusLabel(code: string): string {
  return EMPLOYEE_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** The manual moves worth offering right now. A pending employee that is still
 *  waiting on approvers (`gated`) can only be approved or rejected, not
 *  activated by hand. */
export function availableEmployeeTransitions(statusCode: string, gated: boolean): string[] {
  const next = EMPLOYEE_ALLOWED_TRANSITIONS[statusCode] ?? [];
  return next.filter((to) => !(statusCode === 'PEND' && to === 'ACTV' && gated));
}

// ── Form ─────────────────────────────────────────────────────────────────────

export const EMPLOYEE_NAME_MAX = 100;
export const EMPLOYEE_EMAIL_MAX = 255;
export const EMPLOYEE_PHONE_MAX = 30;
export const EMPLOYEE_ADDRESS_MAX = 2000;

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function employeeDefaults(): EmployeeFields {
  return { firstName: '', lastName: '', email: '', phone: '', jobTitle: '', department: '', address: '' };
}

/** Loads an employee into the form shape. */
export function employeeToForm(e: Employee): EmployeeFields {
  return {
    firstName: e.firstName ?? '',
    lastName: e.lastName ?? '',
    email: e.email ?? '',
    phone: e.phone ?? '',
    jobTitle: e.jobTitle ?? '',
    department: e.department ?? '',
    address: e.address ?? '',
  };
}

/** Trims every field before it is sent. */
export function employeePayload(f: EmployeeFields): EmployeeFields {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    jobTitle: f.jobTitle.trim(),
    department: f.department.trim(),
    address: f.address.trim(),
  };
}

export type EmployeeErrors = Partial<Record<keyof EmployeeFields, string>>;

/** Client-side checks that mirror the server's (employee/store_create.go), so
 *  the person sees them next to the field. The server stays authoritative. */
export function validateEmployee(f: EmployeeFields): EmployeeErrors {
  const p = employeePayload(f);
  const errors: EmployeeErrors = {};
  if (!p.firstName) errors.firstName = 'First name is required.';
  else if (p.firstName.length > EMPLOYEE_NAME_MAX) errors.firstName = `First name must be at most ${EMPLOYEE_NAME_MAX} characters.`;
  if (p.lastName.length > EMPLOYEE_NAME_MAX) errors.lastName = `Last name must be at most ${EMPLOYEE_NAME_MAX} characters.`;
  if (!p.email) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(p.email)) errors.email = 'Enter a valid email address.';
  else if (p.email.length > EMPLOYEE_EMAIL_MAX) errors.email = `Email must be at most ${EMPLOYEE_EMAIL_MAX} characters.`;
  if (p.phone.length > EMPLOYEE_PHONE_MAX) errors.phone = `Phone must be at most ${EMPLOYEE_PHONE_MAX} characters.`;
  if (p.jobTitle.length > EMPLOYEE_NAME_MAX) errors.jobTitle = `Job title must be at most ${EMPLOYEE_NAME_MAX} characters.`;
  if (p.department.length > EMPLOYEE_NAME_MAX) errors.department = `Department must be at most ${EMPLOYEE_NAME_MAX} characters.`;
  if (p.address.length > EMPLOYEE_ADDRESS_MAX) errors.address = `Address must be at most ${EMPLOYEE_ADDRESS_MAX} characters.`;
  return errors;
}

export function hasEmployeeErrors(errors: EmployeeErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Display name used in lists and pickers: the person's name, else the email. */
export function employeeName(e: Pick<Employee, 'firstName' | 'lastName' | 'email'>): string {
  const name = [e.firstName, e.lastName].map((s) => s?.trim()).filter(Boolean).join(' ');
  return name || e.email;
}
