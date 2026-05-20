import { Button, Input } from '@neo-open-source/ui-web'
import { KeyRound } from '@neo-open-source/icons'
import Modal from '../../Modal'

interface Passkey {
  id: string
  name: string
  credential_id: string
}

interface Props {
  open: boolean
  loading: boolean
  passkeys: Passkey[]
  passkeyName: string
  onClose: () => void
  onPasskeyNameChange: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

export default function PasskeysModal({
  open,
  loading,
  passkeys,
  passkeyName,
  onClose,
  onPasskeyNameChange,
  onAdd,
  onRemove,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Add a passkey">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14, textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--neo-surface-3)' }}>
          <KeyRound size={30} />
        </div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 34, lineHeight: 1 }}>Add a passkey</p>
        <p style={{ margin: 0, color: 'var(--neo-text-muted)', fontSize: 14 }}>Log in faster with your face or fingerprint.</p>
        <div style={{ width: '100%', maxWidth: 340, display: 'grid', gap: 8 }}>
          <Input placeholder="Name this device (optional)" value={passkeyName} onChange={(e) => onPasskeyNameChange(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="sm" disabled={loading} onClick={onAdd}>{loading ? 'Waiting…' : 'Add passkey'}</Button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {loading ? <p style={{ margin: 0, color: 'var(--neo-text-muted)' }}>Loading…</p> : null}
          {!loading && passkeys.length === 0 ? <p style={{ margin: 0, color: 'var(--neo-text-muted)' }}>No passkeys yet</p> : null}
          {passkeys.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--neo-border-subtle)', background: 'var(--neo-surface-3)' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{p.name}</p>
                <p style={{ margin: 0, color: 'var(--neo-text-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.credential_id}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRemove(p.id)}>Remove</Button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

