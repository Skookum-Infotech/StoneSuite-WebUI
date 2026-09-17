import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin } from 'lucide-react';
import { companyLocationSchema, type CompanyLocationFormValues } from '@/lib/companyLocationForm';
import { fieldCls, fieldErrorCls, fieldLabelCls } from '@/components/crm/formUtils';
import { PhoneNumberInput } from '@/components/crm/PhoneNumberInput';
import type { Address } from '@/types/companyProfile';
import { lookupService } from '@/services/lookupService';
import { countryOptions, stateOptionsForCountry } from '@/lib/companyInfoLookupOptions';
import { CompanyInfoTextField } from './CompanyInfoTextField';
import { CompanyInfoSelectField } from './CompanyInfoSelectField';

// Line 1 gets the full row (a street address needs the room); line2/suite/
// city then tile 3-across, and country/state/zip tile 3-across below that —
// same tiling as Company Profile's own address groups. country/state render
// as dropdowns (see the key special-cases below).
const ADDRESS_SUBFIELDS: { key: keyof Address; label: string; placeholder: string; colSpan?: 2 | 3 }[] = [
  { key: 'line1', label: 'Address Line 1', placeholder: 'e.g. 123 Main Street', colSpan: 3 },
  { key: 'line2', label: 'Address Line 2', placeholder: 'e.g. Building B' },
  { key: 'suite', label: 'Suite / Unit #', placeholder: 'e.g. Suite 400' },
  { key: 'city', label: 'City', placeholder: 'e.g. Springfield' },
  { key: 'country', label: 'Country', placeholder: 'Select a country' },
  { key: 'state', label: 'State / Province', placeholder: 'Select a state' },
  { key: 'zip', label: 'Zip / Postal Code', placeholder: 'e.g. 62704' },
];

// Inline add/edit form for one Location — rendered in place of a LocationCard
// (add: appended at the top of the list; edit: swapped in for the card being
// edited), never in a modal.
export function LocationFormCard({
  initial, onSave, onCancel, isSaving,
}: {
  initial: CompanyLocationFormValues;
  onSave: (values: CompanyLocationFormValues) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CompanyLocationFormValues>({
    resolver: zodResolver(companyLocationSchema) as unknown as Resolver<CompanyLocationFormValues>,
    defaultValues: initial,
  });
  const values = watch();
  // Same lookup list Company Profile's own address dropdowns use — see
  // lib/companyInfoLookupOptions.ts for why these stay curated-values
  // dropdowns over plain text rather than true lookup-id foreign keys.
  const lookupsQ = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      noValidate
      className="w-full rounded-2xl border border-brand/40 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <CompanyInfoTextField
            field={{ id: 'loc-name', label: 'Location Name', icon: Building2, placeholder: 'e.g. Main Office', required: true }}
            registration={register('name')}
            error={errors.name?.message}
          />
          <div className="space-y-1.5">
            <label htmlFor="loc-phone" className={fieldLabelCls}>Phone</label>
            <PhoneNumberInput
              id="loc-phone"
              value={values.phone ?? ''}
              onChange={(v) => setValue('phone', v, { shouldValidate: true, shouldDirty: true })}
              placeholder="e.g. (555) 010-0100"
              aria-label="Phone"
              aria-invalid={Boolean(errors.phone?.message)}
              aria-describedby={errors.phone?.message ? 'loc-phone-error' : undefined}
              className={errors.phone?.message ? fieldErrorCls : fieldCls}
            />
            {errors.phone?.message && (
              <p id="loc-phone-error" className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-stone-400">
            <MapPin className="size-3.5" />
            Address
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            {ADDRESS_SUBFIELDS.map((sub) => {
              const fieldSpec = { id: `loc-address-${sub.key}`, label: sub.label, placeholder: sub.placeholder, colSpan: sub.colSpan };
              if (sub.key === 'country') {
                return (
                  <CompanyInfoSelectField
                    key={sub.key}
                    field={fieldSpec}
                    registration={register('address.country')}
                    error={errors.address?.country?.message}
                    options={countryOptions(lookupsQ.data, values.address?.country ?? '')}
                  />
                );
              }
              if (sub.key === 'state') {
                return (
                  <CompanyInfoSelectField
                    key={sub.key}
                    field={fieldSpec}
                    registration={register('address.state')}
                    error={errors.address?.state?.message}
                    options={stateOptionsForCountry(lookupsQ.data, values.address?.country ?? '', values.address?.state ?? '')}
                  />
                );
              }
              return (
                <CompanyInfoTextField
                  key={sub.key}
                  field={fieldSpec}
                  registration={register(`address.${sub.key}`)}
                  error={errors.address?.[sub.key]?.message}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Cancel"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          aria-label="Save location"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-stone-950 hover:bg-brand/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSaving ? 'Saving…' : 'Save Location'}
        </button>
      </div>
    </form>
  );
}
