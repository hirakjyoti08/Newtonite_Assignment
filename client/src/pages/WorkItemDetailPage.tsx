import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { WorkItemStatus, WorkItemPriority } from '@shared/types';
import { useWorkItem, useUpdateWorkItem, useTransitionWorkItem, useAssignWorkItem, useWorkItemTimeline, useCreateComment } from '../api/queries/workItems';
import { useTeams, useTeamMembers } from '../api/queries/teams';
import { useSSE } from '../hooks/useSSE';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityIndicator } from '../components/PriorityIndicator';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { ConflictDialog } from '../components/ConflictDialog';
import { StaleBanner } from '../components/StaleBanner';
import { WorkItemForm } from '../components/WorkItemForm';

export function WorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [conflict, setConflict] = useState<{ currentState: any; attemptedChanges: any } | null>(null);
  const [staleInfo, setStaleInfo] = useState<{ updatedBy: string; updatedByName: string; timestamp: string } | null>(null);

  const { data: workItem, isLoading, error, refetch } = useWorkItem(id!);
  const updateMutation = useUpdateWorkItem();
  const transitionMutation = useTransitionWorkItem();
  const assignMutation = useAssignWorkItem();
  const { data: timelineData } = useWorkItemTimeline(id!);
  const createCommentMutation = useCreateComment();
  const { data: teams } = useTeams();
  const { data: members } = useTeamMembers(workItem?.team.id || '');

  // SSE for real-time updates
  useSSE(`/api/events/work-items/${id}`, (event) => {
    if (event.type === 'WORK_ITEM_UPDATED') {
      setStaleInfo({
        updatedBy: event.updatedBy,
        updatedByName: event.updatedByName,
        timestamp: event.timestamp,
      });
    }
  }, !!workItem);

  // Initialize edit data when work item loads
  useEffect(() => {
    if (workItem && !isEditing) {
      setEditData({
        title: workItem.title,
        description: workItem.description || '',
        type: workItem.type,
        priority: workItem.priority,
        teamId: workItem.team.id,
        assigneeId: workItem.assignee?.id || '',
        dueDate: workItem.dueDate || '',
      });
    }
  }, [workItem, isEditing]);

  const handleEditToggle = () => {
    if (!isEditing) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
      setEditData({
        title: workItem?.title,
        description: workItem?.description || '',
        type: workItem?.type,
        priority: workItem?.priority,
        teamId: workItem?.team.id,
        assigneeId: workItem?.assignee?.id || '',
        dueDate: workItem?.dueDate || '',
      });
    }
  };

  const handleEditChange = (key: string, value: any) => {
    setEditData((prev: Record<string, any>) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: workItem!.id,
        data: { ...editData, version: workItem!.version },
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.error?.currentState) {
        setConflict({
          currentState: err.response.data.error.currentState,
          attemptedChanges: editData,
        });
      }
      throw err;
    }
  };

  const handleTransition = async (newStatus: WorkItemStatus) => {
    try {
      await transitionMutation.mutateAsync({
        id: workItem!.id,
        data: { status: newStatus, version: workItem!.version },
      });
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.error?.currentState) {
        setConflict({
          currentState: err.response.data.error.currentState,
          attemptedChanges: { status: newStatus, version: workItem!.version },
        });
      }
      throw err;
    }
  };

  const handleAssign = async (assigneeId: string | null) => {
    try {
      await assignMutation.mutateAsync({
        id: workItem!.id,
        data: { assigneeId, version: workItem!.version },
      });
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.error?.currentState) {
        setConflict({
          currentState: err.response.data.error.currentState,
          attemptedChanges: { assigneeId, version: workItem!.version },
        });
      }
      throw err;
    }
  };

  const handleCommentSubmit = async (body: string) => {
    await createCommentMutation.mutateAsync({ id: id!, body });
    queryClient.invalidateQueries({ queryKey: ['workItemTimeline', id] });
  };

  const handleConflictReload = () => {
    setConflict(null);
    refetch();
  };

  const handleStaleRefresh = () => {
    setStaleInfo(null);
    refetch();
  };

  const handleStaleDismiss = () => {
    setStaleInfo(null);
  };

  const handleFormClose = () => {
    setIsEditing(false);
    setEditData({
      title: workItem?.title,
      description: workItem?.description || '',
      type: workItem?.type,
      priority: workItem?.priority,
      teamId: workItem?.team.id,
      assigneeId: workItem?.assignee?.id || '',
      dueDate: workItem?.dueDate || '',
    });
  };

  if (isLoading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>Failed to load work item</div>;
  if (!workItem) return <div style={styles.error}>Work item not found</div>;

  const allowedTransitions = getAllowedTransitions(workItem.status);

  return (
    <div style={styles.page}>
      <StaleBanner
        isVisible={!!staleInfo}
        updatedByName={staleInfo?.updatedByName || 'Someone'}
        updatedAt={staleInfo?.timestamp || ''}
        onRefresh={handleStaleRefresh}
        onDismiss={handleStaleDismiss}
      />

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>{workItem.title}</h1>
          <div style={styles.badges}>
            <StatusBadge status={workItem.status} />
            <PriorityIndicator priority={workItem.priority} />
            <span style={styles.typeBadge}>{workItem.type}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.version}>v{workItem.version}</span>
          <button onClick={handleEditToggle} style={styles.editButton}>
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </button>
        </div>
      </header>

      {isEditing ? (
        <WorkItemForm
          teams={teams || []}
          initialData={editData}
          onSubmit={handleSave}
          onClose={handleFormClose}
          isSubmitting={updateMutation.isPending || transitionMutation.isPending || assignMutation.isPending}
        />
      ) : (
        <>
          <div style={styles.detailGrid}>
            <section style={styles.section} aria-labelledby="details-heading">
              <h2 id="details-heading" style={styles.sectionTitle}>Details</h2>
              <dl style={styles.detailsList}>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Description</dt>
                  <dd style={styles.detailValue}>{workItem.description || '—'}</dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Reporter</dt>
                  <dd style={styles.detailValue}>{workItem.reporter.name} ({workItem.reporter.email})</dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Assignee</dt>
                  <dd style={styles.detailValue}>
                    {workItem.assignee ? (
                      <>
                        {workItem.assignee.name} 
                        <button onClick={() => handleAssign(null)} style={styles.unassignButton}>
                          Unassign
                        </button>
                      </>
                    ) : (
                      <>
                        — 
                        <select onChange={(e) => handleAssign(e.target.value)} style={styles.assignSelect}>
                          <option value="">Assign...</option>
                          {/* eslint-disable @typescript-eslint/no-explicit-any */}
                        {members?.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.user?.name || m.name}</option>
                        ))}
                        </select>
                      </>
                    )}
                  </dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Team</dt>
                  <dd style={styles.detailValue}>{workItem.team.name}</dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Due Date</dt>
                  <dd style={styles.detailValue}>{workItem.dueDate ? new Date(workItem.dueDate).toLocaleDateString() : '—'}</dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Created</dt>
                  <dd style={styles.detailValue}>{new Date(workItem.createdAt).toLocaleString()}</dd>
                </div>
                <div style={styles.detailRow}>
                  <dt style={styles.detailLabel}>Updated</dt>
                  <dd style={styles.detailValue}>{new Date(workItem.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </section>

            <section style={styles.section} aria-labelledby="actions-heading">
              <h2 id="actions-heading" style={styles.sectionTitle}>Actions</h2>
              <div style={styles.actionsGrid}>
                <div>
                  <label style={styles.actionLabel}>Status</label>
                  <select
                    value={workItem.status}
                    onChange={(e) => handleTransition(e.target.value as WorkItemStatus)}
                    disabled={transitionMutation.isPending}
                    style={styles.actionSelect}
                  >
                    {allowedTransitions.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.actionLabel}>Priority</label>
                  <select
                    value={workItem.priority}
                    onChange={(e) => {
                      handleEditChange('priority', e.target.value);
                      handleSave();
                    }}
                    disabled={updateMutation.isPending}
                    style={styles.actionSelect}
                  >
                    {Object.values(WorkItemPriority).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </div>

          <section style={styles.section} aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" style={styles.sectionTitle}>Activity Timeline</h2>
            <div style={styles.commentForm}>
              <textarea
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                style={styles.commentInput}
                rows={3}
              />
            </div>
            <ActivityTimeline entries={timelineData?.items || []} />
          </section>
        </>
      )}

      <ConflictDialog
        isOpen={!!conflict}
        onClose={() => setConflict(null)}
        onReload={handleConflictReload}
        currentState={conflict?.currentState || null}
        attemptedChanges={conflict?.attemptedChanges || {}}
      />
    </div>
  );
}

