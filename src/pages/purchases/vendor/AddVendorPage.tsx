import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building, AlertCircle, ChevronRight, Loader2, Save } from 'lucide-react';
import { vendorService } from '@/services/vendorService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { vendorDefaults, validateVendorForm, toCreatePayload, type VendorFieldError } from '@/lib/vendorForm';
import type { VendorType } from '@/types/vendor';
import { VendorTypeSwitcher } from './components/VendorTypeSwitcher';
import { VendorFormBody } from './components/VendorFormBody';

export default function AddVendorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [data, setData] = useState<Record<string, unknown>>(vendorDefaults);
  const [validationErrors, setValidationErrors] = useState<VendorFieldError[]>([]);

  const vendorType = (data.vendor_type as VendorType) ?? 'Organization';

  const set = useCallback((key: string, value: unknown) => {
    setValidationErrors((errs) => (errs.length ? [] : errs));
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const setVendorType = useCallback((type: VendorType) => {
    setValidationErrors([]);
    setData((d) => ({ ...d, vendor_type: type }));
  }, []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => vendorService.createVendor(toCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      navigate('/purchases/vendor');
    },
  });

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
          save();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Vendors"
          onBack={() => navigate('/purchases/vendor')}
          icon={Building}
          title="New Vendor"
          subtitle="Fields marked * are required."
          actions={(
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Vendor'}
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

        {/* Prominent vendor-type switcher — always visible above the scrollable sections */}
        <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-4 3xl:px-10 4xl:px-16">
          <VendorTypeSwitcher value={vendorType} onChange={setVendorType} />
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
          onCancel={() => navigate('/purchases/vendor')}
          isPending={isPending}
          submitLabel="Save Vendor"
        />
      </form>
    </div>
  );
}
