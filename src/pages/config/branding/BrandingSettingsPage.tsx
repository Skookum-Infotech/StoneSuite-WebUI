import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Check, Loader2, ImageOff } from 'lucide-react';
import { tenantSettingsService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote } from '@/components/tenant/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { brandingSchema, type BrandingFormValues } from './brandingSchema';

export default function BrandingSettingsPage(): React.JSX.Element {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: tenantSettingsService.get,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: { logoUrl: '' },
  });

  useEffect(() => {
    if (settingsQ.data) {
      reset({ logoUrl: settingsQ.data.logoUrl });
    }
  }, [settingsQ.data, reset]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const save = useMutation({
    mutationFn: (data: BrandingFormValues) => tenantSettingsService.update(data.logoUrl),
    onSuccess: (result) => {
      qc.setQueryData(['tenant-settings'], result);
      setSaveSuccess(true);
      setGeneralError(null);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err: unknown) => {
      setGeneralError(apiErrorMessage(err));
    },
  });

  function onSubmit(data: BrandingFormValues) {
    setSaveSuccess(false);
    setGeneralError(null);
    save.mutate(data);
  }

  const logoUrl = watch('logoUrl');

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Branding"
        subtitle="Set your workspace logo. It appears alongside the StoneSuite logo in emails sent to your team and customers."
      />

      {settingsQ.isLoading && <Spinner label="Loading branding settings…" />}
      {settingsQ.isError && (
        <div className="max-w-lg">
          <ErrorNote>{apiErrorMessage(settingsQ.error)}</ErrorNote>
        </div>
      )}

      {!settingsQ.isLoading && !settingsQ.isError && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="max-w-lg space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">Company Logo URL</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              aria-label="Company Logo URL"
              aria-invalid={Boolean(errors.logoUrl)}
              {...register('logoUrl', {
                onChange: () => setPreviewFailed(false),
              })}
            />
            {errors.logoUrl && (
              <p className="text-xs text-red-500">{errors.logoUrl.message}</p>
            )}
            <p className="text-xs text-stone-400">
              Paste a link to a hosted image. Leave blank to remove your logo from emails.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div className="flex h-16 w-full items-center rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 dark:border-stone-800 dark:bg-stone-950">
              {!logoUrl ? (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <ImageIcon className="size-4" aria-hidden="true" />
                  No logo set
                </div>
              ) : previewFailed ? (
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <ImageOff className="size-4" aria-hidden="true" />
                  Image failed to load — check the URL
                </div>
              ) : (
                <img
                  src={logoUrl}
                  alt="Company logo preview"
                  className="h-10 max-w-[180px] object-contain"
                  onError={() => setPreviewFailed(true)}
                  onLoad={() => setPreviewFailed(false)}
                />
              )}
            </div>
          </div>

          {generalError && <ErrorNote>{generalError}</ErrorNote>}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || save.isPending || !isDirty}>
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saveSuccess ? (
                <>
                  <Check className="size-4" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
