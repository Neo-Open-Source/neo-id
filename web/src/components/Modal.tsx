import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setClosing(false)
      setVisible(true)
      return
    }
    if (!visible) return
    setClosing(true)
    const t = setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, 200)
    return () => clearTimeout(t)
  }, [open, visible])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => { setVisible(false); onClose() }, 200)
  }

  if (!visible) return null

  return createPortal(
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', animation: `${closing ? 'neoModalFadeOut' : 'neoModalFade'} 200ms ease forwards` }} />
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          width: `min(${maxWidth}px, calc(100vw - 32px))`,
          background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)',
          borderRadius: 28, boxShadow: 'var(--neo-shadow-lg)',
          maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
          animation: `${closing ? 'neoModalOut' : 'neoModalIn'} 200ms var(--neo-ease-spring, ease) forwards`,
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 20px 0', flexShrink: 0 }}>
            {title ? <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--neo-text-primary)' }}>{title}</div> : <div />}
            <button type="button" onClick={handleClose} aria-label="Close" style={{ width: 32, height: 32, border: 0, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--neo-surface-3)', color: 'var(--neo-text-primary)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
          {footer && <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>{footer}</div>}
        </div>
      </div>
      <style>{`
        @keyframes neoModalFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes neoModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes neoModalIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes neoModalOut { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(10px) } }
      `}</style>
    </>,
    document.body
  )
}
