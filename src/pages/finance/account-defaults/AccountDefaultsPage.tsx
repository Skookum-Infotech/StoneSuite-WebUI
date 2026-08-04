import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { parseCoaError } from '@/lib/coaErrors';
import { AccountPicker, type AccountRef } from '@/components/finance/AccountPicker';
import type { DefaultSlot } from '@/types/chartOfAccounts';

// The 19 named posting-purpose slots. Gated on chart_of_account:configure at
// the route level (PermissionGuard in router/index.tsx) — a different, higher
// grant than chart_of_account:update, since repointing where every future
// transaction posts is a higher-trust act than renaming an account.
export default function AccountDefaultsPage() {
  const location = useLocation();
  const { data: slots = [], isLoading, isError, error } = useQuery({
    queryKey: ['coa-defaults'],
    queryFn: chartOfAccountsService.getDefaults,
  });

  // Supports the deep link BlockingSlotsDialog offers: /finance/account-defaults#slot-<key>.
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.hash, slots.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0 overflow-y-auto modal-scrollbar">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
            <Settings2 className="size-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Default Accounts</h1>
            <p className="text-sm text-stone-500">
              Where each posting purpose lands. Clearing a picker unsets the slot.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Spinner label="Loading default accounts…" />
        ) : isError ? (
          <ErrorNote>{apiErrorMessage(error, 'Failed to load default accounts.')}</ErrorNote>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {slots.map((slot) => <SlotRow key={slot.key} slot={slot} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({ slot }: { slot: DefaultSlot }) {
  const queryClient = useQueryClient();
  const [localError, setLocalError] = useState<string | null>(null);

  const value: AccountRef | null = slot.accountId
    ? { id: slot.accountId, code: slot.accountCode ?? '', name: slot.accountName ?? '' }
    : null;

  const repoint = useMutation({
    mutationFn: (accountId: string) => chartOfAccountsService.repointDefault(slot.key, accountId),
    onSuccess: () => {
      setLocalError(null);
      queryClient.invalidateQueries({ queryKey: ['coa-defaults'] });
    },
    onError: (err) => setLocalError(parseCoaError(err, 'Failed to update the default account.').message),
  });

  return (
    <div id={`slot-${slot.key}`} className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 scroll-mt-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-900">{slot.label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{slot.description}</p>
      </div>
      <div className="mt-3">
        <AccountPicker
          value={value}
          onChange={(account) => repoint.mutate(account?.id ?? '')}
          options={{ ariaLabel: `Default account for ${slot.label}` }}
        />
      </div>
      {localError && <p className="mt-2 text-2xs text-destructive">{localError}</p>}
      {repoint.isPending && <p className="mt-2 text-2xs text-stone-400">Saving…</p>}
    </div>
  );
}
