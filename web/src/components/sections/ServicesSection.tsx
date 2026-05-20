import { Button } from '@neo-open-source/ui-web'
import type { ReactNode } from 'react'
import type { UserServicesItem, UserServicesResponse } from '../../types/app'
import styles from '../../styles/ServicesSection.module.css'

export default function ServicesSection({ services, onConnect, onDisconnect }: { services: UserServicesResponse; onConnect: (n: string) => void; onDisconnect: (n: string) => void }) {
  const card = (title: string, items: UserServicesItem[], action: (s: UserServicesItem) => ReactNode) => (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      {items.length === 0
        ? <p className={styles.empty}>No services</p>
        : items.map((s) => (
          <div key={s.name} className={styles.item}>
            <div>
              <p className={styles.itemName}>{s.display_name || s.name}</p>
              {s.description && <p className={styles.itemDesc}>{s.description}</p>}
            </div>
            {action(s)}
          </div>
        ))}
    </div>
  )

  return (
    <div className={styles.root}>
      <div className={styles.stack}>
        {card('Connected', services.connected_services || [], s => <Button variant="danger" size="sm" onClick={() => onDisconnect(s.name)}>Disconnect</Button>)}
        {(services.available_services || []).length > 0 && card('Available', services.available_services || [], s => <Button variant="secondary" size="sm" onClick={() => onConnect(s.name)}>Connect</Button>)}
      </div>
    </div>
  )
}
