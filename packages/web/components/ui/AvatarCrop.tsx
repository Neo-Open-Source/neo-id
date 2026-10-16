"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useI18n } from "@/lib/i18n/context";

interface AvatarCropProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

interface Pic {
  x: number;
  y: number;
  scale: number;
}

interface Box {
  x: number;
  y: number;
  size: number;
}

interface Size {
  w: number;
  h: number;
}

interface Visible {
  l: number;
  t: number;
  r: number;
  b: number;
}

type Corner = "nw" | "ne" | "sw" | "se";
type Mode = Corner | "move" | "pan";

const MIN_BOX = 64;
const MAX_ZOOM = 4;
const MAX_OUTPUT = 1024;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function fixPic(pic: Pic, area: Size, n: Size): Pic {
  const w = n.w * pic.scale;
  const h = n.h * pic.scale;
  return {
    ...pic,
    x: w <= area.w ? (area.w - w) / 2 : clamp(pic.x, area.w - w, 0),
    y: h <= area.h ? (area.h - h) / 2 : clamp(pic.y, area.h - h, 0),
  };
}

function visibleRect(pic: Pic, area: Size, n: Size): Visible {
  return {
    l: Math.max(pic.x, 0),
    t: Math.max(pic.y, 0),
    r: Math.min(pic.x + n.w * pic.scale, area.w),
    b: Math.min(pic.y + n.h * pic.scale, area.h),
  };
}

function fitBox(box: Box, v: Visible): Box {
  const size = Math.min(box.size, v.r - v.l, v.b - v.t);
  return {
    size,
    x: clamp(box.x, v.l, v.r - size),
    y: clamp(box.y, v.t, v.b - size),
  };
}

function resizeBox(box: Box, corner: Corner, p: { x: number; y: number }, v: Visible): Box {
  const east = corner[1] === "e";
  const south = corner[0] === "s";
  const ax = east ? box.x : box.x + box.size;
  const ay = south ? box.y : box.y + box.size;

  const room = Math.min(east ? v.r - ax : ax - v.l, south ? v.b - ay : ay - v.t);
  const size = clamp(Math.max(Math.abs(p.x - ax), Math.abs(p.y - ay)), Math.min(MIN_BOX, room), room);

  return { size, x: east ? ax : ax - size, y: south ? ay : ay - size };
}

export function AvatarCrop({ imageSrc, onConfirm, onCancel }: AvatarCropProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const picRef = useRef<Pic | null>(null);
  const drag = useRef<{ id: number; mode: Mode; x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const [mounted, setMounted] = useState(false);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [natural, setNatural] = useState<Size>({ w: 0, h: 0 });
  const [pic, setPic] = useState<Pic | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [applying, setApplying] = useState(false);

  const fit = natural.w ? Math.min(area.w / natural.w, area.h / natural.h) : 0;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!fit) return;
    const w = natural.w * fit;
    const h = natural.h * fit;
    const x = (area.w - w) / 2;
    const y = (area.h - h) / 2;
    const size = Math.min(w, h) * 0.5;
    const next = { x, y, scale: fit };
    picRef.current = next;
    setPic(next);
    setBox({ x: x + (w - size) / 2, y: y + (h - size) / 2, size });
  }, [natural, area, fit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const applyPic = (next: Pic) => {
    const fixed = fixPic(next, area, natural);
    picRef.current = fixed;
    setPic(fixed);
    setBox((b) => b && fitBox(b, visibleRect(fixed, area, natural)));
  };

  const zoomBy = (factor: number, ax: number, ay: number) => {
    const p = picRef.current;
    if (!p || !fit) return;
    const scale = clamp(p.scale * factor, fit, fit * MAX_ZOOM);
    const k = scale / p.scale;
    applyPic({ scale, x: ax - (ax - p.x) * k, y: ay - (ay - p.y) * k });
  };

  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const speed = e.ctrlKey ? 0.01 : 0.002;
      zoomRef.current(Math.exp(-dy * speed), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size > 1) {
      drag.current = null;
      return;
    }

    const target = e.target as HTMLElement;
    const mode = (target.dataset.corner ??
      (target.closest(".avatar-crop__box") ? "move" : "pan")) as Mode;
    drag.current = { id: e.pointerId, mode, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    if (!map.has(e.pointerId)) return;

    if (map.size === 2) {
      const before = [...map.values()];
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...map.values()];
      const was = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
      const now = Math.hypot(a.x - b.x, a.y - b.y);
      const r = e.currentTarget.getBoundingClientRect();
      if (was > 0) zoomBy(now / was, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const d = drag.current;
    const p = picRef.current;
    if (!d || d.id !== e.pointerId || !p) return;

    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    const mode = d.mode;
    const v = visibleRect(p, area, natural);

    if (mode === "move") {
      setBox((b) => b && fitBox({ ...b, x: b.x + dx, y: b.y + dy }, v));
    } else if (mode === "pan") {
      applyPic({ ...p, x: p.x + dx, y: p.y + dy });
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      const point = { x: e.clientX - r.left, y: e.clientY - r.top };
      setBox((b) => b && resizeBox(b, mode, point, v));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!pic || !box || !img) return;
    setApplying(true);
    try {
      const size = box.size / pic.scale;
      const sx = clamp((box.x - pic.x) / pic.scale, 0, natural.w - size);
      const sy = clamp((box.y - pic.y) / pic.scale, 0, natural.h - size);
      const out = Math.max(1, Math.min(MAX_OUTPUT, Math.round(size)));

      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      canvas.getContext("2d")?.drawImage(img, sx, sy, size, size, 0, 0, out, out);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Failed to create blob");
      onConfirm(blob, URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  if (!mounted) return null;

  const ready = pic !== null && box !== null;
  const boxStyle = box && { left: box.x, top: box.y, width: box.size, height: box.size };

  return createPortal(
    <div className="avatar-crop">
      <button
        type="button"
        className="avatar-crop__close"
        onClick={onCancel}
        aria-label={t.profile.cropCancel}
      >
        <Icon name="cross-small" size={18} />
      </button>

      <div
        className="avatar-crop__canvas"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          onLoad={(e) =>
            setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          style={{
            position: "absolute",
            left: pic?.x ?? 0,
            top: pic?.y ?? 0,
            width: pic ? natural.w * pic.scale : undefined,
            height: pic ? natural.h * pic.scale : undefined,
            maxWidth: "none",
            maxHeight: "none",
            visibility: pic ? "visible" : "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {boxStyle && (
          <>
            <div className="avatar-crop__circledim" style={boxStyle} />
            <div className="avatar-crop__box" style={boxStyle}>
              <span className="avatar-crop__handle avatar-crop__handle--nw" data-corner="nw" />
              <span className="avatar-crop__handle avatar-crop__handle--ne" data-corner="ne" />
              <span className="avatar-crop__handle avatar-crop__handle--sw" data-corner="sw" />
              <span className="avatar-crop__handle avatar-crop__handle--se" data-corner="se" />
            </div>
          </>
        )}
      </div>

      <div className="avatar-crop__actions">
        <button
          type="button"
          className="avatar-crop__btn avatar-crop__btn--cancel"
          onClick={onCancel}
          disabled={applying}
        >
          <Icon name="cross-small" size={16} />
          {t.profile.cropCancel}
        </button>
        <button
          type="button"
          className="avatar-crop__btn avatar-crop__btn--done"
          onClick={handleConfirm}
          disabled={applying || !ready}
        >
          <Icon name="check" size={16} />
          {t.profile.cropDone}
        </button>
      </div>
    </div>,
    document.body,
  );
}
