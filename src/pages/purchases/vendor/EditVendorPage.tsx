import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, AlertCircle, ChevronRight, Loader2, Save } from 'lucide-react';
import { vendorService } from '@/services/vendorService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { fromVendor, validateVendorForm, toCreatePayload, type VendorFieldError } from '@/lib/vendorForm';
import type { VendorType } from '@/types/vendor';
import { VendorTypeSwitcher } from './components/VendorTypeSwitcher';
import { VendorFormBody } from './components/VendorFormBody';
import { VendorStatusControl } from './components/VendorStatusControl';

export default function EditVendorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<VendorFieldError[]>([]);

  const { data: vendor, isLoading, error: loadError } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorService.getVendor(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (vendor?.displayName) {
      setLabel(id, vendor.displayName);
      return () => clearLabel(id);
    }
  }, [id, vendor?.displayName, setLabel, clearLabel]);

  const mapped = useMemo(() => (vendor ? fromVendor(vendor) : null), [vendor]);
  const data = localData ?? mapped ?? {};
  const statusCode = localStatusCode ?? vendor?.statusCode ?? '';
  const vendorType = (data.vendor_type as VendorType) ?? 'Organization';

  const set = useCallback((key: string, value: unknown) => {
    setValidationErrors((errs) => (errs.length ? [] : errs));
    setLocalData((prev) => ({ ...(prev ?? mapped ?? {}), [key]: value }));
  }, [mapped]);

  const setVendorType = useCallback((type: VendorType) => {
    setValidationErrors([]);
    setLocalData((prev) => ({ ...(prev ?? mapped ?? {}), vendor_type: type }));
  }, [mapped]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => vendorService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['vendor', id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  const handleStatusChange = useCallback(
    (toCode: string) => {
      if (toCode !== statusCode) {
        setLocalStatusCode(toCode);
        transition.mutate(toCode);
      }
    },
    // transition.mutate is a stable reference from TanStack Query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusCode, transition.mutate],
  );

  const save = useMutation({
    mutationFn: () => vendorService.updateVendor(id, toCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      navigate(`/purchases/vendor/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor…" /></div>;
  if (loadError || !vendor)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load vendor.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validateVendorForm(data);
          if (errors.length > 0) {
            setValidationErrors(errors);
            return;
          }
          setValidationErrors([]);
          save.mutate();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Vendors"
          onBack={() => navigate(`/purchases/vendor/${id}`)}
          icon={Building}
          title={vendor.displayName || 'Vendor'}
          subtitle="Edit vendor"
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save vendor.')}
            </p>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 mb-1.5">Please fill in the required fields before saving:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {validationErrors.map((e) => (
                  <span key={e.key} className="inline-flex items-center gap-1 text-xs text-red-600">
                    <ChevronRight className="size-3 shrink-0" />
                    {e.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vendor type + status — always visible above the scrollable sections */}
        <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-4 space-y-4 3xl:px-10 4xl:px-16">
          <VendorTypeSwitcher value={vendorType} onChange={setVendorType} />
          <div className="max-w-xs">
            <ModernFieldShell label="Vendor Status">
              <VendorStatusControl
                value={statusCode}
                onChange={handleStatusChange}
                disabled={transition.isPending}
              />
            </ModernFieldShell>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <VendorFormBody
            vendorType={vendorType}
            data={data}
            set={set}
            lookups={lookups}
            showErrors={validationErrors.length > 0}
          />
        </div>

        <FormActionBar
          onCancel={() => navigate(`/purchases/vendor/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
