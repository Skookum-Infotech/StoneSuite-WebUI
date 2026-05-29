import { apiClient } from '@/api/client';
import type { Customer, CreateCustomerPayload } from '@/types/customer';

type CustomerListResponse = {
  success: boolean;
  customers: Customer[];
};

type CustomerResponse = {
  success: boolean;
  message: string;
  customer: Customer;
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
};
