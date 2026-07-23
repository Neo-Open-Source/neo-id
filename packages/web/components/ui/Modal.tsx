"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerLayout?: "inline" | "stacked";
  size?: "sm" | "md";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  footerLayout = "inline",
  size = "md",
}: ModalProps) {
  const [closing, setClosing] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onCloseRef.current();
    }, 200);
  }, []);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    closeBtnRef.current?.focus();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEsc);

    return () => {
      body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, handleClose]);

  if (!open && !closing) return null;

  return (
    <div className={`modal-overlay${closing ? " modal--closing" : ""}`}>
      <div className="modal-backdrop" onClick={handleClose} aria-hidden />
      <div
        className={`modal-content modal-content--${size}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header__text">
            <h3 className="modal-title">{title}</h3>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button ref={closeBtnRef} className="modal-close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && (
          <div className={`modal-footer${footerLayout === "stacked" ? " modal-footer--stacked" : ""}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
