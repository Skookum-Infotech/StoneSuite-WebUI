export type CustomerStatus = 'pendingApproval' | 'invitation_sent' | 'active' | 'suspended';

export type OnboardingInvite = {
  id: string;
  customerId: string;
  contactId?: string;
  contactEmail: string;
  status: string;
  expiresAt: string;
  sentAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SendInvitationPayload = {
  companyName: string;
  recipientName: string;
  recipientEmail: string;
  expiresInHours?: number;
};

export type SubmitOnboardingPayload = {
  token: string;
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

export type CustomerContact = {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle?: string;
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
