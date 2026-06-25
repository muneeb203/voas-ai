import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listCategories, listItems } from '@/lib/api/menu';
import { isApiError, type MenuItem } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { MenuEditor } from '@/components/dashboard/menu-editor';
import { KnowledgeBaseRefreshButton } from '@/components/dashboard/knowledge-base-refresh-button';

export const metadata: Metadata = { title: 'Knowledge Base' };

export default async function KnowledgeBasePage() {
  const session = await requireDashboardSession('/knowledge-base');
  const isOwner = session.active.role === 'owner';

  const [catsRes, itemsRes] = await Promise.all([
    listCategories(session.active.workspace_id),
    listItems(session.active.workspace_id),
  ]);

  const categories = !isApiError(catsRes) ? catsRes.data : [];
  const items = !isApiError(itemsRes) ? itemsRes.data : [];

  const itemsByCategory: Record<string, MenuItem[]> = {};
  for (const item of items) {
    if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = [];
    itemsByCategory[item.category_id]!.push(item);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Knowledge Base"
        description="Menu, modifiers, and pricing. This is what your AI agent knows."
        action={<KnowledgeBaseRefreshButton />}
      />
      <MenuEditor
        categories={categories}
        itemsByCategory={itemsByCategory}
        isOwner={isOwner}
      />
    </div>
  );
}
