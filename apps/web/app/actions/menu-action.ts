'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  createCategory,
  createItem,
  createModifierGroup,
  createModifierOption,
  deleteCategory,
  deleteItem,
  deleteModifierGroup,
  deleteModifierOption,
  updateCategory,
  updateItem,
  updateModifierGroup,
  updateModifierOption,
} from '@/lib/api/menu';
import { isApiError } from '@/lib/types';

function ok(): { error: null } {
  return { error: null };
}

async function requireOwner(path: string) {
  const session = await requireDashboardSession(path);
  if (session.active.role !== 'owner') {
    return { error: 'Only workspace owners can edit the menu.' as const, session: null };
  }
  return { error: null as null, session };
}

const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export async function createCategoryAction(_prev: { error: string | null }, formData: FormData) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };

  const parsed = CategoryCreateSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid' };

  const res = await createCategory(session.active.workspace_id, parsed.data);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/knowledge-base');
  return ok();
}

export async function deleteCategoryAction(categoryId: string) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await deleteCategory(session.active.workspace_id, categoryId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

const ItemSchema = z.object({
  category_id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().min(0),
  is_active: z.boolean(),
});

export async function createItemAction(_prev: { error: string | null }, formData: FormData) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };

  const priceRaw = String(formData.get('price') ?? '0');
  const priceCents = Math.round(parseFloat(priceRaw) * 100) || 0;

  const parsed = ItemSchema.safeParse({
    category_id: String(formData.get('category_id') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || undefined,
    price_cents: priceCents,
    is_active: formData.get('is_active') !== 'off',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid' };

  const res = await createItem(session.active.workspace_id, parsed.data);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function updateItemAction(itemId: string, payload: Parameters<typeof updateItem>[2]) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await updateItem(session.active.workspace_id, itemId, payload);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function deleteItemAction(itemId: string) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await deleteItem(session.active.workspace_id, itemId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function createModifierGroupAction(
  itemId: string,
  payload: { name: string; min_select?: number; max_select?: number; required?: boolean },
) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await createModifierGroup(session.active.workspace_id, itemId, payload);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function deleteModifierGroupAction(groupId: string) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await deleteModifierGroup(session.active.workspace_id, groupId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function createModifierOptionAction(
  groupId: string,
  payload: { name: string; price_delta_cents?: number; is_default?: boolean },
) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await createModifierOption(session.active.workspace_id, groupId, payload);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

export async function deleteModifierOptionAction(optionId: string) {
  const { error, session } = await requireOwner('/knowledge-base');
  if (error) return { error };
  const res = await deleteModifierOption(session.active.workspace_id, optionId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/knowledge-base');
  return ok();
}

// Re-export the API type so the component imports stay simple.
export type { MenuItem, MenuCategory, MenuModifierGroup, MenuModifierOption } from '@/lib/types';
