'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, ChevronRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatCents } from './order-badges';
import {
  createCategoryAction,
  createItemAction,
  createModifierGroupAction,
  createModifierOptionAction,
  deleteCategoryAction,
  deleteItemAction,
  deleteModifierGroupAction,
  deleteModifierOptionAction,
  updateItemAction,
} from '@/app/actions/menu-action';
import type { MenuCategory, MenuItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MenuEditorProps {
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  isOwner: boolean;
}

export function MenuEditor({ categories, itemsByCategory, isOwner }: MenuEditorProps) {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<MenuCategory | null>(null);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const activeItems = activeCategoryId ? itemsByCategory[activeCategoryId] ?? [] : [];

  if (categories.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <h2 className="text-lg font-semibold">No menu yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start by adding a category — say "Pizzas" or "Drinks". Items go inside categories.
            </p>
            {isOwner && (
              <Button onClick={() => setShowNewCategory(true)}>
                <Plus className="h-4 w-4" /> Add first category
              </Button>
            )}
          </CardContent>
        </Card>
        {showNewCategory && (
          <CategoryDialog open={showNewCategory} onOpenChange={setShowNewCategory} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Categories sidebar */}
        <Card className="h-fit">
          <CardContent className="p-2">
            <ul className="space-y-0.5">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={cn(
                      'group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      activeCategoryId === cat.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                      <span className="font-medium">{cat.name}</span>
                    </span>
                    <Badge variant="secondary">{cat.item_count}</Badge>
                  </button>
                </li>
              ))}
            </ul>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start"
                onClick={() => setShowNewCategory(true)}
              >
                <Plus className="h-4 w-4" /> New category
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Items panel */}
        <div className="space-y-4">
          {activeCategory && (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{activeCategory.name}</h2>
                {activeCategory.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeCategory.description}
                  </p>
                )}
              </div>
              {isOwner && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowNewItem(true)}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteCategory(activeCategory)}
                    className="text-error hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No items in this category yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewCategory && (
        <CategoryDialog open={showNewCategory} onOpenChange={setShowNewCategory} />
      )}

      {showNewItem && activeCategoryId && (
        <ItemDialog
          open={showNewItem}
          onOpenChange={setShowNewItem}
          categoryId={activeCategoryId}
          categories={categories}
          mode="create"
        />
      )}

      {editingItem && (
        <ItemDialog
          open={!!editingItem}
          onOpenChange={(o) => !o && setEditingItem(null)}
          categoryId={editingItem.category_id}
          categories={categories}
          item={editingItem}
          mode="edit"
        />
      )}

      {confirmDeleteCategory && (
        <ConfirmDialog
          open={!!confirmDeleteCategory}
          onOpenChange={(o) => !o && setConfirmDeleteCategory(null)}
          title={`Delete "${confirmDeleteCategory.name}"?`}
          description="All items in this category will be deleted as well. This can't be undone."
          confirmLabel="Delete category"
          destructive
          onConfirm={async () => {
            const res = await deleteCategoryAction(confirmDeleteCategory.id);
            if (res.error) toast.error(res.error);
            else {
              toast.success('Category deleted');
              setActiveCategoryId(categories.find((c) => c.id !== confirmDeleteCategory.id)?.id ?? null);
              router.refresh();
            }
          }}
        />
      )}
    </>
  );
}

