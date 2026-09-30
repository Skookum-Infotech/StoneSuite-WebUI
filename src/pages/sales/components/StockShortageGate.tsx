import { useState } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { openRequisitionForShortages } from '@/lib/requisitionPrefill';
import { stockShortagesFrom } from '@/lib/stockShortage';
import { StockShortageDialog } from './StockShortageDialog';

// Drop-in for a Sales Order save: given the save's error, shows the "not enough
// stock" dialog when — and only when — that is what the error is. Any other error
// is left to the page's own error banner. Closing it dismisses that one failure;
// the next refused save opens it again.
export function StockShortageGate({ error }: { error: unknown }) {
  const shortages = stockShortagesFrom(error);
  const [dismissed, setDismissed] = useState<unknown>(null);
  const { hasPermission, isLoading } = useUserPermissions();

  if (!shortages || dismissed === error) return null;
  return (
    <StockShortageDialog
      shortages={shortages}
      onClose={() => setDismissed(error)}
      onRestock={!isLoading && hasPermission('requisition', 'create') ? () => openRequisitionForShortages(shortages) : undefined}
    />
  );
}
