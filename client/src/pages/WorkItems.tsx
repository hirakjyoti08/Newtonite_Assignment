import { useState } from 'react';
import { useWorkItems, useCreateWorkItem } from '../api/queries/workItems';
import { useTeams, useTeamMembers } from '../api/queries/teams';
import { FilterBar, WorkItemsFilters } from '../components/FilterBar';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityIndicator } from '../components/PriorityIndicator';
import { WorkItemForm } from '../components/WorkItemForm';

export function WorkItemsPage() {
  const [filters, setFilters] = useState<WorkItemsFilters>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: teams } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const { data: rawMembers } = useTeamMembers(selectedTeamId || teams?.[0]?.id || '');
  const members = rawMembers?.map((m: any) => ({ id: m.id, name: m.user?.name, user: m.user })) || [];
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useWorkItems(filters);
  const createMutation = useCreateWorkItem();

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create work item:', err);
    }
  };

  const items = data?.pages.flatMap((p) => p.items) || [];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Work Items</h1>
        <button onClick={() => { setSelectedTeamId(teams?.[0]?.id || ''); setShowCreateModal(true); }} style={styles.createButton}>
          Create Work Item
        </button>
      </header>

      <FilterBar
        onFiltersChange={setFilters}
        teams={teams || []}
        members={members || []}
      />

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Assignee</th>
              <th style={styles.th}>Team</th>
              <th style={styles.th}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={styles.tr} onClick={() => window.location.href = `/work-items/${item.id}`}>
                <td style={styles.tdTitle}>
                  <a href={`/work-items/${item.id}`} style={styles.titleLink}>{item.title}</a>
                </td>
                <td style={styles.td}><StatusBadge status={item.status} /></td>
                <td style={styles.td}><PriorityIndicator priority={item.priority} /></td>
                <td style={styles.td}>{item.type}</td>
                <td style={styles.td}>{item.assignee?.name || '—'}</td>
                <td style={styles.td}>{item.team.name}</td>
                <td style={styles.td}>{new Date(item.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div style={styles.loadMoreWrapper}>
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={styles.loadMoreButton}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div style={styles.empty}>
          No work items found. <button onClick={() => { setSelectedTeamId(teams?.[0]?.id || ''); setShowCreateModal(true); }} style={styles.emptyLink}>Create one</button>
        </div>
      )}

      {showCreateModal && (
        <WorkItemForm
          teams={teams || []}
          initialTeamId={selectedTeamId || teams?.[0]?.id}
          onSubmit={handleCreate}
          onClose={() => setShowCreateModal(false)}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#111827',
  },
  createButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#111827',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '800px',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color 150ms',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
  },
  tdTitle: {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    maxWidth: '300px',
  },
  titleLink: {
    color: '#111827',
    textDecoration: 'none',
    fontWeight: 500,
  },
  loadMoreWrapper: {
    padding: '16px',
    textAlign: 'center',
  },
  loadMoreButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  empty: {
    padding: '48px',
    textAlign: 'center',
    color: '#9ca3af',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  emptyLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
    marginLeft: '8px',
  },
};