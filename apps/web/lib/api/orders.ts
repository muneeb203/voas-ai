import 'server-only';
import { apiCall } from './client';
import type { Order, OrderStatus } from '@/lib/types';

export function listOrders(workspaceId: string, statusFilter?: OrderStatus) {
  const qs = statusFilter ? `?status=${statusFilter}` : '';
  return apiCall<Order[]>(`/v1/workspaces/${workspaceId}/orders${qs}`, {
    cache: 'no-store',
  });
}

export function getOrder(workspaceId: string, orderId: string) {
  return apiCall<Order>(`/v1/workspaces/${workspaceId}/orders/${orderId}`, {
    cache: 'no-store',
  });
}

export function updateOrderStatus(
  workspaceId: string,
  orderId: string,
  status: OrderStatus,
) {
  return apiCall<Order>(`/v1/workspaces/${workspaceId}/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
