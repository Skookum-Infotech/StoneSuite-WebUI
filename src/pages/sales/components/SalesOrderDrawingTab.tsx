// The Sales Order detail page's Drawing tab: one sub-tab per uploaded DXF
// (viewed read-only), plus the drawing made in the editor if there is one.
// Draw goes to the full editor at /sales/sales_order/:id/drawing (also
// reachable from Quick Actions).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PencilRuler } from 'lucide-react';
import { attachmentService } from '@/services/attachmentService';
import { drawingService } from '@/services/drawingService';
import { DrawingPreview } from '@/components/drawing/DrawingPreview';
import { DxfFilePanel } from '@/components/drawing/DxfFilePanel';
import { DxfUploadButton } from '@/components/drawing/DxfUploadButton';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { useDxfUpload } from '@/hooks/useDxfUpload';
import { dxfTabLabels, isDxfFileName } from '@/lib/drawing/dxfFiles';

const DRAWN_TAB = 'drawn';

export function SalesOrderDrawingTab({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const { upload, isUploading } = useDxfUpload(orderId, (attachment) => setSelected(attachment.id));

  const drawingQuery = useQuery({
    queryKey: ['drawing', orderId],
    queryFn: () => drawingService.getDrawing(orderId),
    retry: false,
  });
  const filesQuery = useQuery({
    queryKey: ['record-attachments', orderId],
    queryFn: () => attachmentService.listAttachments(orderId),
  });

  const files = useMemo(
    () => (filesQuery.data ?? [])
      .filter((attachment) => isDxfFileName(attachment.fileName))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [filesQuery.data],
  );
  const labels = useMemo(() => dxfTabLabels(files), [files]);
  const drawing = drawingQuery.data;

  if (drawingQuery.isLoading || filesQuery.isLoading) return <p className="text-xs text-stone-500">Loading…</p>;

  const tabKeys = [...files.map((file) => file.id), ...(drawing ? [DRAWN_TAB] : [])];

  if (tabKeys.length === 0) {
    const failed = drawingQuery.isError || filesQuery.isError;
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-stone-200 py-10 text-center">
        {failed
          ? <p className="text-xs text-destructive">Failed to load the drawing.</p>
          : <p className="text-xs text-stone-500">No drawing yet</p>}
        {canEdit && (
          <div className="flex items-center gap-2">
            <DxfUploadButton onFiles={upload} busy={isUploading} />
            <button
              type="button"
              aria-label="Draw"
              onClick={() => navigate(`/sales/sales_order/${orderId}/drawing`)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900"
            >
              <PencilRuler className="size-3.5" /> Draw
            </button>
          </div>
        )}
      </div>
    );
  }

  // Falls through to the first tab when the selected file has just been deleted.
  const active = selected && tabKeys.includes(selected) ? selected : tabKeys[0];
  const activeFile = files.find((file) => file.id === active);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 overflow-x-auto modal-scrollbar">
          <div role="tablist" aria-label="Drawings on this order" className={TAB_LIST_CLASS}>
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={file.id === active}
                aria-label={labels[file.id]}
                title={labels[file.id]}
                onClick={() => setSelected(file.id)}
                className={tabClass(file.id === active)}
              >
                <span className="max-w-48 truncate">{labels[file.id]}</span>
              </button>
            ))}
            {drawing && (
              <button
                type="button"
                role="tab"
                aria-selected={active === DRAWN_TAB}
                aria-label="Drawn"
                onClick={() => setSelected(DRAWN_TAB)}
                className={tabClass(active === DRAWN_TAB)}
              >
                Drawn
              </button>
            )}
          </div>
        </div>
        {canEdit && <DxfUploadButton onFiles={upload} busy={isUploading} />}
      </div>
      {filesQuery.isError && <p className="text-xs text-destructive">Failed to load the uploaded files.</p>}
      {activeFile
        ? <DxfFilePanel key={activeFile.id} orderId={orderId} attachment={activeFile} label={labels[activeFile.id]} canEdit={canEdit} />
        : drawing && <DrawingPreview drawing={drawing} />}
    </div>
  );
}
