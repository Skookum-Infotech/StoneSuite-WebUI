import { useState } from 'react';
import { UserPlus, Plus } from 'lucide-react';
import { CustomerTable } from './components/CustomerTable';
import { AddCustomerModal } from './components/AddCustomerModal';

export type CustomerStatus =
  | 'Draft'
  | 'Pending Setup'
  | 'In Review'
  | 'Active';

export type Customer = {
  id: string;
  companyName: string;
  legalName: string;
  country: string;
  currency: string;
  timezone: string;
  superAdminName: string;
  superAdminEmail: string;
  status: CustomerStatus;
};

const initialCustomers: Customer[] = [
  {
    id: 'CUS-001',
    companyName: 'Acme Retail',
    legalName: 'Acme Retail Pvt Ltd',
    country: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    superAdminName: 'Rahul Menon',
    superAdminEmail: 'rahul@acme.com',
    status: 'Pending Setup',
  },
];

export default function OnboardingPage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddCustomer = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-8 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c2f589]/20 text-[#719c3b]">
              <UserPlus className="size-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                Customer Onboarding
              </h1>
              <p className="text-sm text-stone-500">
                Register and configure new customers in the workspace.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#719c3b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5f8431]"
          >
            <Plus className="size-4" />
            Add New Customer
          </button>
        </div>

        <div className="mt-8 border-t border-stone-100 pt-6 flex-1 flex flex-col min-h-0">
          <CustomerTable customers={customers} />
        </div>
      </div>

      <AddCustomerModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddCustomer}
      />
    </div>
  );
}