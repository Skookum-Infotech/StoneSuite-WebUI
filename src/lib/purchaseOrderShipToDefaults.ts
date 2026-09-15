// Prefill for a brand-new Purchase Order's Ship To (deliver-to) section —
// where the vendor should send the goods, i.e. the tenant's own receiving
// address. Mirrors Item Receipt's existing "defaults to the tenant's default
// warehouse" behavior rather than inventing a second convention.

import type { Warehouse } from '@/types/inventory';
import type { CompanyProfile } from '@/types/companyProfile';

/** Maps a warehouse's address onto Purchase Order's ship_* fields.
 *  addrStateId is the same lkp_state id space ship_state's lookup-select
 *  expects, so it maps directly; country is left untouched (Warehouse
 *  doesn't capture one), so the existing default-to-US fallback still
 *  applies on top of this. */
export function shipToFromWarehouse(warehouse: Warehouse): Record<string, string> {
  return {
    ship_name: warehouse.name,
    ship_address1: warehouse.addrLine1,
    ship_address2: warehouse.addrLine2,
    ship_city: warehouse.addrCity,
    ship_state: warehouse.addrStateId ? String(warehouse.addrStateId) : '',
    ship_zip: warehouse.addrZip,
  };
}

/** Maps the tenant's own Company Info shipping address onto Purchase
 *  Order's ship_* fields — used only when no warehouse is configured yet.
 *  state/country are free text on CompanyProfile (not a *_id matching the
 *  ship_state/ship_country lookup-selects), so they're left for the
 *  existing default / the user to pick, same as a freshly-typed PO already
 *  requires. */
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

/** Picks whichever source has real data for a new Purchase Order's Ship To:
 *  a configured, active default warehouse first (matches Item Receipt),
 *  then the tenant's Company Info when no warehouse exists yet, then empty
 *  (today's behavior, unchanged) when neither does. */
export function purchaseOrderShipToDefaults(
  warehouses: Warehouse[] | undefined,
  companyProfile: CompanyProfile | undefined,
): Record<string, string> {
  const defaultWarehouse = warehouses?.find((w) => w.isDefault && w.isActive);
  if (defaultWarehouse) return shipToFromWarehouse(defaultWarehouse);
  if (companyProfile && companyProfile.companyName.trim()) return shipToFromCompanyProfile(companyProfile);
  return {};
}
