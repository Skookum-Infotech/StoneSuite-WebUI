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
  billingAddress: string;
  shippingAddress: string;
  returnAddress: string;
}
