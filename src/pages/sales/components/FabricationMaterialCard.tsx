import { CheckCircle2, AlertTriangle, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  basisLabel, coveragePercent, materialState, missingFromStock, type MaterialState,
} from '@/lib/fabricationMaterials';
import { formatStockQty } from '@/lib/stockShortage';
import type { FabricationMaterial } from '@/types/fabrication';

import { buttonVariants } from '@/components/ui/button';
const STATE_STYLE: Record<MaterialState, { bar: string; chip: string; label: string }> = {
  covered: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: 'Covered' },
  short: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700', label: 'Short' },
  unstocked: { bar: 'bg-red-400', chip: 'bg-red-50 text-danger-ink', label: 'Not enough in stock' },
};

// One slab material on a job: how much the blueprint needs, how much is
// allocated, and what to do about the gap — allocate from stock, or restock.
export function FabricationMaterialCard({ material, onAllocate, onRestock }: {
  material: FabricationMaterial;
  /** Opens the slab picker; omit when the user cannot allocate. */
  onAllocate?: () => void;
  /** Starts a requisition for what stock lacks; omit when the user cannot. */
  onRestock?: () => void;
}) {
  const state = materialState(material);
  const style = STATE_STYLE[state];
  const missing = missingFromStock(material);
  const qty = (v: number) => formatStockQty(v, material.unitCode);

  return (
    <section
      aria-label={`${material.name} material`}
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-stone-900">{material.name}</h4>
          <p className="font-mono type-helper">{material.sku}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 type-pill', style.chip)}>
          {state === 'covered' ? <CheckCircle2 className="size-3" aria-hidden="true" />
            : state === 'short' ? <AlertTriangle className="size-3" aria-hidden="true" />
            : <PackageX className="size-3" aria-hidden="true" />}
          {style.label}{state === 'short' && ` by ${qty(material.shortfall)}`}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="type-overline">Ordered</dt>
          <dd className="text-sm font-bold tabular-nums text-stone-900">{qty(material.ordered)}</dd>
          <dd className="type-subline">On the sales order</dd>
        </div>
        <div>
          <dt className="type-overline">Needed</dt>
          <dd className="text-sm font-bold tabular-nums text-stone-900">{qty(material.needed)}</dd>
          <dd className="type-subline">{basisLabel(material)}</dd>
        </div>
        <div>
          <dt className="type-overline">Allocated</dt>
          <dd className="text-sm font-bold tabular-nums text-stone-900">{qty(material.allocated)}</dd>
          {material.consumed > 0 && <dd className="type-subline">{qty(material.consumed)} already cut</dd>}
        </div>
        <div>
          <dt className="type-overline">In stock</dt>
          <dd className="text-sm font-bold tabular-nums text-stone-900">{qty(material.inStock)}</dd>
          <dd className="type-subline">Unallocated</dd>
        </div>
      </dl>

      <div
        role="img"
        aria-label={`${Math.round(coveragePercent(material))}% of what is needed is allocated`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"
      >
        <div className={cn('h-full rounded-full transition-all', style.bar)} style={{ width: `${coveragePercent(material)}%` }} />
      </div>

      {state === 'unstocked' && (
        <p role="status" className="mt-2 type-error">
          Only {qty(material.inStock)} is in stock, {qty(missing)} short of what is still needed. Receive more stock
          before this job can be cut.
        </p>
      )}
      {state !== 'covered' && material.basis === 'order' && (
        <p className="mt-2 type-helper">
          No pieces have been drawn yet, so this is the ordered quantity. Once the blueprint is entered, the need
          follows the pieces.
        </p>
      )}

      {(onAllocate || (onRestock && missing > 0)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onAllocate && (
            <button
              type="button"
              onClick={onAllocate}
              aria-label={`Allocate slabs of ${material.name}`}
              className={cn(buttonVariants(), 'active:scale-95')}
            >
              Allocate slabs
            </button>
          )}
          {onRestock && missing > 0 && (
            <button
              type="button"
              onClick={onRestock}
              aria-label={`Create a requisition for ${material.name}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              Create requisition
            </button>
          )}
        </div>
      )}
    </section>
  );
}
