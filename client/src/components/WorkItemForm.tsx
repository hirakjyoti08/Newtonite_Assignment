import { useState } from 'react';
import { WorkItemType, WorkItemPriority } from '@shared/types';
import { useTeamMembers } from '../api/queries/teams';

interface WorkItemFormProps {
  teams: Array<{ id: string; name: string }>;
  initialTeamId?: string;
  initialData?: {
    title?: string;
    description?: string;
    type?: WorkItemType;
    priority?: WorkItemPriority;
    assigneeId?: string;
    dueDate?: string;
  };
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function WorkItemForm({ teams, initialTeamId, initialData, onSubmit, onClose, isSubmitting }: WorkItemFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [type, setType] = useState<WorkItemType>(initialData?.type || WorkItemType.TASK);
  const [priority, setPriority] = useState<WorkItemPriority>(initialData?.priority || WorkItemPriority.MEDIUM);
  const [teamId, setTeamId] = useState(initialTeamId || teams[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(initialData?.assigneeId || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: members } = useTeamMembers(teamId);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!teamId) newErrors.teamId = 'Team is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      title,
      description: description || undefined,
      type,
      priority,
      teamId,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.header}>
          <h2 style={styles.title}>{initialData ? 'Edit Work Item' : 'Create Work Item'}</h2>
          <button onClick={onClose} style={styles.closeButton} disabled={isSubmitting}>×</button>
        </header>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="title" style={styles.label}>Title *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...styles.input, ...(errors.title ? styles.inputError : {}) }}
              required
              disabled={isSubmitting}
            />
            {errors.title && <span style={styles.errorText}>{errors.title}</span>}
          </div>

          <div style={styles.field}>
            <label htmlFor="description" style={styles.label}>Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.textarea}
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label htmlFor="type" style={styles.label}>Type</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as WorkItemType)}
                style={styles.select}
                disabled={isSubmitting}
              >
                {Object.values(WorkItemType).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label htmlFor="priority" style={styles.label}>Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
                style={styles.select}
                disabled={isSubmitting}
              >
                {Object.values(WorkItemPriority).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label htmlFor="team" style={styles.label}>Team *</label>
            <select
              id="team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              style={styles.select}
              disabled={isSubmitting}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {errors.teamId && <span style={styles.errorText}>{errors.teamId}</span>}
          </div>

          <div style={styles.field}>
            <label htmlFor="assignee" style={styles.label}>Assignee</label>
            <select
              id="assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              style={styles.select}
              disabled={isSubmitting}
            >
              <option value="">Unassigned</option>
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
          {members?.map((m: any) => (
            <option key={m.id} value={m.id}>{m.user?.name || m.name}</option>
          ))}
            </select>
          </div>

          <div style={styles.field}>
            <label htmlFor="dueDate" style={styles.label}>Due Date</label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelButton} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" style={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  },
  closeButton: {
    padding: '4px 8px',
    fontSize: '20px',
    lineHeight: 1,
    color: '#9ca3af',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  form: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    resize: 'vertical',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '12px',
    color: '#dc2626',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  cancelButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#111827',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};