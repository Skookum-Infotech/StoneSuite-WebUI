// Vendor module — frontend contract types.
//
// Modeled on Schema.org Person/Organization (https://schema.org/Person,
// https://schema.org/Organization) so vendor records can represent either an
// individual supplier/contractor or a registered business under one form.
// `vendorType` is the discriminant; Person-only and Organization-only fields
// are optional on the shared shape and populated based on it (mirrors how
// `SalesOrderCreatePayload` keeps `shipping` optional rather than branching
// into separate payload types).

import type { FilterClause, SortKey } from './tenant';

export type VendorType = 'Person' | 'Organization';

/** schema.org/ContactPoint (subset) — a named point of contact for the vendor. */
export interface VendorContactPoint {
  contactType?: string;
  telephone?: string;
  email?: string;
}

/** schema.org/Organization compliance/policy links (ethicsPolicy, diversityPolicy,
 *  correctionsPolicy, actionableFeedbackPolicy — all `URL` range on schema.org). */
export interface VendorCompliancePolicies {
  ethicsPolicyUrl?: string;
  diversityPolicyUrl?: string;
  correctionsPolicyUrl?: string;
  actionableFeedbackPolicyUrl?: string;
}

export const ACCEPTED_PAYMENT_METHODS = ['Cash', 'Credit Card', 'Invoice', 'Bank Transfer', 'Check'] as const;
export type AcceptedPaymentMethod = (typeof ACCEPTED_PAYMENT_METHODS)[number];

// ── Create input (client → server) ───────────────────────────────────────────

export interface VendorCreatePayload {
  vendorType: VendorType;

  // Shared (schema.org/Thing + schema.org/Person ∩ Organization common props)
  email?: string;
  physicalAddress?: string;
  faxNumber?: string;
  globalLocationNumber?: string;
  isicV4Code?: string;
  associatedBrands: string[];
  awardsWon?: string;
  contactPoint?: VendorContactPoint;
  funder?: string;
  hasOfferCatalogUrl?: string;
  pointOfSaleLocations?: string;

  // schema.org/Person — present when vendorType === 'Person'
  honorificPrefix?: string;
  givenName?: string;
  additionalName?: string;
  familyName?: string;
  honorificSuffix?: string;
  jobTitle?: string;
  gender?: string;
  nationalityCountryId?: number | null;
  height?: string;
  netWorth?: string;

  // schema.org/Organization — present when vendorType === 'Organization'
  legalName?: string;
  registrationInfo?: string;
  dunsNumber?: string;
  foundingDate?: string;
  foundingLocation?: string;
  dissolutionDate?: string;
  department?: string;
  acceptedPaymentMethods?: AcceptedPaymentMethod[];
  compliancePolicies?: VendorCompliancePolicies;
}

export type VendorUpdatePayload = Partial<VendorCreatePayload>;

// ── Response shapes (server → client) ────────────────────────────────────────

/** Every `lkp_record_status` row seeded for the VNDR record type. Vendor has
 *  no terminal state — Inactive can always be reactivated (backend
 *  `vendors.ValidateTransition` is the source of truth for legal moves). */
export const VENDOR_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'ACT_', label: 'Active' },
  { code: 'ONHD', label: 'On Hold' },
  { code: 'INA_', label: 'Inactive' },
];

/** Status badge color, keyed by the human label returned by the API. */
export const VENDOR_STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e',
  'On Hold': '#f59e0b',
  Inactive: '#6b7280',
};

export interface Vendor extends VendorCreatePayload {
  id: string;
  vendorNumber: string;
  status: string; // human label, e.g. "Active"
  statusCode: string; // lkp_record_status code, e.g. "ACT_"
  displayName: string;
  ownerEmployeeId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Search / list (server-side Record Filter Engine) ─────────────────────────
// Mirrors SalesOrderSearchRequest/Page — vendors is a dedicated relational
// module served from /api/tenant/vendors*, using the same keyset-paginated
// filter/sort engine. Cursors are opaque — pass back what the server
// returned, never construct one client-side.

export interface VendorSearchRequest {
  search?: string;
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
}

export interface VendorPage {
  records: Vendor[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
