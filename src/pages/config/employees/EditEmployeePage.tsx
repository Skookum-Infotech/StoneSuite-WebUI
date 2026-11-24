import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '@/services/employeeService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import {
  employeePayload, employeeToForm, hasEmployeeErrors, validateEmployee, type EmployeeErrors,
} from '@/lib/employeeForm';
import type { EmployeeFields } from '@/types/employee';
import { EmployeeFormBody } from './components/EmployeeFormBody';

import { buttonVariants } from '@/components/ui/button';
const LIST_PATH = '/config/employees';

export default function EditEmployeePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<EmployeeFields | null>(null);
  const [errors, setErrors] = useState<EmployeeErrors>({});

  const { data: emp, isLoading, error: loadError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getEmployee(id),
    enabled: Boolean(id),
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

  const loaded = useMemo(() => (emp ? employeeToForm(emp) : null), [emp]);
  const value = local ?? loaded;

  // Baseline against the loaded record, so opening the page is never an edit.
  const guard = useUnsavedChangesGuard({ value }, Boolean(loaded));

  const save = useMutation({
    mutationFn: () => {
      if (!value || !emp) throw new Error('Employee not loaded.');
      return employeeService.updateEmployee(id, { ...employeePayload(value), expectedVersion: emp.recordVersion });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(emp?.approvalStatus === 'rejected' ? 'Saved and sent back for approval.' : 'Employee saved.');
      guard.markClean();
      navigate(`${LIST_PATH}/${id}`);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(save.error);

  if (isLoading) return <div className="p-6"><Spinner label="Loading employee…" /></div>;
  if (loadError || !emp || !value)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Employee not available.')}</ErrorNote></div>;

  function submit() {
    if (!value) return;
    const found = validateEmployee(value);
    setErrors(found);
    if (!hasEmployeeErrors(found)) save.mutate();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Employees"
          onBack={() => navigate(`${LIST_PATH}/${id}`)}
          icon={UserRound}
          title={emp.displayName || 'Employee'}
          subtitle={emp.employeeNumber || undefined}
          actions={(
            <button type="submit" disabled={save.isPending} aria-label="Save employee"
              className={buttonVariants()}>
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Employee'}
            </button>
          )}
        />

        {emp.approvalStatus === 'rejected' && (
          <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
            This employee was rejected. Saving your changes sends it back to the approvers.
          </p>
        )}

        {save.error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-danger-ink" />
            </span>
            <p className="type-error">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save employee.')}
            </p>
          </div>
        )}

        <EmployeeFormBody value={value} onChange={setLocal} errors={errors} emailLocked={emp.hasLogin} />

        <FormActionBar onCancel={() => navigate(`${LIST_PATH}/${id}`)} isPending={save.isPending} submitLabel="Save Employee" />
      </form>
    </div>
  );
}
