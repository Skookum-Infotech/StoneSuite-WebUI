import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Landmark, Hash, ArrowLeftRight } from 'lucide-react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import type { CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { PaymentDetails } from '@/types/companyProfile';
import { CompanyInfoTextField, CompanyInfoReadonlyField, type CompanyInfoFieldSpec } from './CompanyInfoTextField';

// Bank details printed on invoices, quotes, estimates and sales orders. Free
// text because account formats differ by country; all three are optional and a
// blank one is left off the document.
const PAYMENT_FIELDS: { key: keyof PaymentDetails; spec: CompanyInfoFieldSpec }[] = [
  { key: 'bankName', spec: { id: 'cp-bank-name', label: 'Bank Name', icon: Landmark, placeholder: 'e.g. Chase Bank' } },
  { key: 'accountNumber', spec: { id: 'cp-account-number', label: 'Account Number', icon: Hash, placeholder: 'e.g. 000123456789' } },
  { key: 'routingNumber', spec: { id: 'cp-routing-number', label: 'Wire Routing Number', icon: ArrowLeftRight, placeholder: 'e.g. 021000021' } },
];

// Configuration -> Company Info -> Payment Details section: a read-only box per
// field in view mode, the matching input in edit mode (same dispatch as the
// tab's other sections, so view and edit never drift into two field lists).
export function PaymentDetailsSection({
  index, isEditing, values, register, errors,
}: {
  index: number;
  isEditing: boolean;
  values: CompanyProfileFormValues;
  register: UseFormRegister<CompanyProfileFormValues>;
  errors: FieldErrors<CompanyProfileFormValues>;
}) {
  return (
    <ModernSection title="Payment Details" index={index}>
      <p className="mb-4 text-xs text-stone-500">
        Printed on invoices, quotes, estimates and sales orders so customers know where to send payment.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
        {PAYMENT_FIELDS.map(({ key, spec }) =>
          isEditing ? (
            <CompanyInfoTextField
              key={spec.id}
              field={spec}
              registration={register(`paymentDetails.${key}`)}
              error={errors.paymentDetails?.[key]?.message}
            />
          ) : (
            <CompanyInfoReadonlyField key={spec.id} field={spec} value={values.paymentDetails?.[key] ?? ''} />
          ),
        )}
      </div>
    </ModernSection>
  );
}
