import 'server-only';
import { apiCall } from './client';
import type { AnalyticsSummary, TodayStats } from '@/lib/types';

export function getAnalyticsSummary(workspaceId: string, days = 30) {
  return apiCall<AnalyticsSummary>(
    `/v1/workspaces/${workspaceId}/analytics/summary?days=${days}`,
    { cache: 'no-store' },
  );
}

export function getTodayStats(workspaceId: string) {
  return apiCall<TodayStats>(`/v1/workspaces/${workspaceId}/analytics/today`, {
    cache: 'no-store',
  });
}