function ItemRow({
  item,
  isOwner,
  onEdit,
}: {
  item: MenuItem;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-start gap-2 text-left"
          >
            <ChevronRight
              className={cn('mt-1 h-4 w-4 transition-transform', expanded && 'rotate-90')}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{item.name}</p>
                {!item.is_active && <Badge variant="secondary">Hidden</Badge>}
                {item.modifier_groups.length > 0 && (
                  <Badge variant="outline">
                    {item.modifier_groups.length} modifier group
                    {item.modifier_groups.length === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
            <p className="font-medium tabular-nums">{formatCents(item.price_cents)}</p>
          </button>

          {isOwner && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!confirm(`Delete "${item.name}"?`)) return;
                  const res = await deleteItemAction(item.id);
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success('Item deleted');
                    router.refresh();
                  }
                }}
                className="text-error hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {item.modifier_groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No modifiers.</p>
            ) : (
              item.modifier_groups.map((group) => (
                <ModifierGroupRow key={group.id} group={group} isOwner={isOwner} />
              ))
            )}

            {isOwner && <NewGroupForm itemId={item.id} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModifierGroupRow({
  group,
  isOwner,
}: {
  group: MenuItem['modifier_groups'][number];
  isOwner: boolean;
}) {
  const router = useRouter();
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{group.name}</p>
          {group.required && <Badge variant="warning">Required</Badge>}
          <span className="text-xs text-muted-foreground">
            min {group.min_select} · max {group.max_select}
          </span>
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!confirm(`Delete modifier group "${group.name}"?`)) return;
              const res = await deleteModifierGroupAction(group.id);
              if (res.error) toast.error(res.error);
              else {
                toast.success('Group deleted');
                router.refresh();
              }
            }}
            className="text-error hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {group.options.map((opt) => (
          <li
            key={opt.id}
            className="flex items-center justify-between text-xs"
          >
            <span>
              {opt.name}
              {opt.is_default && (
                <Badge variant="secondary" className="ml-1">
                  Default
                </Badge>
              )}
            </span>
            <span className="flex items-center gap-2">
              {opt.price_delta_cents !== 0 && (
                <span className="tabular-nums text-muted-foreground">
                  {opt.price_delta_cents > 0 ? '+' : ''}
                  {formatCents(opt.price_delta_cents)}
                </span>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete "${opt.name}"?`)) return;
                    const res = await deleteModifierOptionAction(opt.id);
                    if (res.error) toast.error(res.error);
                    else {
                      toast.success('Option deleted');
                      router.refresh();
                    }
                  }}
                  className="text-error hover:text-error/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {isOwner && <NewOptionForm groupId={group.id} />}
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await createCategoryAction({ error: null }, new FormData(e.currentTarget));
    setPending(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Category created');
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>Pizzas, Drinks, Sides — group your items.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name" htmlFor="name" required>
            <Input id="name" name="name" required disabled={pending} autoFocus />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={2} disabled={pending} />
          </Field>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  categoryId,
  categories,
  item,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string;
  categories: MenuCategory[];
  item?: MenuItem;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const data = new FormData(e.currentTarget);

    if (mode === 'create') {
      const res = await createItemAction({ error: null }, data);
      setPending(false);
      if (res.error) toast.error(res.error);
      else {
        toast.success('Item added');
        onOpenChange(false);
        router.refresh();
      }
    } else if (item) {
      const priceRaw = String(data.get('price') ?? '0');
      const res = await updateItemAction(item.id, {
        category_id: String(data.get('category_id') ?? item.category_id),
        name: String(data.get('name') ?? item.name),
        description: String(data.get('description') ?? '').trim() || undefined,
        price_cents: Math.round(parseFloat(priceRaw) * 100) || 0,
        is_active: data.get('is_active') !== 'off',
      });
      setPending(false);
      if (res.error) toast.error(res.error);
      else {
        toast.success('Item updated');
        onOpenChange(false);
        router.refresh();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New item' : 'Edit item'}</DialogTitle>
          <DialogDescription>
            Name + price are required. Modifiers come after.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Category" htmlFor="category_id" required>
            <select
              id="category_id"
              name="category_id"
              defaultValue={categoryId}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={pending}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                defaultValue={item?.name ?? ''}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Price ($)" htmlFor="price" required>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item ? (item.price_cents / 100).toFixed(2) : ''}
                required
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={item?.description ?? ''}
              disabled={pending}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={item ? item.is_active : true}
              className="h-4 w-4 rounded border-input"
            />
            Show on menu
          </label>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : mode === 'create' ? 'Add item' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewGroupForm({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const res = await createModifierGroupAction(itemId, { name });
    setPending(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Group added');
      setName('');
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 pt-2">
      <Input
        placeholder="New modifier group (e.g. Size)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        className="h-8 text-sm"
      />
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        Add
      </Button>
    </form>
  );
}

function NewOptionForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const priceCents = price ? Math.round(parseFloat(price) * 100) || 0 : 0;
    const res = await createModifierOptionAction(groupId, {
      name,
      price_delta_cents: priceCents,
    });
    setPending(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Option added');
      setName('');
      setPrice('');
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex gap-2">
      <Input
        placeholder="Option name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        className="h-7 flex-1 text-xs"
      />
      <Input
        placeholder="+0.00"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={pending}
        type="number"
        step="0.01"
        className="h-7 w-20 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()}>
        <Plus className="h-3 w-3" />
      </Button>
    </form>
  );
}
