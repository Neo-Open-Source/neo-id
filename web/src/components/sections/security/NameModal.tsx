import { Button, Input } from '@neo-open-source/ui-web'
import Modal from '../../Modal'

interface Props {
  open: boolean
  displayName: string
  firstName: string
  lastName: string
  saving: boolean
  onClose: () => void
  onDisplayNameChange: (value: string) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onSave: () => void
}

export default function NameModal({
  open,
  displayName,
  firstName,
  lastName,
  saving,
  onClose,
  onDisplayNameChange,
  onFirstNameChange,
  onLastNameChange,
  onSave,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Update name">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--neo-text-muted)', paddingLeft: 2 }}>Username</div>
          <Input placeholder="Username" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--neo-text-muted)', paddingLeft: 2 }}>First Name</div>
            <Input placeholder="First Name" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--neo-text-muted)', paddingLeft: 2 }}>Last Name</div>
            <Input placeholder="Last Name" value={lastName} onChange={(e) => onLastNameChange(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </Modal>
  )
}