function getAllowedTransitions(currentStatus: WorkItemStatus): WorkItemStatus[] {
  const transitions: Record<WorkItemStatus, WorkItemStatus[]> = {
    OPEN: [WorkItemStatus.TRIAGED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
    TRIAGED: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED],
    IN_PROGRESS: [WorkItemStatus.BLOCKED, WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED],
    BLOCKED: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
    RESOLVED: [WorkItemStatus.CLOSED, WorkItemStatus.IN_PROGRESS],
    CLOSED: [WorkItemStatus.OPEN],
  };
  return transitions[currentStatus] || [];
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  loading: {
    padding: '48px',
    textAlign: 'center',
    color: '#9ca3af',
  },
  error: {
    padding: '48px',
    textAlign: 'center',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    margin: '0 0 12px',
    fontSize: '28px',
    fontWeight: 600,
    color: '#111827',
    wordBreak: 'break-word',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  typeBadge: {
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  version: {
    fontSize: '13px',
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  editButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  section: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailRow: {
    display: 'flex',
    gap: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  detailLabel: {
    width: '120px',
    flexShrink: 0,
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
  },
  detailValue: {
    flex: 1,
    fontSize: '14px',
    color: '#374151',
    margin: 0,
  },
  unassignButton: {
    marginLeft: '8px',
    padding: '2px 8px',
    fontSize: '12px',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  assignSelect: {
    marginLeft: '8px',
    padding: '4px 8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  actionLabel: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  actionSelect: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  commentForm: {
    marginBottom: '16px',
  },
  commentInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
};