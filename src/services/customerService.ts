import { apiClient } from '@/api/client';
import type { Customer, CreateCustomerPayload, OnboardingInvite, SendInvitationPayload, SubmitOnboardingPayload } from '@/types/customer';

type CustomerListResponse = {
  success: boolean;
  customers: Customer[];
};

type CustomerResponse = {
  success: boolean;
  message: string;
  customer: Customer;
};

type InvitationResponse = {
  success: boolean;
  message: string;
  invite: OnboardingInvite;
};

type InviteDetailResponse = {
  success: boolean;
  invite: OnboardingInvite;
  companyName: string;
  recipientName: string;
};

export const customerService = {
  list: async (): Promise<Customer[]> => {
    const response = await apiClient.get<CustomerListResponse>('/customers');
    return response.data.customers ?? [];
  },

  create: async (payload: CreateCustomerPayload): Promise<Customer> => {
    const response = await apiClient.post<CustomerResponse>('/customers', payload);
    return response.data.customer;
  },

  sendInvitation: async (payload: SendInvitationPayload): Promise<OnboardingInvite> => {
    const response = await apiClient.post<InvitationResponse>('/invitations', payload);
    return response.data.invite;
  },

  getInviteByToken: async (token: string): Promise<InviteDetailResponse> => {
    const { data } = await apiClient.get<InviteDetailResponse>(`/onboarding/invite/${token}`);
    return data;
  },

  submitOnboarding: async (payload: SubmitOnboardingPayload): Promise<Customer> => {
    const response = await apiClient.post<CustomerResponse>('/onboarding/submit', payload);
    return response.data.customer;
  },
};
