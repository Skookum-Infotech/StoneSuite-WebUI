import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { formatUnitArea } from '@/lib/unitConsumption';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

const OFFCUT_LIMIT = 100;

// The pieces that came out of cutting a unit, each a link to its own page. It
// lists every piece cut from it, including any too small to keep (those show as
// scrapped) — the cut's full result, not only what went back into stock.
export function UnitOffcutsList({ parentId }: { parentId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    // Under the 'inventory-units' root so a cut, scrap or receipt refreshes it.
    queryKey: ['inventory-units', 'offcuts', parentId],
    queryFn: () => inventoryUnitService.searchUnits({
      filters: [{ field: 'parent_id', op: 'eq', value: parentId }],
      sort: [{ field: 'serial', dir: 'asc' }],
      limit: OFFCUT_LIMIT,
    }),
  });

  if (isLoading) return <Spinner label="Loading offcuts…" />;
  if (error) return <ErrorNote>{apiErrorMessage(error, 'Failed to load offcuts.')}</ErrorNote>;
  const offcuts = data?.records ?? [];
  if (offcuts.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full min-w-[420px] text-left text-xs" aria-label="Pieces cut from this unit">
        <thead className="border-b border-stone-200 bg-table-header">
          <tr>
            <th className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-stone-500">Offcut</th>
            <th className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-stone-500">Size (mm)</th>
            <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Area</th>
            <th className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {offcuts.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/unit/${o.id}`)}
                  aria-label={`Open offcut ${o.serial}`}
                  className="font-mono font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                >
                  {o.serial}
                </button>
              </td>
              <td className="px-3 py-2 tabular-nums text-stone-600">{o.lengthMm} × {o.widthMm}</td>
              <td className="px-3 py-2 text-right tabular-nums text-stone-700 whitespace-nowrap">{formatUnitArea(o.area, o.areaUnitCode)}</td>
              <td className="px-3 py-2 capitalize text-stone-500">{o.status.replace('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
