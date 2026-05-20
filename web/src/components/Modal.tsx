import { type ReactNode } from 'react'
import { X } from '@neo-open-source/icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 420 }: ModalProps) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)', animation: 'neoModalFade 180ms ease' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1000, width: `min(${maxWidth}px, calc(100vw - 32px))`,
        background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)',
        borderRadius: 28, boxShadow: 'var(--neo-shadow-lg)',
        maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', animation: 'neoModalIn 220ms var(--neo-ease-spring)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 20px 0', flexShrink: 0 }}>
          {title ? <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--neo-text-primary)' }}>{title}</div> : <div />}
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: 0, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--neo-surface-3)', color: 'var(--neo-text-primary)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>{footer}</div>}
      </div>
      <style>{`
        @keyframes neoModalFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes neoModalIn {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)) scale(0.98); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}
