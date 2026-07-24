"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { AvatarImage, DEFAULT_AVATAR } from "./AvatarImage";
import { AvatarCrop } from "./AvatarCrop";
import { useI18n } from "@/lib/i18n/context";
import { api, apiUpload, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

export const STOCK_AVATARS = [
  "/avatars/alvan-nee-ZCHj_2lJP00-unsplash.jpg",
  "/avatars/danila-balashkin-MslerTjRXec-unsplash.jpg",
  "/avatars/gabriel-silverio-K_b41GaWC5Y-unsplash.jpg",
  "/avatars/jei-lee-yRXuXvy4sQ4-unsplash.jpg",
  "/avatars/polina-abramova-i1qKR27PqDc-unsplash.jpg",
  "/avatars/ray-hennessy-xUUZcpQlqpM-unsplash.jpg",
  "/avatars/taylor-8Vt2haq8NSQ-unsplash.jpg",
  "/avatars/zoltan-tasi-yanhwFwyoaU-unsplash.jpg",
];

interface AvatarUploadProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  onUpload?: (file: File) => Promise<void>;
  onSaved?: (avatar: string) => void;
  menuStyle?: boolean;
}

export function AvatarUpload({
  src,
  name,
  size = "lg",
  onUpload,
  onSaved,
  menuStyle = false,
}: AvatarUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "crop">("pick");
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState("");
  const [cropSrc, setCropSrc] = useState("");        // raw file URL fed into cropper
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSrc = src || DEFAULT_AVATAR;
  const displayPreview = preview || selected || currentSrc;

  const reset = () => {
    setSelected("");
    setPreview("");
    setCropSrc("");
    setUploadFile(null);
    setError(null);
    setStep("pick");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so the same file can be re-selected after going back
    if (inputRef.current) inputRef.current.value = "";
    const rawUrl = URL.createObjectURL(file);
    setCropSrc(rawUrl);
    setStep("crop");
  };

  const handleCropConfirm = (croppedBlob: Blob, previewUrl: string) => {
    const croppedFile = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    setUploadFile(croppedFile);
    setPreview(previewUrl);
    setSelected("");
    setStep("pick");
    // Release the raw object URL — cropped preview URL is now the active one
    URL.revokeObjectURL(cropSrc);
    setCropSrc("");
  };

  const handleCropCancel = () => {
    URL.revokeObjectURL(cropSrc);
    setCropSrc("");
    setStep("pick");
  };

  const handleSave = async () => {
    if (!uploadFile && !selected) {
      setModalOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (uploadFile) {
        if (onUpload) {
          await onUpload(uploadFile);
        } else {
          const formData = new FormData();
          formData.append("avatar", uploadFile);
          const data = await apiUpload<{ avatar: string }>("/user/avatar", formData);
          onSaved?.(data.avatar);
        }
      } else {
        const data = await api<{ avatar: string }>("/user/avatar/stock", {
          method: "PUT",
          body: { avatar_url: selected },
        });
        onSaved?.(data.avatar);
      }
      reset();
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.uploadFailed);
    } finally {
      setSaving(false);
    }
  };

  const avatarInner = <AvatarImage src={currentSrc} name={name} size={size} />;

  if (!menuStyle) {
    return (
      <div className="avatar-wrap">
        <div className={cn("avatar", `avatar--${size}`)}>{avatarInner}</div>
      </div>
    );
  }

  return (
    <div className="avatar-wrap">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn("avatar", `avatar--${size}`, "avatar--button")}
        aria-label={t.profile.changePhoto}
      >
        {avatarInner}
        <span className="avatar__edit">
          <Icon name="camera" size={size === "lg" ? 18 : 14} className="text-white" />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <Modal
        open={modalOpen}
        onClose={() => {
          if (saving) return;
          reset();
          setModalOpen(false);
        }}
        title={step === "crop" ? t.profile.cropPhoto : t.profile.changePhoto}
        footer={
          step === "crop" ? undefined : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  setModalOpen(false);
                }}
                disabled={saving}
              >
                {t.common.cancel}
              </Button>
              <Button
                size="sm"
                loading={saving}
                disabled={!uploadFile && !selected}
                onClick={handleSave}
              >
                {t.common.save}
              </Button>
            </>
          )
        }
      >
        {step === "crop" && cropSrc ? (
          <AvatarCrop
            imageSrc={cropSrc}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        ) : (
          <div className="avatar-picker">
            {error && <div className="alert alert--error">{error}</div>}

            <button
              type="button"
              className="avatar-picker__preview"
              onClick={() => inputRef.current?.click()}
              aria-label={t.profile.uploadPhoto}
            >
              <div className="avatar avatar--md">
                <Image src={displayPreview} alt="" width={96} height={96} className="avatar__image" unoptimized />
              </div>
            </button>
            <p className="avatar-picker__hint">{t.profile.uploadPhotoHint}</p>

            <p className="avatar-picker__label">{t.profile.orChooseAvatar}</p>
            <div className="avatar-picker__grid">
              {STOCK_AVATARS.map((url) => (
                <button
                  key={url}
                  type="button"
                  className={cn(
                    "avatar-picker__stock",
                    selected === url && "avatar-picker__stock--active",
                  )}
                  onClick={() => {
                    setSelected(url);
                    setPreview(url);
                    setUploadFile(null);
                  }}
                >
                  <Image src={url} alt="" width={48} height={48} unoptimized />
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
