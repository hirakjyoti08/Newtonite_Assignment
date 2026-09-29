import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../client';
import type { WorkItemResponse, WorkItemListResponse, CreateWorkItemRequest, UpdateWorkItemRequest, TransitionWorkItemRequest, AssignWorkItemRequest, TimelineEntry } from '@shared/types';

interface WorkItemsQuery {
  status?: string[];
  priority?: string[];
  type?: string[];
  teamId?: string;
  assigneeId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export function useWorkItems(filters: WorkItemsQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['workItems', filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v));
          } else {
            params.set(key, String(value));
          }
        }
      });
      if (pageParam) {
        params.set('cursor', pageParam);
      }
      return api.get<WorkItemListResponse>(`/work-items?${params.toString()}`).then((res) => res.data);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useWorkItem(id: string | undefined) {
  return useQuery({
    queryKey: ['workItem', id],
    queryFn: () => api.get<WorkItemResponse>(`/work-items/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkItemRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return api.post<WorkItemResponse>('/work-items', data, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }).then((res) => res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkItemRequest }) => {
      const idempotencyKey = crypto.randomUUID();
      return api.patch<WorkItemResponse>(`/work-items/${id}`, data, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }).then((res) => res.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workItem', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTransitionWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransitionWorkItemRequest }) => {
      const idempotencyKey = crypto.randomUUID();
      return api.post<WorkItemResponse>(`/work-items/${id}/transition`, data, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }).then((res) => res.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workItem', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAssignWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignWorkItemRequest }) => {
      const idempotencyKey = crypto.randomUUID();
      return api.post<WorkItemResponse>(`/work-items/${id}/assign`, data, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }).then((res) => res.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workItem', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useWorkItemTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['workItemTimeline', id],
    queryFn: () => api.get<{ items: TimelineEntry[]; nextCursor: string | null }>(`/work-items/${id}/timeline`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.post(`/work-items/${id}/comments`, { body }).then((res) => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['workItemTimeline', id] });
    },
  });
}