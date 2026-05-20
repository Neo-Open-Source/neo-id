import { Button, Input, Badge, Spinner } from '@neo-open-source/ui-web'
import type { AdminNewServicePayload, AdminService } from '../../types/app'
import styles from '../../styles/AdminPage.module.css'

interface AdminServicesTabProps {
  services: AdminService[]
  servicesLoading: boolean
  newService: AdminNewServicePayload
  onNewServiceChange: (patch: Partial<AdminNewServicePayload>) => void
  onCreateService: () => void
}

export default function AdminServicesTab({
  services,
  servicesLoading,
  newService,
  onNewServiceChange,
  onCreateService,
}: AdminServicesTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.createCard}>
        <p className={styles.createTitle}>Create service</p>
        <div className={styles.createForm}>
          <Input placeholder="Name" value={newService.name} onChange={(e) => onNewServiceChange({ name: e.target.value })} />
          <Input placeholder="Display name" value={newService.display_name} onChange={(e) => onNewServiceChange({ display_name: e.target.value })} />
          <Input placeholder="Description" value={newService.description} onChange={(e) => onNewServiceChange({ description: e.target.value })} />
          <Button className={styles.createButton} size="sm" onClick={onCreateService}>
            Create
          </Button>
        </div>
      </div>

      {servicesLoading ? (
        <div className={styles.servicesLoadingWrap}>
          <Spinner />
        </div>
      ) : null}

      <div className={styles.servicesList}>
        {!servicesLoading && services.length === 0 ? (
          <p className={styles.emptyText}>No services</p>
        ) : (
          services.map((s) => (
            <div key={s.name} className={styles.serviceRow}>
              <div className={styles.serviceMain}>
                <p className={styles.serviceNameMono}>{s.name}</p>
                <p className={styles.rowSubtle}>{s.display_name}</p>
              </div>
              <Badge className={`${styles.statusBadge} ${s.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive}`} tone={s.is_active ? 'success' : undefined}>
                {s.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
