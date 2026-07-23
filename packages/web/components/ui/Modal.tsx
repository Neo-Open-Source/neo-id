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

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.45;

function isMobileSheetViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  // mounted: false on first frame → true on second frame, triggers entrance transition
  const [mounted, setMounted] = useState(false);
  // isDragging ref exposed to render — used to suppress React style during drag
  const isDragging = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state — all in refs, no React state for 60fps drag
  const dragY = useRef(0);
  const dragging = useRef(false);
  const activePointer = useRef(false);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const dragLastY = useRef(0);
  const dragLastTs = useRef(0);
  const dragVelocity = useRef(0);

  onCloseRef.current = onClose;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  /** Directly update DOM during drag — no React re-render */
  const applyDragTransform = (dy: number) => {
    const el = contentRef.current;
    const bg = backdropRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    }
    if (bg) bg.style.opacity = String(Math.max(0.2, 1 - dy / 320));
  };

  /** Reset DOM styles after drag ends */
  const resetDragStyles = () => {
    const el = contentRef.current;
    const bg = backdropRef.current;
    if (el) {
      el.style.transform = "";
      el.style.transition = "";
      el.classList.remove("modal-content--dragging");
    }
    if (bg) {
      bg.style.opacity = "";
      bg.style.transition = "";
    }
    isDragging.current = false;
  };

  const requestClose = useCallback((fromDrag = false) => {
    if (closingRef.current) return;
    closingRef.current = true;
    activePointer.current = false;
    dragging.current = false;

    const targetY = fromDrag
      ? typeof window !== "undefined" ? window.innerHeight : 640
      : 0;

    const el = contentRef.current;
    const bg = backdropRef.current;
    if (el) {
      el.classList.remove("modal-content--dragging");
      el.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = `translateY(${targetY}px)`;
    }
    if (bg) {
      bg.style.transition = "opacity 200ms ease-out";
      bg.style.opacity = "0";
    }

    setClosing(true);
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      closingRef.current = false;
      setClosing(false);
      setMounted(false);
      resetDragStyles();
      setVisible(false);
      onCloseRef.current();
      closeTimer.current = null;
    }, 220);
  }, []);

  useEffect(() => {
    if (open) {
      clearCloseTimer();
      closingRef.current = false;
      setVisible(true);
      setClosing(false);
      setMounted(false);
      resetDragStyles();
      dragY.current = 0;
      dragging.current = false;
      // Trigger entrance transition on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMounted(true);
        });
      });
      return;
    }

    setVisible(false);
    setClosing(false);
    setMounted(false);
    resetDragStyles();
    dragY.current = 0;
    dragging.current = false;
    closingRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!visible) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose(false);
    };
    document.addEventListener("keydown", handleEsc);

    return () => {
      body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleEsc);
    };
  }, [visible, requestClose]);

  useEffect(() => () => clearCloseTimer(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isMobileSheetViewport() || closingRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;

    activePointer.current = true;
    dragStartY.current = e.clientY;
    dragCurrentY.current = 0;
    dragLastY.current = e.clientY;
    dragLastTs.current = performance.now();
    dragVelocity.current = 0;
    dragging.current = true;
    isDragging.current = true;

    const el = contentRef.current;
    const bg = backdropRef.current;
    if (el) {
      el.style.transition = "none";
      el.classList.add("modal-content--dragging");
    }
    if (bg) bg.style.transition = "none";

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activePointer.current) return;

    const dy = Math.max(0, e.clientY - dragStartY.current);
    const now = performance.now();
    const dt = now - dragLastTs.current;
    if (dt > 0) {
      dragVelocity.current = (e.clientY - dragLastY.current) / dt;
    }
    dragLastY.current = e.clientY;
    dragLastTs.current = now;
    dragCurrentY.current = dy;
    dragY.current = dy;

    applyDragTransform(dy);
  };

  const endDrag = () => {
    if (!activePointer.current) return;
    activePointer.current = false;
    dragging.current = false;

    const shouldDismiss =
      dragCurrentY.current >= DISMISS_DISTANCE || dragVelocity.current >= DISMISS_VELOCITY;

    if (shouldDismiss) {
      requestClose(true);
      return;
    }

    const el = contentRef.current;
    const bg = backdropRef.current;
    if (el) {
      el.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = "";
      el.classList.remove("modal-content--dragging");
    }
    if (bg) {
      bg.style.transition = "opacity 150ms ease-out";
      bg.style.opacity = "";
    }
    dragY.current = 0;
    isDragging.current = false;
  };

  if (!visible) return null;

  return (
    <div
      className={[
        "modal-overlay",
        closing ? "modal--closing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={backdropRef}
        className={[
          "modal-backdrop",
          mounted && !closing ? "modal-backdrop--visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => requestClose(false)}
        aria-hidden
      />
      <div
        ref={contentRef}
        className={[
          "modal-content",
          `modal-content--${size}`,
          mounted && !closing ? "modal-content--visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="modal-handle__bar" aria-hidden />
          <span className="sr-only">Drag down to close</span>
        </div>

        <div
          className="modal-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="modal-header__text">
            <h3 className="modal-title">{title}</h3>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="modal-close"
            onClick={() => requestClose(false)}
            aria-label="Close"
          >
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
