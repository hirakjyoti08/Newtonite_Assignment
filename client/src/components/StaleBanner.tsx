interface StaleBannerProps {
  isVisible: boolean;
  updatedByName: string;
  updatedAt: string;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function StaleBanner({ isVisible, updatedByName, updatedAt, onRefresh, onDismiss }: StaleBannerProps) {
  if (!isVisible) return null;

  return (
    <div style={styles.banner} role="alert">
      <div style={styles.content}>
        <span style={styles.icon}>⟳</span>
        <span style={styles.text}>
          This item was updated by <strong>{updatedByName}</strong> at {new Date(updatedAt).toLocaleTimeString()}.
        </span>
        <button onClick={onRefresh} style={styles.refreshButton}>
          Click to refresh
        </button>
      </div>
      <button onClick={onDismiss} style={styles.dismissButton} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  icon: {
    fontSize: '16px',
    color: '#b45309',
    animation: 'spin 1s linear infinite',
  },
  text: {
    fontSize: '13px',
    color: '#92400e',
  },
  refreshButton: {
    marginLeft: '8px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#b45309',
    backgroundColor: '#fff',
    border: '1px solid #fcd34d',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  dismissButton: {
    padding: '4px 8px',
    fontSize: '18px',
    lineHeight: 1,
    color: '#92400e',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
};