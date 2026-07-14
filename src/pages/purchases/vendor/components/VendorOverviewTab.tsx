import type { ReactNode } from 'react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { Vendor } from '@/types/vendor';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ReadonlyField({ label, value, full, link, multiline }: {
  label: string; value?: string; full?: boolean; link?: boolean; multiline?: boolean;
}) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      {value && link ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(readonlyCls, 'block truncate text-brand underline decoration-brand/40 hover:decoration-brand')}
        >
          {value}
        </a>
      ) : (
        <div className={cn(readonlyCls, multiline && 'whitespace-pre-wrap min-h-[4.5rem]')}>
          {value || <span className="text-stone-400">—</span>}
        </div>
      )}
    </div>
  );
}

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: ReactNode }) {
  if (items.length === 0) return typeof emptyLabel === 'string'
    ? <div className={cn(readonlyCls, 'text-stone-400')}>{emptyLabel}</div>
    : <>{emptyLabel}</>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
          {item}
        </span>
      ))}
    </div>
  );
}

// Read-only field layout for the Vendor Detail page's Overview tab — mirrors
// SalesOrderDetailPage's ModernSection + ReadonlyField pattern, branching on
// vendorType the same way VendorFormBody does for the Add/Edit forms.
export function VendorOverviewTab({ vendor, countryName }: { vendor: Vendor; countryName?: string }) {
  const isPerson = vendor.vendorType === 'Person';
  const associatedBrands = vendor.associatedBrands ?? [];
  const acceptedPaymentMethods = vendor.acceptedPaymentMethods ?? [];

  return (
    <>
      {isPerson ? (
        <>
          <ModernSection title="Personal Identity" index={0}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Honorific Prefix" value={vendor.honorificPrefix} />
              <ReadonlyField label="First Name" value={vendor.givenName} />
              <ReadonlyField label="Middle Name" value={vendor.additionalName} />
              <ReadonlyField label="Last Name" value={vendor.familyName} />
              <ReadonlyField label="Honorific Suffix" value={vendor.honorificSuffix} />
              <ReadonlyField label="Job Title" value={vendor.jobTitle} />
            </div>
          </ModernSection>
          <ModernSection title="Personal Details" index={1}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Gender" value={vendor.gender} />
              <ReadonlyField label="Nationality" value={countryName} />
              <ReadonlyField label="Personal Height" value={vendor.height} />
              <ReadonlyField label="Net Worth" value={vendor.netWorth} />
            </div>
          </ModernSection>
        </>
      ) : (
        <>
          <ModernSection title="Company Details" index={0}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <ReadonlyField label="Legal Business Name" value={vendor.legalName} full />
              <ReadonlyField label="Company Registration Info / Certification" value={vendor.registrationInfo} full multiline />
              <ReadonlyField label="DUNS Number" value={vendor.dunsNumber} />
              <ReadonlyField label="Department / Sub-organization" value={vendor.department} />
            </div>
          </ModernSection>
          <ModernSection title="Company Lifecycle" index={1}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Founding Date" value={vendor.foundingDate ? fmtDate(vendor.foundingDate) : undefined} />
              <ReadonlyField label="Founding Location" value={vendor.foundingLocation} />
              <ReadonlyField label="Dissolution Date" value={vendor.dissolutionDate ? fmtDate(vendor.dissolutionDate) : undefined} />
            </div>
          </ModernSection>
        </>
      )}

      <ModernSection title="Contact & Location" index={2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <ReadonlyField label="Email Address" value={vendor.email} />
            <ReadonlyField label="Fax Number" value={vendor.faxNumber} />
            <ReadonlyField label="Physical Address" value={vendor.physicalAddress} full multiline />
          </div>
          <p className="pt-1 text-2xs font-semibold uppercase tracking-wider text-stone-400">Primary Contact Point</p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField label="Contact Type" value={vendor.contactPoint?.contactType} />
            <ReadonlyField label="Contact Telephone" value={vendor.contactPoint?.telephone} />
            <ReadonlyField label="Contact Email" value={vendor.contactPoint?.email} />
          </div>
        </div>
      </ModernSection>

      <ModernSection title="Business Identifiers" index={3}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <ReadonlyField label="Global Location Number (GLN)" value={vendor.globalLocationNumber} />
          <ReadonlyField label="ISIC V4 Code" value={vendor.isicV4Code} />
        </div>
      </ModernSection>

      <ModernSection title="Brand & Recognition" index={4}>
        <div className="space-y-4">
          <div>
            <label className={fieldLabelCls}>Associated Brands</label>
            <div className="mt-1.5">
              <ChipList items={associatedBrands} emptyLabel="—" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <ReadonlyField label="Awards Won" value={vendor.awardsWon} />
          </div>
        </div>
      </ModernSection>

      <ModernSection title="Commerce & Funding" index={5}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <ReadonlyField label="Funding / Funder Information" value={vendor.funder} />
          <ReadonlyField label="Offer Catalog Link" value={vendor.hasOfferCatalogUrl} link />
          <ReadonlyField label="Point of Sale (POS) Locations" value={vendor.pointOfSaleLocations} />
        </div>
      </ModernSection>

      {!isPerson && (
        <>
          <ModernSection title="Accepted Payment Methods" index={6}>
            <ChipList items={acceptedPaymentMethods} emptyLabel={<p className="text-xs text-stone-400 italic">No payment methods on file.</p>} />
          </ModernSection>
          <ModernSection title="Compliance Policies" index={7}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <ReadonlyField label="Ethics Policy" value={vendor.compliancePolicies?.ethicsPolicyUrl} link />
              <ReadonlyField label="Diversity Policy" value={vendor.compliancePolicies?.diversityPolicyUrl} link />
              <ReadonlyField label="Corrections Policy" value={vendor.compliancePolicies?.correctionsPolicyUrl} link />
              <ReadonlyField label="Actionable Feedback Policy" value={vendor.compliancePolicies?.actionableFeedbackPolicyUrl} link />
            </div>
          </ModernSection>
        </>
      )}
    </>
  );
}
