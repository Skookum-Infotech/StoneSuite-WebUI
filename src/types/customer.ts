export type CustomerStatus = 'draft' | 'invitation_sent' | 'active' | 'suspended';

export type CustomerContact = {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
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
  status: string;
  contacts: CustomerContact[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerPayload = {
  name: string;
  legalName?: string;
  industry?: string;
  website?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  taxId?: string;
  billingAddress?: string;
  shippingAddress?: string;
  returnAddress?: string;
  superAdminName: string;
  superAdminEmail: string;
  superAdminPhone?: string;
  superAdminJobTitle?: string;
  financeName?: string;
  financeEmail?: string;
  financePhone?: string;
};
