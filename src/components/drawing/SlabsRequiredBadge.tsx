// "Slabs required: 3" — the estimate of how many slabs the whole drawing needs, with a
// warning mark when something is bigger than a slab. The title says what it is built
// from, since the figure depends on the slab size (a held slab's, or an assumed jumbo).

import { AlertTriangle } from 'lucide-react';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';
import { useSlabRequirement } from './useSlabEstimate';

export function SlabsRequiredBadge({ className }: { className: string }) {
  const { state } = useDrawingEditor();
  const { required, oversize, slab, assumed } = useSlabRequirement();
  const { displayUnit, fractionDenominator } = state.present;
  const size = `${formatLength(slab.lengthMm, displayUnit, fractionDenominator)} × ${formatLength(slab.widthMm, displayUnit, fractionDenominator)}`;
  const basis = assumed
    ? `Estimated on ${size} slabs. Add a slab from Inventory to use its size.`
    : `Estimated on ${size} slabs, the biggest one on this order.`;
  const warning = oversize.length > 0
    ? ` ${oversize.length} ${oversize.length === 1 ? 'piece is' : 'pieces are'} bigger than a whole slab and not counted.`
    : '';

  return (
    <span role="status" aria-label={`Slabs required: ${required}`} title={`${basis}${warning}`} className={className}>
      Slabs required: {required}
      {oversize.length > 0 && <AlertTriangle className="size-3.5 text-warning-ink" aria-hidden="true" />}
    </span>
  );
}
