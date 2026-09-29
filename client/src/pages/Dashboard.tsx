import { Link } from 'react-router-dom';
import { useDashboardSummary, useMyItems } from '../api/queries/dashboard';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityIndicator } from '../components/PriorityIndicator';

export function DashboardPage() {
  const { data: summary } = useDashboardSummary();
  const { data: myItems, isLoading: myItemsLoading } = useMyItems();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Overview of your work items</p>
      </header>

      <section style={styles.summaryGrid} aria-label="Summary statistics">
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{summary?.totalOpen ?? 0}</div>
          <div style={styles.summaryLabel}>Open Items</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: '#dc2626' }}>{summary?.totalCritical ?? 0}</div>
          <div style={styles.summaryLabel}>Critical Priority</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{summary?.totalAssignedToMe ?? 0}</div>
          <div style={styles.summaryLabel}>Assigned to Me</div>
        </div>
      </section>

      <div style={styles.twoColumn}>
        <section style={styles.section} aria-labelledby="my-items-heading">
          <h2 id="my-items-heading" style={styles.sectionTitle}>My Items</h2>
          {myItemsLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : myItems && myItems.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Priority</th>
                  <th style={styles.th}>Team</th>
                  <th style={styles.th}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {myItems.slice(0, 10).map((item) => (
                  <tr key={item.id} style={styles.tr} onClick={() => window.location.href = `/work-items/${item.id}`}>
                    <td style={styles.td}><Link to={`/work-items/${item.id}`} style={styles.link}>{item.title}</Link></td>
                    <td style={styles.td}><StatusBadge status={item.status} /></td>
                    <td style={styles.td}><PriorityIndicator priority={item.priority} /></td>
                    <td style={styles.td}>{item.team.name}</td>
                    <td style={styles.td}>{new Date(item.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.empty}>No items assigned to you</p>
          )}
        </section>

        <section style={styles.section} aria-labelledby="needs-attention-heading">
          <h2 id="needs-attention-heading" style={styles.sectionTitle}>Needs Attention</h2>
          <p style={styles.empty}>Critical items requiring action</p>
        </section>
      </div>

      <section style={styles.section} aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" style={styles.sectionTitle}>Breakdown</h2>
        <div style={styles.breakdownGrid}>
          <div>
            <h3 style={styles.breakdownTitle}>By Status</h3>
            <div style={styles.breakdownList}>
              {summary && Object.entries(summary.byStatus).map(([status, count]) => (
                <div key={status} style={styles.breakdownItem}>
                  <StatusBadge status={status as any} />
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={styles.breakdownTitle}>By Priority</h3>
            <div style={styles.breakdownList}>
              {summary && Object.entries(summary.byPriority).map(([priority, count]) => (
                <div key={priority} style={styles.breakdownItem}>
                  <PriorityIndicator priority={priority as any} />
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.section} aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading" style={styles.sectionTitle}>Recent Activity</h2>
        <div style={styles.activityList}>
          {summary?.recentActivity.slice(0, 5).map((entry) => (
            <div key={entry.id} style={styles.activityItem}>
              <div style={styles.activityMeta}>
                <span style={styles.activityUser}>{entry.userName}</span>
                <span style={styles.activityTime}>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <div style={styles.activityText}>
                {entry.type === 'event'
                  ? `${entry.action?.replace(/_/g, ' ')}`
                  : `"${entry.body?.slice(0, 100)}..."`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    marginBottom: '8px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '24px',
    fontWeight: 600,
    color: '#111827',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  summaryCard: {
    padding: '20px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  summaryValue: {
    margin: '0 0 4px',
    fontSize: '28px',
    fontWeight: 600,
    color: '#111827',
  },
  summaryLabel: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
  },
  twoColumn: {
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
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
  link: {
    color: '#111827',
    textDecoration: 'none',
  },
  empty: {
    margin: 0,
    padding: '24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
  },
  breakdownGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  breakdownTitle: {
    margin: '0 0 12px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  breakdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#374151',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  activityItem: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
  },
  activityMeta: {
    display: 'flex',
    gap: '12px',
    marginBottom: '4px',
    fontSize: '12px',
  },
  activityUser: {
    fontWeight: 500,
    color: '#374151',
  },
  activityTime: {
    color: '#9ca3af',
  },
  activityText: {
    fontSize: '13px',
    color: '#4b5563',
  },
};