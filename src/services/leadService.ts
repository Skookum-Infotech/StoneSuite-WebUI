import { apiClient } from '@/api/client';
import type { Lead, CreateLeadPayload } from '@/types/lead';

type LeadListResponse = {
  success: boolean;
  leads: Lead[];
};

type LeadResponse = {
  success: boolean;
  message: string;
  lead: Lead;
};

export const leadService = {
  list: async (): Promise<Lead[]> => {
    const response = await apiClient.get<LeadListResponse>('/leads');
    return response.data.leads ?? [];
  },

  create: async (payload: CreateLeadPayload): Promise<Lead> => {
    const response = await apiClient.post<LeadResponse>('/leads', payload);
    return response.data.lead;
  },
};
