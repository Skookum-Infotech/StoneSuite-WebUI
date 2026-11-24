// Employee module — frontend contract types.
//
// Mirrors the dedicated relational Employee backend module
// (`StoneSuite-Backend/employee/*.go`), served from `/api/tenant/employees*`
// (Configuration > Employee). An employee is a staff record, not a login:
// `hasLogin` is true only for people who can also sign in (their email is then
// edited under Users). A new employee waits for the approvers configured under
// Configure > Workflows > Employee (none configured = Active at once), and an
// Active employee gets a Vendor record of type "Employee".
import type { ApprovalOverlay, FilterClause, SortKey } from '@/types/tenant';

/** The editable profile — the create/update payload and the shared form shape. */
export interface EmployeeFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  address: string;
}

export type EmployeeCreatePayload = EmployeeFields;

export interface EmployeeUpdatePayload extends EmployeeFields {
  /** The recordVersion the form loaded; the server refuses a stale save. */
  expectedVersion?: number;
}

/** `lkp_record_status` codes seeded for the EMPL record type. */
export type EmployeeStatusCode = 'PEND' | 'ACTV' | 'INAC';

export interface Employee extends EmployeeFields {
  id: string;
  employeeNumber: string;
  status: string;               // human label, e.g. "Active"
  statusCode: EmployeeStatusCode;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  nextStatusCodes?: string[];
  displayName: string;
  /** True when this employee is also a login user. */
  hasLogin: boolean;
  isActive: boolean;
  /** The Employee-type vendor record, once the employee has been Active. */
  vendorId?: string;
  vendorNumber?: string;
  recordVersion: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Detail response: the employee plus the approval overlay the detail endpoint
 *  adds (who must sign, who has, whether the caller can approve or reject). */
export type EmployeeDetail = Employee & ApprovalOverlay;

export interface EmployeeSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface EmployeePage {
  records: Employee[];
  nextCursor: string;
  hasMore: boolean;
}

/** One row of an employee's status trail (GET .../history). */
export interface EmployeeHistoryEntry {
  action: string;
  fromStatus?: string;
  toStatus?: string;
  actorName?: string;
  at: string;
}
