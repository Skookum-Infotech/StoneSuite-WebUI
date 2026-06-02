import { useState } from 'react';
import { UserPlus, Plus, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CustomerTable } from './components/CustomerTable';
import { InviteCustomerModal } from './components/InviteCustomerModal';
import { customerService } from '@/services/customerService';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.list,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <UserPlus className="size-4.5" />
            </div>

            <div>
              <h1 className="text-base font-bold tracking-tight text-stone-900">
                Customer Onboarding
              </h1>
              <p className="text-xs text-stone-500">
                Register and configure new customers in the workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-blue-100 cursor-pointer"
            >
              <Mail className="size-3.5" />
              Invite Customer
            </button>

            <button
              onClick={() => navigate('/customer/onboarding/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand/50 cursor-pointer"
            >
              <Plus className="size-3.5" />
              Onboard Customer
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="text-xs text-red-500 mb-3">Failed to load customers. Is the backend running?</p>
          )}
          <CustomerTable customers={customers} isLoading={isLoading} />
        </div>
      </div>

      {showInviteModal && (
        <InviteCustomerModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
