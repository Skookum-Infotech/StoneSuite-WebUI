import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { validateDocumentFile } from '@/lib/documentUploadValidation';

interface DropOverlayProps {
  /** Why a drop can't start the flow right now (AI off, no permission, a
   *  document already in progress), or undefined when it can. While blocked
   *  the drop is still swallowed — otherwise the browser would navigate away
   *  to the file and lose the page — and this message is toasted instead. */
  blockedReason?: string;
  /** What the dropped file becomes, e.g. "Sales Order". */
  documentLabel: string;
  /** Receives a dropped file once it passed client-side validation. */
  onFileDropped: (file: File) => void;
}

function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/** Full-page drag-and-drop target. Mouse-only by nature: keyboard users reach
 *  the same flow through the Upload button, so the overlay is hidden from
 *  assistive tech and never takes focus. */
export function DropOverlay({ blockedReason, documentLabel, onFileDropped }: DropOverlayProps): React.JSX.Element | null {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element; a counter avoids flicker.
  const depth = useRef(0);

  useEffect(() => {
    const blocked = blockedReason !== undefined;
    const onEnter = (e: DragEvent) => {
      if (!carriesFiles(e) || blocked) return;
      depth.current += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (carriesFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (blocked) {
        if (blockedReason) toast.error(blockedReason);
        return;
      }
      const files = e.dataTransfer?.files;
      const file = files?.[0];
      if (!file) return;
      if (files.length > 1) toast.info(`Only ${file.name} was used — drop one document at a time.`);
      const error = validateDocumentFile(file);
      if (error) toast.error(error);
      else onFileDropped(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      depth.current = 0;
      setDragging(false);
    };
  }, [blockedReason, onFileDropped]);

  if (!dragging) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="document-drop-overlay"
      className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-stone-950/40 p-6 backdrop-blur-[2px]"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-white dark:bg-stone-900 px-10 py-12 text-center shadow-2xl motion-safe:animate-pulse">
        <FileUp className="size-8 text-brand-dark" aria-hidden="true" />
        <p className="text-base font-bold text-stone-900 dark:text-stone-100">Drop a customer PO to create a {documentLabel}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">PDF or Word (.docx), up to 10 MB</p>
      </div>
    </div>
  );
}
