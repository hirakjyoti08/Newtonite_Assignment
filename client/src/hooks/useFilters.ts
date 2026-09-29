import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';
import { WorkItemsFilters } from '../components/FilterBar';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getFilters = useCallback((): WorkItemsFilters => {
    return {
      status: searchParams.get('status')?.split(',').filter(Boolean) || undefined,
      priority: searchParams.get('priority')?.split(',').filter(Boolean) || undefined,
      type: searchParams.get('type')?.split(',').filter(Boolean) || undefined,
      teamId: searchParams.get('teamId') || undefined,
      assigneeId: searchParams.get('assigneeId') || undefined,
      search: searchParams.get('search') || undefined,
    };
  }, [searchParams]);

  const setFilter = useCallback((key: keyof WorkItemsFilters, value: string | string[] | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      params.delete(key);
    } else if (Array.isArray(value)) {
      params.set(key, value.join(','));
    } else {
      params.set(key, value);
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return {
    filters: getFilters(),
    setFilter,
    clearFilters,
  };
}