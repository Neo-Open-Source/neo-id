import { Button, Input } from '@neo-open-source/ui-web'
import Modal from '../Modal'
import styles from '../../styles/AdminPage.module.css'

interface BanUserModalProps {
  open: boolean
  reason: string
  duration: string
  onClose: () => void
  onReasonChange: (value: string) => void
  onDurationChange: (value: string) => void
  onConfirm: () => void
}

export default function BanUserModal({
  open,
  reason,
  duration,
  onClose,
  onReasonChange,
  onDurationChange,
  onConfirm,
}: BanUserModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ban user"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Ban
          </Button>
        </>
      }
    >
      <div className={styles.banModalBody}>
        <Input placeholder="Reason" value={reason} onChange={(e) => onReasonChange(e.target.value)} autoFocus />
        <select className={styles.banDurationSelect} value={duration} onChange={(e) => onDurationChange(e.target.value)}>
          <option value="permanent">Permanent</option>
          <option value="168h">7 days</option>
          <option value="720h">30 days</option>
        </select>
      </div>
    </Modal>
  )
}
