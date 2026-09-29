import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkItemStatus, WorkItemPriority, WorkItemType } from '@shared/types';

interface FilterBarProps {
  onFiltersChange: (filters: WorkItemsFilters) => void;
  teams: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string; user?: { name: string } }>;
}

export interface WorkItemsFilters {
  status?: string[];
  priority?: string[];
  type?: string[];
  teamId?: string;
  assigneeId?: string;
  search?: string;
}

const statusOptions = Object.values(WorkItemStatus);
const priorityOptions = Object.values(WorkItemPriority);
const typeOptions = Object.values(WorkItemType);

export function FilterBar({ onFiltersChange, teams, members }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [priority, setPriority] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    const statusParam = searchParams.get('status')?.split(',').filter(Boolean) || [];
    const priorityParam = searchParams.get('priority')?.split(',').filter(Boolean) || [];
    const typeParam = searchParams.get('type')?.split(',').filter(Boolean) || [];
    const teamParam = searchParams.get('teamId') || '';
    const assigneeParam = searchParams.get('assigneeId') || '';
    const searchParam = searchParams.get('search') || '';

    setStatus(statusParam);
    setPriority(priorityParam);
    setType(typeParam);
    setTeamId(teamParam);
    setAssigneeId(assigneeParam);
    setSearch(searchParam);
  }, [searchParams]);

  const updateFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (status.length) params.set('status', status.join(','));
    if (priority.length) params.set('priority', priority.join(','));
    if (type.length) params.set('type', type.join(','));
    if (teamId) params.set('teamId', teamId);
    if (assigneeId) params.set('assigneeId', assigneeId);
    if (search) params.set('search', search);
    setSearchParams(params, { replace: true });

    onFiltersChange({ status, priority, type, teamId: teamId || undefined, assigneeId: assigneeId || undefined, search: search || undefined });
  }, [status, priority, type, teamId, assigneeId, search, setSearchParams, onFiltersChange]);

  useEffect(() => {
    const timeout = setTimeout(updateFilters, 300);
    return () => clearTimeout(timeout);
  }, [updateFilters]);

  const clearFilters = () => {
    setStatus([]);
    setPriority([]);
    setType([]);
    setTeamId('');
    setAssigneeId('');
    setSearch('');
  };

  const hasActiveFilters = status.length || priority.length || type.length || teamId || assigneeId || search;

  return (
    <div style={styles.bar}>
      <div style={styles.searchWrapper}>
        <input
          type="text"
          placeholder="Search title, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.filterGroup}>
        <select
          multiple
          value={status}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, (o) => o.value);
            setStatus(values);
          }}
          style={styles.select}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div style={styles.filterGroup}>
        <select
          multiple
          value={priority}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, (o) => o.value);
            setPriority(values);
          }}
          style={styles.select}
        >
          {priorityOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={styles.filterGroup}>
        <select
          multiple
          value={type}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, (o) => o.value);
            setType(values);
          }}
          style={styles.select}
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div style={styles.filterGroup}>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.select}>
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.filterGroup}>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={styles.select}>
          <option value="">All Assignees</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button onClick={clearFilters} style={styles.clearButton}>
          Clear filters
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '16px',
    alignItems: 'flex-end',
  },
  searchWrapper: {
    flex: 1,
    minWidth: '200px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '150px',
  },
  select: {
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    minHeight: '38px',
  },
  clearButton: {
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    height: '38px',
  },
};