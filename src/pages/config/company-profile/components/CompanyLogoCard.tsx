import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { companyProfileService, MAX_LOGO_SIZE_BYTES, ACCEPTED_LOGO_TYPES } from '@/services/companyProfileService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';

const MAX_LOGO_SIZE_MB = MAX_LOGO_SIZE_BYTES / 1024 / 1024;

/** Client-side mirror of the backend's decodeLogoAsPNG checks (PNG/JPEG,
 *  2MB cap) -- fast feedback before the upload even starts. The backend
 *  re-validates regardless; this never replaces that. */
function validateLogoFile(file: File): string | null {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    return 'Logo must be a PNG or JPEG image.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return `Logo exceeds the ${MAX_LOGO_SIZE_MB}MB limit.`;
  }
  return null;
}

/** Configuration -> Company Info -> Logo -- shown on every generated
 *  document PDF (quote/estimate/invoice/etc.) when set. Independent of the
 *  surrounding CompanyProfileTab's Edit/Save form: upload and remove take
 *  effect immediately (each is its own backend call scoped to just the
 *  logo field), the same way an avatar uploader would, rather than
 *  requiring the whole profile form to be in edit mode first. */
export function CompanyLogoCard({ logoUrl, canConfigure }: { logoUrl: string; canConfigure: boolean }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => companyProfileService.uploadLogo(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-profile-logo'] });
      toast.success('Logo updated');
    },
  });

  const remove = useMutation({
    mutationFn: () => companyProfileService.deleteLogo(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-profile-logo'] });
      toast.success('Logo removed');
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateLogoFile(file);
    setValidationError(err);
    if (err) return;
    upload.mutate(file);
  }

  const isBusy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div
        className={cn(
          'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed',
          logoUrl ? 'border-stone-200 bg-white' : 'border-stone-300 bg-stone-50',
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1.5" />
        ) : (
          <ImageIcon className="size-6 text-stone-300" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-500">
          Shown on generated document PDFs (quote, estimate, invoice, and similar). PNG or JPEG, up to {MAX_LOGO_SIZE_MB}MB.
        </p>

        {canConfigure && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={onFileChange}
              aria-label="Choose company logo file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              aria-label={logoUrl ? 'Change company logo' : 'Upload company logo'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white py-1.5 px-3 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              {upload.isPending ? 'Uploading…' : logoUrl ? 'Change' : 'Upload'}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={isBusy}
                aria-label="Remove company logo"
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {remove.isPending ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
        )}

        {validationError && <ErrorNote>{validationError}</ErrorNote>}
        {upload.isError && <ErrorNote>{apiErrorMessage(upload.error, 'Could not upload logo.')}</ErrorNote>}
        {remove.isError && <ErrorNote>{apiErrorMessage(remove.error, 'Could not remove logo.')}</ErrorNote>}
      </div>
    </div>
  );
}
