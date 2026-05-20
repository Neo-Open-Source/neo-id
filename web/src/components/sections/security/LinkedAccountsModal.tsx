import { Button } from '@neo-open-source/ui-web'
import { Github, Google } from '@neo-open-source/icons'
import Modal from '../../Modal'

interface Provider {
  provider: string
  external_id?: string
}

interface Props {
  open: boolean
  providers?: Provider[]
  onClose: () => void
  onUnlink?: (provider: string) => void
  onLinkGoogle: () => void
  onLinkGithub: () => void
}

export default function LinkedAccountsModal({ open, providers, onClose, onUnlink, onLinkGoogle, onLinkGithub }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Linked accounts">
      <div style={{ display: 'grid', gap: 12 }}>
        {(providers || []).length === 0 ? <p style={{ margin: 0, color: 'var(--neo-text-muted)' }}>No linked providers</p> : (providers || []).map((p) => (
          <div key={p.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--neo-border-subtle)', borderRadius: 18, background: 'var(--neo-surface-3)' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{p.provider}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--neo-text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.external_id}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onUnlink?.(p.provider)}>Unlink</Button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
          <Button variant="secondary" size="sm" onClick={onLinkGoogle}><Google size={14} /> Link Google</Button>
          <Button variant="secondary" size="sm" onClick={onLinkGithub}><Github size={14} /> Link GitHub</Button>
        </div>
      </div>
    </Modal>
  )
}

