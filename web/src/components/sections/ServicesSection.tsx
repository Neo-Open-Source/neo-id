import { Button } from '@neo-open-source/ui-web'

interface Service { name: string; display_name?: string; description?: string }
interface Services { connected_services?: Service[]; available_services?: Service[] }

export default function ServicesSection({ services, onConnect, onDisconnect }: { services: Services; onConnect: (n: string) => void; onDisconnect: (n: string) => void }) {
  const card = (title: string, items: Service[], action: (s: Service) => React.ReactNode) => (
    <div style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 22, padding: 20 }}>
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15 }}>{title}</p>
      {items.length === 0
        ? <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>No services</p>
        : items.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid var(--neo-border-subtle)' : 'none' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{s.display_name || s.name}</p>
              {s.description && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neo-text-muted)' }}>{s.description}</p>}
            </div>
            {action(s)}
          </div>
        ))}
    </div>
  )

  return (
    <div style={{ width: 'min(100%, 760px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {card('Connected', services.connected_services || [], s => <Button variant="danger" size="sm" onClick={() => onDisconnect(s.name)}>Disconnect</Button>)}
        {(services.available_services || []).length > 0 && card('Available', services.available_services || [], s => <Button variant="secondary" size="sm" onClick={() => onConnect(s.name)}>Connect</Button>)}
      </div>
    </div>
  )
}
