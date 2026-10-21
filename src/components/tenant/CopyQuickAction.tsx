import { Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { copyPath } from '@/lib/recordCopy';

interface CopyQuickActionProps {
  /** Human name of the record type, lower case, e.g. "sales order". */
  recordLabel: string;
  /** The module's Add-page route, e.g. "/sales/sales_order/new". */
  addPath: string;
  sourceId: string;
}

/** Quick Actions row that opens the module's Add page pre-filled from this
 *  record. Nothing is created until that form is saved. */
export function CopyQuickAction({ recordLabel, addPath, sourceId }: CopyQuickActionProps) {
  const navigate = useNavigate();
  const label = `Copy ${recordLabel}`;
  return (
    <button
      type="button"
      onClick={() => navigate(copyPath(addPath, sourceId))}
      aria-label={label}
      className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
    >
      <Copy className="size-4 text-stone-400 shrink-0" />
      {label}
    </button>
  );
}
