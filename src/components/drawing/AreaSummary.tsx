// The sq ft icon's hover breakdown (DrawingStatusBar): Total Project, each
// Area, and each Piece's own Countertop and Fabrication sq ft. Fabrication
// is Countertop sq ft marked up by the tenant's own Company Preferences
// percentage (Configuration -> Company Info -> Company Preferences); no
// Profile figure yet — the app has nothing to compute one from.

import { useQuery } from '@tanstack/react-query';
import { companyProfileService } from '@/services/companyProfileService';
import { DEFAULT_FABRICATION_PERCENT } from '@/types/companyProfile';
import { measurementSummary, type MeasurementRow } from '@/lib/drawing/measurementSummary';
import { useDrawingEditor } from './DrawingEditorContext';

const SQ_FT_DECIMALS = 3;

function fmt(value: number): string {
  return value.toFixed(SQ_FT_DECIMALS);
}

function MeasurementRowLine({ row, emphasis }: { row: MeasurementRow; emphasis?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${emphasis ? 'font-semibold text-white' : 'text-stone-300'}`}>
      <span className="truncate">{row.label}</span>
      <span className="flex shrink-0 gap-4 tabular-nums">
        <span className="w-16 text-right">{fmt(row.countertopSqFt)}</span>
        <span className="w-16 text-right">{fmt(row.fabricationSqFt)}</span>
      </span>
    </div>
  );
}

export function AreaSummary() {
  const { state } = useDrawingEditor();
  const profileQ = useQuery({ queryKey: ['company-profile'], queryFn: companyProfileService.get });
  const fabricationPercent = profileQ.data?.fabricationPercent ?? DEFAULT_FABRICATION_PERCENT;
  const summary = measurementSummary(state.present.areas, fabricationPercent);

  return (
    <div className="w-72 rounded-lg bg-stone-900 p-3 text-xs text-white shadow-xl">
      <p className="mb-2 font-semibold">Total Project Measurements (sq ft)</p>
      <div className="mb-1 flex items-baseline justify-between gap-6 text-2xs uppercase tracking-wide text-stone-500">
        <span>&nbsp;</span>
        <span className="flex shrink-0 gap-4">
          <span className="w-16 text-right">Countertop</span>
          <span className="w-16 text-right">Fabrication</span>
        </span>
      </div>
      <MeasurementRowLine row={summary} emphasis />
      {summary.areas.map((area) => (
        <div key={area.id} className="mt-2 border-t border-stone-700 pt-2">
          <MeasurementRowLine row={{ ...area, label: `Area: ${area.label}` }} />
          {area.pieces.map((piece) => (
            <div key={piece.id} className="pl-3">
              <MeasurementRowLine row={{ ...piece, label: `Piece: ${piece.label}` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
