import type { ReactNode } from 'react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { checkboxLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { CrmLookups } from '@/services/lookupService';
import {
  VENDOR_PERSON_IDENTITY_FIELDS, VENDOR_PERSON_DETAIL_FIELDS,
  VENDOR_ORG_IDENTITY_FIELDS, VENDOR_ORG_LIFECYCLE_FIELDS,
  VENDOR_CONTACT_FIELDS, VENDOR_CONTACT_POINT_FIELDS, VENDOR_IDENTIFIER_FIELDS,
  VENDOR_RECOGNITION_FIELDS, VENDOR_COMMERCE_FIELDS, VENDOR_COMPLIANCE_FIELDS,
} from '@/lib/vendorForm';
import { ACCEPTED_PAYMENT_METHODS, type AcceptedPaymentMethod, type VendorType } from '@/types/vendor';
import { VendorSectionGrid } from './VendorFormFields';
import { AssociatedBrandsInput } from './AssociatedBrandsInput';

function SubGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-1 text-2xs font-semibold uppercase tracking-wider text-stone-400">
      {children}
    </p>
  );
}

function PaymentMethodsGroup({ value, set }: {
  value: AcceptedPaymentMethod[];
  set: (k: string, v: unknown) => void;
}) {
  const toggle = (method: AcceptedPaymentMethod) => {
    set(
      'accepted_payment_methods',
      value.includes(method) ? value.filter((m) => m !== method) : [...value, method],
    );
  };
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
      {ACCEPTED_PAYMENT_METHODS.map((method) => {
        const checked = value.includes(method);
        return (
          <div key={method} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id={`payment-method-${method}`}
              checked={checked}
              onChange={() => toggle(method)}
              className="h-4 w-4 shrink-0 cursor-pointer rounded border border-stone-300 bg-white accent-brand [color-scheme:light]"
              aria-label={method}
            />
            <label
              htmlFor={`payment-method-${method}`}
              className={cn(checkboxLabelCls, 'cursor-pointer select-none')}
            >
              {method}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function VendorFormBody({ vendorType, data, set, lookups, showErrors }: {
  vendorType: VendorType;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  showErrors: boolean;
}) {
  const associatedBrands = Array.isArray(data.associated_brands) ? (data.associated_brands as string[]) : [];
  const acceptedPaymentMethods = Array.isArray(data.accepted_payment_methods)
    ? (data.accepted_payment_methods as AcceptedPaymentMethod[])
    : [];

  let index = 0;

  return (
    <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
      {vendorType === 'Person' ? (
        <>
          <ModernSection title="Personal Identity" index={index++}>
            <VendorSectionGrid fields={VENDOR_PERSON_IDENTITY_FIELDS} data={data} set={set} maxCols={3} showErrors={showErrors} />
          </ModernSection>
          <ModernSection title="Personal Details" index={index++}>
            <VendorSectionGrid fields={VENDOR_PERSON_DETAIL_FIELDS} data={data} set={set} lookups={lookups} maxCols={3} showErrors={showErrors} />
          </ModernSection>
        </>
      ) : (
        <>
          <ModernSection title="Company Details" index={index++}>
            <VendorSectionGrid fields={VENDOR_ORG_IDENTITY_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
          </ModernSection>
          <ModernSection title="Company Lifecycle" index={index++}>
            <VendorSectionGrid fields={VENDOR_ORG_LIFECYCLE_FIELDS} data={data} set={set} maxCols={3} showErrors={showErrors} />
          </ModernSection>
        </>
      )}

      <ModernSection title="Contact & Location" index={index++}>
        <div className="space-y-4">
          <VendorSectionGrid fields={VENDOR_CONTACT_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
          <SubGroupLabel>Primary Contact Point</SubGroupLabel>
          <VendorSectionGrid fields={VENDOR_CONTACT_POINT_FIELDS} data={data} set={set} maxCols={3} showErrors={showErrors} />
        </div>
      </ModernSection>

      <ModernSection title="Business Identifiers" index={index++}>
        <VendorSectionGrid fields={VENDOR_IDENTIFIER_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
      </ModernSection>

      <ModernSection title="Brand & Recognition" index={index++}>
        <div className="space-y-4">
          <AssociatedBrandsInput
            value={associatedBrands}
            onChange={(brands) => set('associated_brands', brands)}
          />
          <VendorSectionGrid fields={VENDOR_RECOGNITION_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
        </div>
      </ModernSection>

      <ModernSection title="Commerce & Funding" index={index++}>
        <VendorSectionGrid fields={VENDOR_COMMERCE_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
      </ModernSection>

      {vendorType === 'Organization' && (
        <>
          <ModernSection title="Accepted Payment Methods" index={index++}>
            <PaymentMethodsGroup value={acceptedPaymentMethods} set={set} />
          </ModernSection>
          <ModernSection title="Compliance Policies" index={index}>
            <VendorSectionGrid fields={VENDOR_COMPLIANCE_FIELDS} data={data} set={set} maxCols={2} showErrors={showErrors} />
          </ModernSection>
        </>
      )}
    </div>
  );
}
