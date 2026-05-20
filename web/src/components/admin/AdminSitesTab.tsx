import { Badge, Button, Spinner } from '@neo-open-source/ui-web'
import type { AdminSite } from '../../types/app'
import styles from '../../styles/AdminPage.module.css'

interface AdminSitesTabProps {
  sites: AdminSite[]
  sitesLoading: boolean
  onRefresh: () => void
  onDeleteSite: (siteId: string) => void
}

export default function AdminSitesTab({ sites, sitesLoading, onRefresh, onDeleteSite }: AdminSitesTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sitesHeader}>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={sitesLoading}>
          Refresh
        </Button>
      </div>

      {sitesLoading ? (
        <div className={styles.sitesLoadingWrap}>
          <Spinner />
        </div>
      ) : null}

      <div className={styles.sitesList}>
        {!sitesLoading && sites.length === 0 ? (
          <p className={styles.emptyText}>No registered services</p>
        ) : (
          sites.map((s) => (
            <div key={s.site_id} className={styles.siteRow}>
              <div className={styles.siteMain}>
                <p className={styles.rowTitle}>{s.name}</p>
                <p className={styles.rowSubtle}>{s.domain}</p>
              </div>
              <p className={styles.siteOwner}>{s.owner_email}</p>
              <div className={styles.siteActions}>
                <Badge>{s.plan || 'free'}</Badge>
                <Badge className={`${styles.statusBadge} ${s.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive}`} tone={s.is_active ? 'success' : undefined}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button className={styles.siteDeleteButton} variant="danger" size="sm" onClick={() => onDeleteSite(s.site_id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
