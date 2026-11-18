import { cn } from '@/lib/utils';
import type { FabricationJobPiece } from '@/types/fabrication';

// Read-only pieces table — used by the Edit and Detail pages, since the
// backend has no endpoint to add/edit pieces once a job exists (see
// FabricationPiecesEditor's doc comment; that editable version is Add-page
// only).
export function FabricationPiecesTable({ pieces }: { pieces: FabricationJobPiece[] }) {
  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-left type-cell">
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
              <th key={h.label} className={cn('px-3 py-2.5 whitespace-nowrap type-th', h.right && 'text-right')}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {pieces.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
              <td className="type-cell px-3 py-2.5 tabular-nums">{p.pieceNumber}</td>
              <td className="type-cell px-3 py-2.5 font-medium">{p.pieceName || <span className="text-ink-muted">—</span>}</td>
              <td className="type-cell px-3 py-2.5">{p.pieceType || '—'}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.lengthMm}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.widthMm}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.thicknessMm}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.sinkCutoutCount}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.cooktopCutoutCount}</td>
              <td className="type-cell px-3 py-2.5 tabular-nums text-right">{p.seamCount}</td>
              <td className="type-cell px-3 py-2.5">{p.status || '—'}</td>
            </tr>
          ))}
          {pieces.length === 0 && (
            <tr><td colSpan={10} className="type-cell py-8 text-center">No pieces on this job.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
