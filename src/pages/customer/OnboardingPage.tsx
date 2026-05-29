import { useState } from 'react';
import { UserPlus, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomerTable } from './components/CustomerTable';
import { AddCustomerModal } from './components/AddCustomerModal';
import { customerService } from '@/services/customerService';
import type { CreateCustomerPayload } from '@/types/customer';

export default function OnboardingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.list,
  });

  const { mutate: createCustomer, isPending } = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => customerService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
    },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-8 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand text-stone-950 py-2.5 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand/50 hover:text-stone-950 cursor-pointer"
          >
            <Plus className="size-4" />
            Add New Customer
          </button>
        </div>

        <div className="mt-8 border-t border-stone-100 pt-6 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="text-sm text-red-500 mb-4">Failed to load customers. Is the backend running?</p>
          )}
          <CustomerTable customers={customers} isLoading={isLoading} />
        </div>
      </div>

      <AddCustomerModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={createCustomer}
        isPending={isPending}
      />
    </div>
  );
}
