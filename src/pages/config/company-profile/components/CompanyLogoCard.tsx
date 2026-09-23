import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { companyProfileService } from '@/services/companyProfileService';
import { validateLogoFile, ACCEPTED_LOGO_MIME_TYPES, ACCEPTED_LOGO_EXTENSIONS } from '@/lib/companyLogoValidation';
import { apiErrorMessage } from '@/api/tenantClient';
import { ModernSection } from '@/components/crm/FormPrimitives';

const COMPANY_PROFILE_QUERY_KEY = ['company-profile'];

// Its own card, independent of the surrounding form's Edit/Save/Cancel state —
// upload/delete are their own backend endpoints (PUT/DELETE .../logo), not
// fields on the Upsert body, so they mutate immediately rather than staging
// into the profile form. Same precedent as the sibling Locations tab.
export function CompanyLogoCard({ canConfigure }: { canConfigure: boolean }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: COMPANY_PROFILE_QUERY_KEY,
    queryFn: companyProfileService.get,
  });

  const upload = useMutation({
    mutationFn: (file: File) => companyProfileService.uploadLogo(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANY_PROFILE_QUERY_KEY });
      toast.success('Logo updated');
    },
  });

  const remove = useMutation({
    mutationFn: () => companyProfileService.deleteLogo(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANY_PROFILE_QUERY_KEY });
      toast.success('Logo removed');
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateLogoFile(file);
    setValidationError(err);
    if (!err) upload.mutate(file);
  }

  const logoUrl = profileQ.data?.logoUrl;
  const isBusy = upload.isPending || remove.isPending;
  const mutationError = upload.error ?? remove.error;

  return (
    <ModernSection title="Company Logo" index={0}>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          {logoUrl ? (
            <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-stone-300" aria-hidden="true" />
          )}
        </div>

        {canConfigure ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                aria-label={logoUrl ? 'Replace company logo' : 'Upload company logo'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white py-1.5 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                <Upload className="size-3.5" aria-hidden="true" />
                {upload.isPending ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={isBusy}
                  aria-label="Remove company logo"
                  className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={[...ACCEPTED_LOGO_EXTENSIONS, ...ACCEPTED_LOGO_MIME_TYPES].join(',')}
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              onChange={onFileChange}
            />
            <p className="text-2xs text-stone-500">PNG, JPG, GIF, WEBP, or SVG, up to 2MB.</p>
            {validationError && <p className="text-2xs text-destructive">{validationError}</p>}
            {mutationError && (
              <p className="text-2xs text-destructive">
                {apiErrorMessage(mutationError, 'Could not update the logo.')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-stone-500">
            {logoUrl ? 'Your company logo.' : 'No logo has been uploaded yet.'}
          </p>
        )}
      </div>
    </ModernSection>
  );
}
