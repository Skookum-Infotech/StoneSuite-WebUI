import { tenantClient } from '@/api/tenantClient';
import type { ApprovalRejection } from '@/types/tenant';
import type {
  Employee,
  EmployeeCreatePayload,
  EmployeeDetail,
  EmployeeHistoryEntry,
  EmployeePage,
  EmployeeSearchRequest,
  EmployeeUpdatePayload,
} from '@/types/employee';

// Employee API wrapper. Talks to the dedicated relational module under
// `/api/tenant/employees*`. Every call carries the tenant Bearer JWT via
// `tenantClient`; the server enforces tenancy and the `employee:*` grants.
const BASE = '/tenant/employees';

interface ApprovalBlock {
  gated?: boolean;
  approvers?: EmployeeDetail['approvers'];
  requiredApprovals?: number;
  approvedCount?: number;
  canApprove?: boolean;
  isOverride?: boolean;
  callerAlreadyApproved?: boolean;
  canReject?: boolean;
  rejection?: ApprovalRejection;
}

export const employeeService = {
  // Filter + sort + global search + keyset pagination. Cursors are opaque —
  // pass back what the server returned, never construct one.
  searchEmployees: (req: EmployeeSearchRequest): Promise<EmployeePage> =>
    tenantClient
      .post<{ success: boolean; records: Employee[]; nextCursor: string; hasMore: boolean }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  getEmployee: (uuid: string): Promise<EmployeeDetail> =>
    tenantClient
      .get<{ success: boolean; employee: Employee; approval?: ApprovalBlock }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.employee,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
          canReject: a?.canReject ?? false,
          rejection: a?.rejection,
        };
      }),

  createEmployee: (payload: EmployeeCreatePayload): Promise<Employee> =>
    tenantClient
      .post<{ success: boolean; employee: Employee }>(BASE, payload)
      .then((r) => r.data.employee),

  updateEmployee: (uuid: string, payload: EmployeeUpdatePayload): Promise<Employee> =>
    tenantClient
      .patch<{ success: boolean; employee: Employee }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.employee),

  // Activate / deactivate. Moving a pending employee to Active by hand is
  // refused (409) while approvers are configured and have not all signed.
  transition: (uuid: string, toStatusCode: string): Promise<Employee> =>
    tenantClient
      .post<{ success: boolean; employee: Employee }>(`${BASE}/${uuid}/transition`, { toStatusCode })
      .then((r) => r.data.employee),

  // One configured approver's sign-off (403 if the caller isn't one, 409 if
  // the employee is not awaiting approval).
  approve: (uuid: string): Promise<Employee> =>
    tenantClient
      .post<{ success: boolean; employee: Employee }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.employee),

  // An approver's veto, with a required reason. The employee stays pending,
  // flagged rejected, until it is edited. The POST response carries no approval
  // overlay, so callers invalidate the record's query to pick up the banner.
  reject: (uuid: string, reason: string): Promise<Employee> =>
    tenantClient
      .post<{ success: boolean; employee: Employee }>(`${BASE}/${uuid}/reject`, { reason })
      .then((r) => r.data.employee),

  getHistory: (uuid: string): Promise<EmployeeHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: EmployeeHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
