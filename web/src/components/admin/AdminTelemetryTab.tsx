import { Button } from '@neo-open-source/ui-web'
import type { TelemetryEvent } from '../../types/app'
import styles from '../../styles/AdminPage.module.css'

interface AdminTelemetryTabProps {
  events: TelemetryEvent[]
  loading: boolean
  onRefresh: () => void
}

export default function AdminTelemetryTab({ events, loading, onRefresh }: AdminTelemetryTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sitesHeader}>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </div>
      <div className={styles.sitesList}>
        {!loading && events.length === 0 ? <p className={styles.emptyText}>No telemetry events</p> : null}
        {events.map((e, idx) => (
          <div key={e.id || `${e.created_at}-${idx}`} className={styles.siteRow}>
            <div className={styles.siteMain}>
              <p className={styles.rowTitle}>{e.message}</p>
              <p className={styles.rowSubtle}>{e.route || 'unknown route'} • {e.email || 'anonymous'}</p>
              {e.details ? <p className={styles.rowSubtle}>{e.details}</p> : null}
            </div>
            <p className={styles.siteOwner}>{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

