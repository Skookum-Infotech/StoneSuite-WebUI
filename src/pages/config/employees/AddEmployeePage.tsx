import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '@/services/employeeService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollToError } from '@/hooks/useScrollToError';
import {
  employeeDefaults, employeePayload, hasEmployeeErrors, validateEmployee, type EmployeeErrors,
} from '@/lib/employeeForm';
import type { EmployeeFields } from '@/types/employee';
import { EmployeeFormBody } from './components/EmployeeFormBody';

const LIST_PATH = '/config/employees';

export default function AddEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<EmployeeFields>(employeeDefaults);
  const [errors, setErrors] = useState<EmployeeErrors>({});

  const guard = useUnsavedChangesGuard({ value });

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => employeeService.createEmployee(employeePayload(value)),
    onSuccess: (emp) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      // A new employee waits for approval when approvers are configured; say so
      // instead of implying they are ready to use.
      toast.success(emp.statusCode === 'PEND' ? 'Employee created and sent for approval.' : 'Employee created.');
      guard.markClean();
      navigate(`${LIST_PATH}/${emp.id}`);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);

  function submit() {
    const found = validateEmployee(value);
    setErrors(found);
    if (!hasEmployeeErrors(found)) save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Employees"
          onBack={() => navigate(LIST_PATH)}
          icon={UserRound}
          title="New Employee"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending} aria-label="Save employee"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Employee'}
            </button>
          )}
        />

        {saveError && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save employee.')}
            </p>
          </div>
        )}

        <EmployeeFormBody value={value} onChange={setValue} errors={errors} />

        <FormActionBar onCancel={() => navigate(LIST_PATH)} isPending={isPending} submitLabel="Save Employee" />
      </form>
    </div>
  );
}
