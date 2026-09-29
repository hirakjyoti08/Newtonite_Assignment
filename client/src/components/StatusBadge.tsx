import { WorkItemStatus } from '@shared/types';

interface StatusBadgeProps {
  status: WorkItemStatus;
}

const statusStyles: Record<WorkItemStatus, { bg: string; text: string }> = {
  OPEN: { bg: '#dbeafe', text: '#1d4ed8' },
  TRIAGED: { bg: '#fef3c7', text: '#b45309' },
  IN_PROGRESS: { bg: '#e0e7ff', text: '#4338ca' },
  BLOCKED: { bg: '#fee2e2', text: '#dc2626' },
  RESOLVED: { bg: '#d1fae5', text: '#059669' },
  CLOSED: { bg: '#f3f4f6', text: '#4b5563' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.OPEN;
  return (
    <span
      style={{
        ...styles.badge,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '9999px',
    whiteSpace: 'nowrap',
  },
};