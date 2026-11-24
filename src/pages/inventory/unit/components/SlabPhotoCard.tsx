import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import {
  ACCEPTED_SLAB_PHOTO_EXTENSIONS,
  ACCEPTED_SLAB_PHOTO_MIME_TYPES,
  validateSlabPhotoFile,
} from '@/lib/slabPhotoValidation';

import { buttonVariants } from '@/components/ui/button';
const slabPhotoQueryKey = (unitId: string) => ['inventory-unit-photo', unitId] as const;

// The presigned link lives ten minutes server-side; refetch well inside that.
const PHOTO_URL_STALE_MS = 5 * 60 * 1000;

interface SlabPhotoCardProps {
  unitId: string;
  /** Whether the viewer may upload, replace or remove the photo (inventory_unit:update). */
  canEdit: boolean;
}

// The picture of this one slab. It is laid under the pieces on a sales order's
// Material tab and later becomes the 3D texture, so every slab gets its own. Its
// own card, independent of the page's actions: upload and remove are their own
// endpoints and take effect immediately.
export function SlabPhotoCard({ unitId, canEdit }: SlabPhotoCardProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const photoQ = useQuery({
    queryKey: slabPhotoQueryKey(unitId),
    queryFn: () => inventoryUnitService.getPhotoUrl(unitId),
    staleTime: PHOTO_URL_STALE_MS,
  });

  const upload = useMutation({
    mutationFn: (file: File) => inventoryUnitService.uploadPhoto(unitId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: slabPhotoQueryKey(unitId) });
      qc.invalidateQueries({ queryKey: ['sales-order-slab-options'] });
      toast.success('Slab photo updated');
    },
  });

  const remove = useMutation({
    mutationFn: () => inventoryUnitService.deletePhoto(unitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: slabPhotoQueryKey(unitId) });
      qc.invalidateQueries({ queryKey: ['sales-order-slab-options'] });
      toast.success('Slab photo removed');
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateSlabPhotoFile(file);
    setValidationError(err);
    if (!err) upload.mutate(file);
  }

  const photoUrl = photoQ.data;
  const isBusy = upload.isPending || remove.isPending;
  const mutationError = upload.error ?? remove.error;

  return (
    <section aria-label="Slab photo" className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-card-title">Slab Photo</h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              aria-label={photoUrl ? 'Replace slab photo' : 'Upload slab photo'}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {upload.isPending ? 'Uploading…' : photoUrl ? 'Replace' : 'Upload'}
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={isBusy}
                aria-label="Remove slab photo"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger-ink transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex h-56 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
        {photoUrl ? (
          <img src={photoUrl} alt="Slab" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-ink-muted">
            <ImageIcon className="size-8" aria-hidden="true" />
            <p className="type-helper">{photoQ.isLoading ? 'Loading…' : 'No photo yet.'}</p>
          </div>
        )}
      </div>

      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={[...ACCEPTED_SLAB_PHOTO_EXTENSIONS, ...ACCEPTED_SLAB_PHOTO_MIME_TYPES].join(',')}
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
            data-testid="slab-photo-input"
            onChange={onFileChange}
          />
          <p className="type-helper">
            A straight-on photo of the whole slab. JPG, PNG or WEBP, up to 10MB. It is shown under the pieces on the sales order&apos;s Material tab.
          </p>
        </>
      )}
      {validationError && <p role="alert" className="type-error">{validationError}</p>}
      {mutationError && (
        <p role="alert" className="type-error">{apiErrorMessage(mutationError, 'Could not update the slab photo.')}</p>
      )}
    </section>
  );
}
