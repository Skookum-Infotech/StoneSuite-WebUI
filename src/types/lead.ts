export type LeadStatus =
  | 'LEAD-Unqualified'
  | 'LEAD-Qualified'
  | 'LEAD-New'
  | 'LEAD-In Progress'
  | 'LEAD-Converted'
  | 'LEAD-Dead';

export type LeadType = 'Company' | 'Individual';

export type Lead = {
  id: string;
  leadId: string;
  customForm: string;
  leadStatus: LeadStatus;
  defaultOrderPriority: string;
  type: LeadType;
  companyName: string;
  firstName: string;
  lastName: string;
  salesRep: string;
  territory: string;
  partner: string;
  email: string;
  phone: string;
  fax: string;
  address: string;
  primarySubsidiary: string;
  emailForPaymentNotification: string;
  whiteGlove: boolean;
  displayProductCode: boolean;
  blacklineArCashApp: boolean;
  sfdcAccountId: string;
  prevExternalId: string;
  sfdcCustomerStatus: string;
  crmAccountOwner: string;
  customerLegalName: string;
  customerType: string;
  crmCsmTeam: string;
  sfdcExternalId: string;
  additionalEmails: string;
  crmCsm: string;
  talkdeskRegion: string;
  crmGrowthManager: string;
  talkdeskIdPlatform: string;
  zuoraInvoiceName: string;
  estimatedBudget: string;
  budgetApproved: boolean;
  salesReadiness: string;
  buyingReason: string;
  buyingTimeFrame: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateLeadPayload = Omit<Lead, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>;
