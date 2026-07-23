"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "./Button";
import { useI18n } from "@/lib/i18n/context";

interface AvatarCropProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

/** Renders the cropped region of the image onto a canvas and returns a Blob + preview URL */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<{ blob: Blob; url: string }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    // Allow cross-origin images (e.g. stock avatars served from same origin)
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        resolve({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function AvatarCrop({ imageSrc, onConfirm, onCancel }: AvatarCropProps) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const { blob, url } = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob, url);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="avatar-crop">
      <div className="avatar-crop__canvas">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="avatar-crop__zoom">
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="avatar-crop__slider"
        />
      </div>

      <div className="avatar-crop__actions">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={applying}>
          {t.profile.cropBack}
        </Button>
        <Button size="sm" loading={applying} onClick={handleConfirm}>
          {t.profile.cropApply}
        </Button>
      </div>
    </div>
  );
}
