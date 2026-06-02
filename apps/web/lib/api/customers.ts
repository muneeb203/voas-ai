import 'server-only';
import { apiCall } from './client';
import type { ApiResponse, Customer, CustomerDetail } from '@/lib/types';

export function listCustomers(
  workspaceId: string,
  params?: { search?: string; sort_by?: string },
): Promise<ApiResponse<Customer[]>> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.sort_by) qs.set('sort_by', params.sort_by);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiCall<Customer[]>(`/v1/workspaces/${workspaceId}/customers${suffix}`, {
    cache: 'no-store',
  });
}

export function getCustomer(
  workspaceId: string,
  customerId: string,
): Promise<ApiResponse<CustomerDetail>> {
  return apiCall<CustomerDetail>(
    `/v1/workspaces/${workspaceId}/customers/${customerId}`,
    { cache: 'no-store' },
  );
}

export function updateCustomer(
  workspaceId: string,
  customerId: string,
  payload: { name?: string; email?: string; tags?: string[] },
): Promise<ApiResponse<Customer>> {
  return apiCall<Customer>(
    `/v1/workspaces/${workspaceId}/customers/${customerId}`,
    { method: 'PATCH', body: payload },
  );
}
