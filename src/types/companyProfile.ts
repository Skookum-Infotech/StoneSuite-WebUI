// Same line1/line2/suite/city/country/state/zip shape as a CRM Lead/
// Prospect/Customer's own address fields (see lib/crmFields.ts's *_addr_*
// fields) — structured, not one free-text blob.
export interface Address {
  line1: string;
  line2: string;
  suite: string;
  city: string;
  country: string;
  state: string;
  zip: string;
}

// The tenant's own company name/address (Configuration -> Company Info) — as
// opposed to a CRM Lead/Prospect/Customer's address, or a vendor's. One
// singleton record per tenant, backed by GET/PUT /api/tenant/company-profile.
export interface CompanyProfile {
  companyName: string;
  legalName: string;
  industry: string;
  website: string;
  country: string;
  currency: string;
  timezone: string;
  taxId: string;
  billingAddress: Address;
  shippingAddress: Address;
  returnAddress: Address;
}

// A physical address a tenant operates from (office, warehouse, showroom) —
// Configuration -> Company Info -> Locations tab. Distinct from
// CompanyProfile's billing/shipping/return addresses, which describe how
// documents route rather than where the business physically is. A tenant may
// have zero of these (the Locations tab then falls back to displaying
// CompanyProfile's billing address as a read-only default); at most one
// live location has isDefault true at a time.
export interface CompanyLocation {
  id: string;
  name: string;
  phone: string;
  address: Address;
  isDefault: boolean;
}
