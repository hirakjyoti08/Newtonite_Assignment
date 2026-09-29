import { WorkItemPriority } from '@shared/types';

interface PriorityIndicatorProps {
  priority: WorkItemPriority;
}

const priorityStyles: Record<WorkItemPriority, { bg: string; text: string; icon: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626', icon: '⚠' },
  HIGH: { bg: '#fff7ed', text: '#ea580c', icon: '▲' },
  MEDIUM: { bg: '#fefce8', text: '#ca8a04', icon: '●' },
  LOW: { bg: '#f3f4f6', text: '#6b7280', icon: '○' },
};

export function PriorityIndicator({ priority }: PriorityIndicatorProps) {
  const style = priorityStyles[priority] || priorityStyles.MEDIUM;
  return (
    <span
      style={{
        ...styles.indicator,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      <span style={styles.icon}>{style.icon}</span>
      <span style={styles.text}>{priority}</span>
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  icon: {
    fontSize: '10px',
    lineHeight: 1,
  },
  text: {
    textTransform: 'capitalize',
  },
};