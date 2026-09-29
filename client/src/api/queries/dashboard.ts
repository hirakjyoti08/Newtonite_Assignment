import { useQuery } from '@tanstack/react-query';
import api from '../client';
import type { WorkItemResponse, WorkItemStatus, WorkItemPriority, TimelineEntry } from '@shared/types';

export interface DashboardSummaryResponse {
  totalOpen: number;
  totalCritical: number;
  totalAssignedToMe: number;
  byStatus: Record<WorkItemStatus, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: TimelineEntry[];
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummaryResponse>('/dashboard/summary').then((res) => res.data),
  });
}

export function useMyItems() {
  return useQuery({
    queryKey: ['dashboard', 'my-items'],
    queryFn: () => api.get<WorkItemResponse[]>('/dashboard/my-items').then((res) => res.data),
  });
}