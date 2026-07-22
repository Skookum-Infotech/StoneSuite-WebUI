import { cn } from '@/lib/utils';
import type { FabricationJobPiece } from '@/types/fabrication';

// Read-only pieces table — used by the Edit and Detail pages, since the
// backend has no endpoint to add/edit pieces once a job exists (see
// FabricationPiecesEditor's doc comment; that editable version is Add-page
// only).
export function FabricationPiecesTable({ pieces }: { pieces: FabricationJobPiece[] }) {
  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="divide-x divide-stone-200">
            {[
              { label: '#' },
              { label: 'Piece Name' },
              { label: 'Type' },
              { label: 'Length (mm)', right: true },
              { label: 'Width (mm)', right: true },
              { label: 'Thickness (mm)', right: true },
              { label: 'Sinks', right: true },
              { label: 'Cooktops', right: true },
              { label: 'Seams', right: true },
              { label: 'Status' },
            ].map((h) => (
              <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {pieces.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
              <td className="px-3 py-2.5 text-stone-400 tabular-nums">{p.pieceNumber}</td>
              <td className="px-3 py-2.5 font-medium text-stone-800">{p.pieceName || <span className="text-stone-300">—</span>}</td>
              <td className="px-3 py-2.5 text-stone-500">{p.pieceType || '—'}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{p.lengthMm}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{p.widthMm}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{p.thicknessMm}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{p.sinkCutoutCount}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{p.cooktopCutoutCount}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{p.seamCount}</td>
              <td className="px-3 py-2.5 text-stone-500">{p.status || '—'}</td>
            </tr>
          ))}
          {pieces.length === 0 && (
            <tr><td colSpan={10} className="py-8 text-center text-stone-400">No pieces on this job.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
