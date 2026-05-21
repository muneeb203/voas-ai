import 'server-only';
import { apiCall } from './client';
import type {
  MenuCategory,
  MenuItem,
  MenuModifierGroup,
  MenuModifierOption,
} from '@/lib/types';

// --- Categories -------------------------------------------------------------

export function listCategories(workspaceId: string) {
  return apiCall<MenuCategory[]>(`/v1/workspaces/${workspaceId}/menu/categories`, {
    cache: 'no-store',
  });
}

export function createCategory(
  workspaceId: string,
  payload: { name: string; description?: string; sort_order?: number },
) {
  return apiCall<MenuCategory>(`/v1/workspaces/${workspaceId}/menu/categories`, {
    method: 'POST',
    body: payload,
  });
}

export function updateCategory(
  workspaceId: string,
  categoryId: string,
  payload: Partial<{ name: string; description: string; sort_order: number; is_active: boolean }>,
) {
  return apiCall<MenuCategory>(
    `/v1/workspaces/${workspaceId}/menu/categories/${categoryId}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteCategory(workspaceId: string, categoryId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/menu/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

// --- Items ------------------------------------------------------------------

export function listItems(workspaceId: string, categoryId?: string) {
  const qs = categoryId ? `?category_id=${categoryId}` : '';
  return apiCall<MenuItem[]>(`/v1/workspaces/${workspaceId}/menu/items${qs}`, {
    cache: 'no-store',
  });
}

export function createItem(
  workspaceId: string,
  payload: {
    category_id: string;
    name: string;
    description?: string;
    price_cents: number;
    is_active?: boolean;
    sort_order?: number;
  },
) {
  return apiCall<MenuItem>(`/v1/workspaces/${workspaceId}/menu/items`, {
    method: 'POST',
    body: payload,
  });
}

export function updateItem(
  workspaceId: string,
  itemId: string,
  payload: Partial<{
    category_id: string;
    name: string;
    description: string;
    price_cents: number;
    is_active: boolean;
    sort_order: number;
  }>,
) {
  return apiCall<MenuItem>(`/v1/workspaces/${workspaceId}/menu/items/${itemId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteItem(workspaceId: string, itemId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/menu/items/${itemId}`, {
    method: 'DELETE',
  });
}

// --- Modifier groups -------------------------------------------------------

export function createModifierGroup(
  workspaceId: string,
  itemId: string,
  payload: { name: string; min_select?: number; max_select?: number; required?: boolean; sort_order?: number },
) {
  return apiCall<MenuModifierGroup>(
    `/v1/workspaces/${workspaceId}/menu/items/${itemId}/modifier-groups`,
    { method: 'POST', body: payload },
  );
}

export function updateModifierGroup(
  workspaceId: string,
  groupId: string,
  payload: Partial<{ name: string; min_select: number; max_select: number; required: boolean; sort_order: number }>,
) {
  return apiCall<MenuModifierGroup>(
    `/v1/workspaces/${workspaceId}/menu/modifier-groups/${groupId}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteModifierGroup(workspaceId: string, groupId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/menu/modifier-groups/${groupId}`, {
    method: 'DELETE',
  });
}

// --- Modifier options ------------------------------------------------------

export function createModifierOption(
  workspaceId: string,
  groupId: string,
  payload: { name: string; price_delta_cents?: number; is_default?: boolean; sort_order?: number },
) {
  return apiCall<MenuModifierOption>(
    `/v1/workspaces/${workspaceId}/menu/modifier-groups/${groupId}/options`,
    { method: 'POST', body: payload },
  );
}

export function updateModifierOption(
  workspaceId: string,
  optionId: string,
  payload: Partial<{ name: string; price_delta_cents: number; is_default: boolean; sort_order: number }>,
) {
  return apiCall<MenuModifierOption>(
    `/v1/workspaces/${workspaceId}/menu/modifier-options/${optionId}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteModifierOption(workspaceId: string, optionId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/menu/modifier-options/${optionId}`, {
    method: 'DELETE',
  });
}
