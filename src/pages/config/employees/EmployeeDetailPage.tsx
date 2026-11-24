import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { UserRound, Pencil, Power, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '@/services/employeeService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { RecordApprovalBanner } from '@/components/tenant/RecordApprovalBanner';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { formatDateValue } from '@/lib/dateUtils';
import {
  EMPLOYEE_STATUS_COLORS, availableEmployeeTransitions, employeeStatusLabel, employeeTransitionLabel,
} from '@/lib/employeeForm';
import { EmployeeHistoryTab } from './components/EmployeeHistoryTab';

const LIST_PATH = '/config/employees';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// Poll the record so an approval made by someone else shows up without a reload —
// same cadence as the other detail pages.
const DETAIL_POLL_MS = 60_000;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('employee', 'update');
  const canTransition = permissionsLoading || hasPermission('employee', 'transition');

  const { data: emp, isLoading, error } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getEmployee(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  // Never show a raw record UUID in the breadcrumb — swap in the employee
  // number once the record loads, and clear it on unmount.
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (emp?.employeeNumber) {
      setLabel(id, emp.employeeNumber);
      return () => clearLabel(id);
    }
  }, [id, emp?.employeeNumber, setLabel, clearLabel]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['employee', id] });
    void queryClient.invalidateQueries({ queryKey: ['employee-history', id] });
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
  }

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => employeeService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Employee is now ${employeeStatusLabel(updated.statusCode)}.`);
    },
  });

  const approve = useMutation({
    mutationFn: () => employeeService.approve(id),
    onSuccess: () => {
      refresh();
      toast.success('Approved.');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading employee…" /></div>;
  if (!emp) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Employee not available.')}</ErrorNote></div>;

  const color = EMPLOYEE_STATUS_COLORS[emp.statusCode] ?? '#a8a29e';
  const moves = canTransition ? availableEmployeeTransitions(emp.statusCode, emp.gated) : [];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Employees"
        onBack={() => navigate(LIST_PATH)}
        icon={UserRound}
        title={emp.displayName || 'Employee'}
        subtitle={emp.jobTitle || emp.department || undefined}
        recordNumber={emp.employeeNumber}
        statusBadge={<Badge color={color}>{emp.status}</Badge>}
      />

      <RecordApprovalBanner
        record={emp}
        onApprove={() => approve.mutate()}
        approving={approve.isPending}
        reject={{
          noun: 'employee',
          run: (reason) => employeeService.reject(id, reason),
          onRejected: refresh,
          warning: 'The employee stays pending until someone edits it, which sends it back to the approvers.',
        }}
      />
      {approve.isError && (
        <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
          {apiErrorMessage(approve.error, 'Failed to approve employee.')}
        </p>
      )}

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar py-2.5">
        <div role="tablist" className={TAB_LIST_CLASS}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-label={`${tab.label} tab`}
              className={tabClass(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Personal Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="First name" value={emp.firstName} />
                  <ReadonlyField label="Last name" value={emp.lastName} />
                  <ReadonlyField label="Email" value={emp.email} />
                  <ReadonlyField label="Phone" value={emp.phone} />
                </div>
              </ModernSection>
              <ModernSection title="Work" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Job title" value={emp.jobTitle} />
                  <ReadonlyField label="Department" value={emp.department} />
                  <ReadonlyField label="Address" value={emp.address} full />
                </div>
              </ModernSection>
            </>
          )}
          {activeTab === 'history' && <EmployeeHistoryTab employeeId={id} />}
          <div className="h-6" />
        </div>

        <SalesDetailSidebar label="Employee Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-500">Quick Actions</p>
            <div className="space-y-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`${LIST_PATH}/${id}/edit`)}
                  aria-label="Edit this employee"
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit employee
                </button>
              )}
              {moves.map((to) => (
                <button
                  key={to}
                  type="button"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate(to)}
                  aria-label={`${employeeTransitionLabel(emp.statusCode, to)} this employee`}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {transition.isPending && transition.variables === to
                    ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" />
                    : to === 'INAC'
                      ? <Power className="size-4 text-stone-400 shrink-0" />
                      : <RotateCcw className="size-4 text-stone-400 shrink-0" />}
                  {employeeTransitionLabel(emp.statusCode, to)}
                </button>
              ))}
            </div>
            {transition.error && (
              <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(transition.error, 'Failed to change status.')}</p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-500">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{emp.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Can sign in</span>
              <span className="text-stone-700">{emp.hasLogin ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor record</span>
              {emp.vendorId ? (
                <Link
                  to={`/purchases/vendor/${emp.vendorId}`}
                  aria-label={`Open vendor ${emp.vendorNumber}`}
                  className="font-mono font-semibold text-stone-900 hover:text-accent-foreground"
                >
                  {emp.vendorNumber || 'Open'}
                </Link>
              ) : (
                <span className="text-stone-500">Created when active</span>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(emp.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(emp.updatedAt)}</span>
            </div>
          </div>
        </SalesDetailSidebar>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-500">—</span>}</div>
    </div>
  );
}
