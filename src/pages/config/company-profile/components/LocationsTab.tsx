import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MapPin, Building2 } from 'lucide-react';
import { companyProfileService } from '@/services/companyProfileService';
import { companyLocationService } from '@/services/companyLocationService';
import type { CompanyLocationFormValues } from '@/lib/companyLocationForm';
import type { CompanyLocation } from '@/types/companyProfile';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { LocationCard } from './LocationCard';
import { LocationFormCard } from './LocationFormCard';

const EMPTY_FORM_VALUES: CompanyLocationFormValues = {
  name: '',
  phone: '',
  address: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
};

function toFormValues(location: CompanyLocation): CompanyLocationFormValues {
  return { name: location.name, phone: location.phone, address: location.address };
}

export function LocationsTab({ actionsSlot }: { actionsSlot: HTMLDivElement | null }) {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('company_profile', 'configure');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Add/Edit/Delete-confirm all unmount the button that opened them and
  // replace it with new controls, silently dropping keyboard focus to
  // <body> — the same failure mode AccountDetailPage.tsx already works
  // around with a persistent sr-only status region instead of true focus
  // restoration. This mirrors that pattern rather than inventing a new one.
  const [announcement, setAnnouncement] = useState('');

  const profileQ = useQuery({ queryKey: ['company-profile'], queryFn: companyProfileService.get });
  const locationsQ = useQuery({ queryKey: ['company-locations'], queryFn: companyLocationService.list });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['company-locations'] });

  const createMut = useMutation({
    mutationFn: (values: CompanyLocationFormValues) => companyLocationService.create(values),
    onSuccess: () => {
      invalidate();
      setIsAdding(false);
      setAnnouncement('Location added.');
      toast.success('Location added');
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CompanyLocationFormValues }) =>
      companyLocationService.update(id, values),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setAnnouncement('Location updated.');
      toast.success('Location updated');
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => companyLocationService.remove(id),
    onSuccess: () => {
      invalidate();
      setAnnouncement('Location deleted.');
      toast.success('Location deleted');
    },
  });
  const setDefaultMut = useMutation({
    mutationFn: (id: string) => companyLocationService.setDefault(id),
    onSuccess: () => {
      invalidate();
      setAnnouncement('Default location updated.');
      toast.success('Default location updated');
    },
  });

  const mutationError = createMut.error ?? updateMut.error ?? deleteMut.error ?? setDefaultMut.error;

  if (profileQ.isLoading || locationsQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner label="Loading locations…" />
      </div>
    );
  }
  if (locationsQ.isError) {
    return (
      <div className="max-w-lg">
        <ErrorNote>{apiErrorMessage(locationsQ.error)}</ErrorNote>
      </div>
    );
  }

  const locations = locationsQ.data ?? [];
  const fallbackAddress = profileQ.data?.billingAddress;
  const hasFallbackAddress = fallbackAddress
    && Object.values(fallbackAddress).some((v) => v.trim() !== '');

  // Portaled into the page header's actions slot (CompanyProfilePage.tsx)
  // rather than rendered in place — hidden while a form is already open,
  // same as before. Sizing matches the app's standard "New X" header button
  // (e.g. VendorBillListPage) so it reads the same as every other page's
  // primary header action.
  const actions = canConfigure && !isAdding && !editingId && (
    <button
      type="button"
      onClick={() => {
        setIsAdding(true);
        setAnnouncement('Add location form opened.');
      }}
      aria-label="Add location"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
    >
      <Plus className="size-3.5" />
      Add Location
    </button>
  );

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {actionsSlot && createPortal(actions, actionsSlot)}

      {/* Announces add/edit/delete-confirm transitions to screen readers —
          see the announcement state doc comment above. */}
      <p role="status" className="sr-only">{announcement}</p>

      {mutationError && <ErrorNote>{apiErrorMessage(mutationError, 'Could not save location.')}</ErrorNote>}

      {isAdding && (
        <LocationFormCard
          initial={EMPTY_FORM_VALUES}
          onSave={(values) => createMut.mutate(values)}
          onCancel={() => {
            setIsAdding(false);
            setAnnouncement('Add location cancelled.');
          }}
          isSaving={createMut.isPending}
        />
      )}

      {locations.map((location) => (
        editingId === location.id ? (
          <LocationFormCard
            key={location.id}
            initial={toFormValues(location)}
            onSave={(values) => updateMut.mutate({ id: location.id, values })}
            onCancel={() => {
              setEditingId(null);
              setAnnouncement('Edit location cancelled.');
            }}
            isSaving={updateMut.isPending}
          />
        ) : (
          <LocationCard
            key={location.id}
            location={location}
            canConfigure={canConfigure}
            isBusy={
              (deleteMut.isPending && deleteMut.variables === location.id)
              || (setDefaultMut.isPending && setDefaultMut.variables === location.id)
            }
            actions={{
              // Mutually exclusive with Add (and with any other card's Edit)
              // so at most one LocationFormCard is ever mounted at once —
              // LocationFormCard's field ids aren't instance-namespaced,
              // which would otherwise collide across two open forms.
              onEdit: () => {
                setIsAdding(false);
                setEditingId(location.id);
                setAnnouncement(`Editing ${location.name}.`);
              },
              onDelete: () => deleteMut.mutate(location.id),
              onSetDefault: () => setDefaultMut.mutate(location.id),
              onAnnounce: setAnnouncement,
            }}
          />
        )
      ))}

      {locations.length === 0 && !isAdding && (
        <div className="w-full rounded-2xl border border-dashed border-stone-200 bg-white overflow-hidden">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-stone-400" />
              <h3 className="text-sm font-bold text-stone-900">Default (from Company Profile)</h3>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-stone-500">
              <MapPin className="size-3.5 shrink-0 mt-0.5 text-stone-400" />
              <span>
                {hasFallbackAddress && fallbackAddress
                  ? [fallbackAddress.line1, fallbackAddress.city, fallbackAddress.state, fallbackAddress.zip]
                    .filter(Boolean).join(' · ')
                  : 'No address on file yet — add one on the Company Profile tab.'}
              </span>
            </div>
            <p className="mt-3 text-xs text-stone-400">
              Add a location to give the company a specific address instead of this default.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
