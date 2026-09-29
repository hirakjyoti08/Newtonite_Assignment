import { TimelineEntry } from '@shared/types';

interface ActivityTimelineProps {
  entries: TimelineEntry[];
}

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return <div style={styles.empty}>No activity yet</div>;
  }

  return (
    <div style={styles.timeline}>
      {entries.map((entry) => (
        <div key={entry.id} style={styles.item}>
          <div style={styles.marker} />
          <div style={styles.content}>
            <div style={styles.meta}>
              <span style={styles.user}>{entry.userName}</span>
              <span style={styles.time}>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            {entry.type === 'event' && (
              <div style={styles.event}>
                {entry.action && (
                  <span style={styles.action}>
                    {entry.action.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
                {entry.changes && Object.entries(entry.changes).map(([field, change]) => (
                  <div key={field} style={styles.change}>
                    <span style={styles.field}>{field}:</span>
                    <span style={styles.from}>{String(change.from)}</span>
                    <span style={styles.arrow}>→</span>
                    <span style={styles.to}>{String(change.to)}</span>
                  </div>
                ))}
              </div>
            )}
            {entry.type === 'comment' && (
              <div style={styles.comment}>{entry.body}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  timeline: {
    position: 'relative',
    paddingLeft: '20px',
  },
  item: {
    position: 'relative',
    paddingBottom: '24px',
  },
  marker: {
    position: 'absolute',
    left: '-20px',
    top: '2px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#d1d5db',
    border: '2px solid #fff',
    boxShadow: '0 0 0 1px #d1d5db',
  },
  content: {
    paddingLeft: '12px',
    borderLeft: '1px solid #e5e7eb',
    paddingBottom: '16px',
  },
  meta: {
    display: 'flex',
    gap: '12px',
    marginBottom: '4px',
    fontSize: '12px',
  },
  user: {
    fontWeight: 500,
    color: '#374151',
  },
  time: {
    color: '#9ca3af',
  },
  event: {
    fontSize: '13px',
    color: '#4b5563',
  },
  action: {
    fontWeight: 500,
    color: '#111827',
  },
  change: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  field: {
    fontWeight: 500,
    color: '#374151',
  },
  from: {
    color: '#dc2626',
    textDecoration: 'line-through',
  },
  arrow: {
    color: '#9ca3af',
  },
  to: {
    color: '#059669',
    fontWeight: 500,
  },
  comment: {
    marginTop: '4px',
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#374151',
    whiteSpace: 'pre-wrap',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
  },
};