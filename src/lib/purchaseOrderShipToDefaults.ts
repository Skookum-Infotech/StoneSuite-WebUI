// Prefill for a brand-new Purchase Order's Ship To section — the tenant's
// default Location when one is set (Configuration -> Company Info ->
// Locations), else the tenant's Company Info shipping address (no
// warehouse-delivery concept here; see docs on SHIP_TO_FIELDS in
// purchaseOrderForm.ts). ship_name carries the company/location name for the
// backend/detail-page/PDF "Name" line even though there's no dedicated form
// field for it — the user edits the address fields, not the name.

import type { CompanyLocation, CompanyProfile } from '@/types/companyProfile';

/** Maps a saved Location onto Purchase Order's ship_* fields. state/country
 *  are free text on CompanyLocation (not a *_id matching the
 *  ship_state/ship_country lookup-selects), so they're left for the existing
 *  default / the user to pick, same as a freshly-typed PO already requires. */
export function shipToFromLocation(location: CompanyLocation): Record<string, string> {
  return {
    ship_name: location.name,
    ship_address1: location.address.line1,
    ship_address2: location.address.line2,
    ship_suite: location.address.suite,
    ship_city: location.address.city,
    ship_zip: location.address.zip,
    ...(location.phone ? { ship_phone: location.phone } : {}),
  };
}

/** Maps the tenant's own Company Info shipping address onto Purchase
 *  Order's ship_* fields. state/country are free text on CompanyProfile
 *  (not a *_id matching the ship_state/ship_country lookup-selects), so
 *  they're left for the existing default / the user to pick, same as a
 *  freshly-typed PO already requires. */
export function shipToFromCompanyProfile(profile: CompanyProfile): Record<string, string> {
  return {
    ship_name: profile.companyName,
    ship_address1: profile.shippingAddress.line1,
    ship_address2: profile.shippingAddress.line2,
    ship_suite: profile.shippingAddress.suite,
    ship_city: profile.shippingAddress.city,
    ship_zip: profile.shippingAddress.zip,
  };
}

/** Ship To defaults for a new Purchase Order: the tenant's default Location
 *  when one is set, else the tenant's Company Info when one is on file, else
 *  empty (today's behavior, unchanged). */
export function purchaseOrderShipToDefaults(
  companyProfile: CompanyProfile | undefined,
  defaultLocation?: CompanyLocation,
): Record<string, string> {
  if (defaultLocation) return shipToFromLocation(defaultLocation);
  if (companyProfile && companyProfile.companyName.trim()) return shipToFromCompanyProfile(companyProfile);
  return {};
}
