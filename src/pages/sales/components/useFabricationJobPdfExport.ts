import { useState } from 'react';
import { apiErrorMessage } from '@/api/tenantClient';
import { APPROVAL_STATUS_LABELS } from '@/lib/fabricationForm';
import type { FabricationJob } from '@/types/fabrication';
import { fmtDate } from './fabricationJobFormat';

/** PDF export state and handler for a fabrication job. */
export function useFabricationJobPdfExport(job: FabricationJob, salesOrderNumber?: string) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  async function handleExportPdf() {
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'fabrication_job',
        title: job.jobNumber || 'Fabrication Job',
        recordNumber: job.jobNumber,
        statusLabel: job.status,
        customerName: job.customer.name,
        notesText: job.notes || undefined,
        sections: [
          {
            title: 'Sales Order',
            rows: [['Sales Order #', salesOrderNumber || '']],
          },
          {
            title: 'Job Site',
            rows: [
              ['Site Contact', job.site.customerName || ''],
              ['Address', [job.site.addrLine1, job.site.addrLine2].filter(Boolean).join(', ')],
              ['City', job.site.city || ''],
              ['Zip', job.site.zip || ''],
              ['Phone', job.site.phone || ''],
            ],
          },
          {
            title: 'Schedule',
            rows: [
              ['Template Date', job.templateDate ? fmtDate(job.templateDate) : ''],
              ['Fabrication Start', job.fabricationStart ? fmtDate(job.fabricationStart) : ''],
              ['Promised Install Date', job.promisedInstallDate ? fmtDate(job.promisedInstallDate) : ''],
              ['Actual Install Date', job.actualInstallDate ? fmtDate(job.actualInstallDate) : ''],
              ['Approval Status', job.approvalStatus !== 'none' ? APPROVAL_STATUS_LABELS[job.approvalStatus] : ''],
            ],
          },
        ],
        itemsTable: {
          title: 'Pieces',
          head: ['#', 'Piece Name', 'Type', 'L (mm)', 'W (mm)', 'Thickness (mm)', 'Sinks', 'Cooktops', 'Seams', 'Status'],
          rows: (job.pieces ?? []).map((piece) => [
            String(piece.pieceNumber),
            piece.pieceName || '—',
            piece.pieceType || '—',
            String(piece.lengthMm),
            String(piece.widthMm),
            String(piece.thicknessMm),
            String(piece.sinkCutoutCount),
            String(piece.cooktopCutoutCount),
            String(piece.seamCount),
            piece.status,
          ]),
          numericFrom: 3,
        },
      });
    } catch (err) {
      setExportPdfError(apiErrorMessage(err, 'Failed to export PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  return { exportingPdf, exportPdfError, handleExportPdf };
}
