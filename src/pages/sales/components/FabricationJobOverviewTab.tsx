import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { FabricationJob } from '@/types/fabrication';
import { fmtDate } from './fabricationJobFormat';

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-500">—</span>}</div>
    </div>
  );
}

/** Read-only Overview tab body for the fabrication job detail page. */
export function FabricationJobOverviewTab({ job }: { job: FabricationJob }) {
  return (
    <>
      <ModernSection title="Sales Order" index={0}>
        <Link
          to={`/sales/sales_order/${job.salesOrderId}`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
        >
          <ShoppingCart className="size-3.5" />
          View Sales Order
        </Link>
      </ModernSection>
      <ModernSection title="Job Site" index={1}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadonlyField label="Site Contact" value={job.site.customerName} />
          <ReadonlyField label="Address" value={[job.site.addrLine1, job.site.addrLine2].filter(Boolean).join(', ')} />
          <ReadonlyField label="City" value={job.site.city} />
          <ReadonlyField label="Zip" value={job.site.zip} />
          <ReadonlyField label="Phone" value={job.site.phone} />
        </div>
      </ModernSection>
      <ModernSection title="Schedule" index={2}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadonlyField label="Template Date" value={job.templateDate ? fmtDate(job.templateDate) : undefined} />
          <ReadonlyField label="Fabrication Start" value={job.fabricationStart ? fmtDate(job.fabricationStart) : undefined} />
          <ReadonlyField label="Promised Install Date" value={job.promisedInstallDate ? fmtDate(job.promisedInstallDate) : undefined} />
          <ReadonlyField label="Actual Install Date" value={job.actualInstallDate ? fmtDate(job.actualInstallDate) : undefined} />
        </div>
      </ModernSection>
      {job.notes && (
        <ModernSection title="Notes" index={3}>
          <p className="text-xs text-stone-600 whitespace-pre-wrap">{job.notes}</p>
        </ModernSection>
      )}
    </>
  );
}
