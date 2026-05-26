import { X } from 'lucide-react';
import type { Customer } from '../OnboardingPage';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (customer: Customer) => void;
};

export function AddCustomerModal({ open, onClose, onSubmit }: Props) {
  if (!open) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    onSubmit({
      id: `CUS-${Date.now()}`,
      companyName: String(form.get('companyName')),
      legalName: String(form.get('legalName')),
      country: String(form.get('country')),
      currency: String(form.get('currency')),
      timezone: String(form.get('timezone')),
      superAdminName: String(form.get('superAdminName')),
      superAdminEmail: String(form.get('superAdminEmail')),
      status: 'Draft',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto scrollbar-hide rounded-xl bg-white p-6 shadow-xl border border-stone-900 modal-scrollbar">
        <div className="mb-6 flex items-center justify-between">
          <div >
            <h2 className="text-xl font-bold text-stone-900">
              Add New Customer
            </h2>
            <p className="text-sm text-stone-500">
              Enter the required onboarding details.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section title="Company Information">
            <Input name="companyName" label="Company Name" required />
            <Input name="legalName" label="Legal Name" required />
            <Input name="website" label="Website" required />
            <Input name="country" label="Country" required />
            <Input name="currency" label="Currency" required />
            <Input name="timezone" label="Time Zone" required />
            <Input name="taxId" label="Tax/VAT ID or EIN" />
          </Section>

          <Section title="Address Information">
            <Input name="billingAddress" label="Billing Address" required />
            <Input name="shippingAddress" label="Shipping Address" />
            <Input name="returnAddress" label="Return Address" />
          </Section>

          <Section title="Super Admin Contact">
            <Input name="superAdminName" label="Full Name" required />
            <Input name="superAdminEmail" label="Email" type="email" required />
            <Input name="superAdminPhone" label="Phone" />
            <Input name="superAdminJobTitle" label="Job Title" />
          </Section>

          <Section title="Finance Contact">
            <Input name="financeName" label="Name" />
            <Input name="financeEmail" label="Email" type="email" />
            <Input name="financePhone" label="Phone" />
          </Section>

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-2xl bg-[#719c3b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5f8431]"
            >
              Create Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-stone-800">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Input({
  label,
  name,
  type = 'text',
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-stone-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#719c3b] focus:ring-4 focus:ring-[#c2f589]/30"
      />
    </label>
  );
}