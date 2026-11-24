// Company Preferences tab (Configuration -> Company Info -> Company
// Preferences): the fabrication markup used by the SO drawing editor's sq ft
// breakdown (fabrication sq ft = countertop sq ft * (1 + fabricationPercent /
// 100), see components/drawing/AreaSummary.tsx). Shares the same singleton
// company-profile record as the Company Profile tab, but edits only this one
// field — Save sends the full profile with just fabricationPercent replaced,
// so it never clobbers what the other tabs own.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Pencil, Percent } from 'lucide-react';
import { z } from 'zod';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { companyProfileService } from '@/services/companyProfileService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { DEFAULT_FABRICATION_PERCENT, type CompanyProfile } from '@/types/companyProfile';
import { MAX_FABRICATION_PERCENT } from '@/lib/companyProfileForm';
import { CompanyInfoTextField, CompanyInfoReadonlyField } from './CompanyInfoTextField';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const PREFERENCES_FIELD = {
  id: 'cp-fabrication-percent',
  label: 'Fabrication Percentage',
  icon: Percent,
  placeholder: 'e.g. 20',
  type: 'number' as const,
  min: 0,
  max: MAX_FABRICATION_PERCENT,
  step: 0.01,
};

const preferencesSchema = z.object({
  fabricationPercent: z.coerce
    .number()
    .min(0, 'Must be at least 0')
    .max(MAX_FABRICATION_PERCENT, `Must be at most ${MAX_FABRICATION_PERCENT}`),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

const FORM_ID = 'company-preferences-form';

export function CompanyPreferencesTab({ actionsSlot }: { actionsSlot: HTMLDivElement | null }) {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('company_profile', 'configure');
  const [isEditing, setIsEditing] = useState(false);

  const profileQ = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema) as unknown as Resolver<PreferencesFormValues>,
    defaultValues: { fabricationPercent: DEFAULT_FABRICATION_PERCENT },
  });
  const fabricationPercent = watch('fabricationPercent');

  useEffect(() => {
    if (profileQ.data) reset({ fabricationPercent: profileQ.data.fabricationPercent });
  }, [profileQ.data, reset]);

  const save = useMutation({
    // Sends the whole profile — the backend always replaces fabricationPercent
    // with whatever is sent (unlike paymentDetails/documentDefaults, it has no
    // "omit to keep" semantics) — so every other field must ride along
    // unchanged from what is currently stored.
    mutationFn: (data: PreferencesFormValues) => {
      const { logoUrl: _logoUrl, ...current } = profileQ.data as CompanyProfile & { logoUrl: string };
      return companyProfileService.update({ ...current, fabricationPercent: data.fabricationPercent });
    },
    onSuccess: (saved) => {
      qc.setQueryData(['company-profile'], saved);
      reset({ fabricationPercent: saved.fabricationPercent });
      setIsEditing(false);
      toast.success('Company preferences saved');
    },
  });

  function onSubmit(data: PreferencesFormValues) {
    save.mutate(data);
  }

  function cancelEdit() {
    reset({ fabricationPercent: profileQ.data?.fabricationPercent ?? DEFAULT_FABRICATION_PERCENT });
    setIsEditing(false);
  }

  if (profileQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner label="Loading company preferences…" />
      </div>
    );
  }
  if (profileQ.isError) {
    return (
      <div className="max-w-lg">
        <ErrorNote>{apiErrorMessage(profileQ.error)}</ErrorNote>
      </div>
    );
  }

  const actions = canConfigure && (
    !isEditing ? (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit company preferences"
        className={cn(buttonVariants(), 'active:scale-95')}
      >
        <Pencil className="size-3.5" />
        Edit
      </button>
    ) : (
      <>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isSubmitting || save.isPending}
          aria-label="Cancel editing company preferences"
          className={buttonVariants({ variant: 'ghost' })}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={isSubmitting || save.isPending || !isDirty}
          aria-label="Save company preferences"
          className={cn(buttonVariants(), 'active:scale-95')}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </>
    )
  );

  return (
    <>
      {actionsSlot && createPortal(actions, actionsSlot)}
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="w-full space-y-2">
        {save.isError && (
          <ErrorNote>{apiErrorMessage(save.error, 'Could not save company preferences.')}</ErrorNote>
        )}

        {!canConfigure && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
            <AlertCircle className="size-4 shrink-0 text-warning-ink mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">View-only access</p>
              <p className="text-xs text-warning-ink mt-0.5">
                Ask an admin for the Company Info: Configure permission to make changes.
              </p>
            </div>
          </div>
        )}

        <ModernSection title="Fabrication" index={1}>
          <p className="mb-3 type-helper">
            The drawing editor&apos;s sq ft breakdown adds this percentage on top of the countertop sq ft to get the
            fabrication sq ft. 20% is a starting default — tune it to your shop&apos;s own numbers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            {isEditing ? (
              <CompanyInfoTextField field={PREFERENCES_FIELD} registration={register('fabricationPercent')} error={errors.fabricationPercent?.message} />
            ) : (
              <CompanyInfoReadonlyField field={PREFERENCES_FIELD} value={`${fabricationPercent}%`} />
            )}
          </div>
        </ModernSection>
      </form>
    </>
  );
}
