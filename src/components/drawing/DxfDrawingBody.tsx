// The drawing of one uploaded DXF, or an honest message for every way a file
// can fail to open.

import { useQuery } from '@tanstack/react-query';
import { attachmentService, type Attachment } from '@/services/attachmentService';
import { MAX_DXF_PREVIEW_BYTES } from '@/lib/drawing/dxfFiles';
import { parseDxfScene } from '@/lib/drawing/dxfParseClient';
import { DxfTooComplexError, DxfUnreadableError } from '@/lib/drawing/dxfSceneTypes';
import { DxfMessage } from './DxfMessage';
import { DxfNotShownNote } from './DxfNotShownNote';
import { DxfViewer } from './DxfViewer';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const TOO_LARGE_MESSAGE = 'This drawing is too large to preview. Download it to open it in your CAD software.';

export function DxfDrawingBody({ orderId, attachment, label }: { orderId: string; attachment: Attachment; label: string }) {
  const openable = attachment.status === 'clean' && attachment.sizeBytes <= MAX_DXF_PREVIEW_BYTES;
  const { data: scene, error, isLoading, refetch } = useQuery({
    queryKey: ['dxf-scene', orderId, attachment.id],
    queryFn: async ({ signal }) => parseDxfScene(
      await attachmentService.fetchAttachmentBytes(orderId, attachment.id, signal),
      signal,
    ),
    enabled: openable,
    retry: false,
    // An attachment's contents never change: a re-upload is a new attachment.
    staleTime: Infinity,
  });

  if (attachment.status === 'pending') return <DxfMessage>Scanning this file…</DxfMessage>;
  if (attachment.status !== 'clean') return <DxfMessage>This file can&apos;t be opened.</DxfMessage>;
  if (!openable || error instanceof DxfTooComplexError) return <DxfMessage>{TOO_LARGE_MESSAGE}</DxfMessage>;
  if (isLoading) return <DxfMessage>Loading drawing…</DxfMessage>;
  if (error instanceof DxfUnreadableError) {
    return <DxfMessage>Couldn&apos;t read this file. It may be damaged or not a text DXF. You can still download it.</DxfMessage>;
  }
  if (error || !scene) {
    return (
      <DxfMessage>
        <p>Couldn&apos;t load this file.</p>
        <button
          type="button"
          aria-label="Try again"
          onClick={() => void refetch()}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}
        >
          Try again
        </button>
      </DxfMessage>
    );
  }
  if (scene.paths.length === 0 && scene.texts.length === 0) {
    return (
      <DxfMessage>
        <p>This file has nothing to show.</p>
        <DxfNotShownNote unsupported={scene.unsupported} />
      </DxfMessage>
    );
  }

  return (
    <div>
      <DxfViewer scene={scene} label={label} />
      <DxfNotShownNote unsupported={scene.unsupported} />
    </div>
  );
}
