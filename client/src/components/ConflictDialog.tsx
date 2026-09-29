import { WorkItemResponse } from '@shared/types';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  currentState: WorkItemResponse | null;
  attemptedChanges: Record<string, unknown>;
}

export function ConflictDialog({ isOpen, onClose, onReload, currentState, attemptedChanges }: ConflictDialogProps) {
  if (!isOpen || !currentState) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.header}>
          <h2 style={styles.title}>Conflict Detected</h2>
        </header>
        <div style={styles.content}>
          <p style={styles.message}>
            This work item has been modified by another user. Your changes conflict with the current state.
          </p>
          
          <div style={styles.comparison}>
            <div style={styles.column}>
              <h3 style={styles.columnTitle}>Current State (Server)</h3>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Title</span>
                <span style={styles.fieldValue}>{currentState.title}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Status</span>
                <StatusBadge status={currentState.status} />
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Priority</span>
                <PriorityIndicator priority={currentState.priority} />
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Version</span>
                <span style={styles.fieldValue}>{currentState.version}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Assignee</span>
                <span style={styles.fieldValue}>{currentState.assignee?.name || 'Unassigned'}</span>
              </div>
            </div>
            
            <div style={styles.column}>
              <h3 style={styles.columnTitle}>Your Attempted Changes</h3>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Title</span>
                <span style={styles.fieldValue}>{String(attemptedChanges.title ?? '—')}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Status</span>
                <span style={styles.fieldValue}>{String(attemptedChanges.status ?? '—')}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Priority</span>
                <span style={styles.fieldValue}>{String(attemptedChanges.priority ?? '—')}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Version (stale)</span>
                <span style={styles.fieldValue}>{String(attemptedChanges.version ?? '—')}</span>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Assignee</span>
                <span style={styles.fieldValue}>{String(attemptedChanges.assigneeId ?? '—')}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div style={styles.actions}>
          <button onClick={onReload} style={styles.primaryButton}>
            Reload Latest
          </button>
          <button onClick={onClose} style={styles.secondaryButton}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

import { StatusBadge } from './StatusBadge';
import { PriorityIndicator } from './PriorityIndicator';

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 50,
  },
  modal: {
    width: '100%',
    maxWidth: '720px',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  },
  content: {
    padding: '20px',
  },
  message: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: '#4b5563',
  },
  comparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  column: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
  },
  columnTitle: {
    margin: '0 0 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  fieldValue: {
    fontSize: '14px',
    color: '#374151',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #e5e7eb',
  },
  primaryButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};