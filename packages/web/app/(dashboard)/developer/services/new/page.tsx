"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { toast } from "sonner";
import { api, apiUpload, ApiError } from "@/lib/api";

export default function NewServicePage() {
  const { t } = useI18n();
  usePageTitle(t.developer.newService);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    description: "",
    website: "",
    redirectUris: "",
  });
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    try {
      const data = await api<{ id: string; client_secret: string }>("/services", {
        method: "POST",
        body: {
          name: form.name,
          displayName: form.displayName || undefined,
          description: form.description || undefined,
          website: form.website || undefined,
          redirectUris: form.redirectUris.split("\n").filter((u) => u.trim()),
        },
      });

      if (logoFile) {
        const formData = new FormData();
        formData.append("logo", logoFile);
        await apiUpload(`/services/${data.id}/logo`, formData);
      }

      toast.success(`${t.developer.clientSecret}: ${data.client_secret}`);
      router.push(`/developer/services/${data.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page max-w-5xl mx-auto">
      <BackButton href="/developer/services" label={t.developer.backToServices} />

      <h1 className="text-2xl font-bold text-content">{t.developer.createService}</h1>

      <div className="bg-surface rounded-2xl border border-border p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoSelect}
        />

        <div className="flex flex-col gap-5">
          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-2xl bg-surface-hover border border-dashed border-border flex items-center justify-center shrink-0 group overflow-hidden cursor-pointer hover:border-accent transition-colors"
            >
              {logoPreview ? (
                <Image src={logoPreview} alt="" fill className="object-cover rounded-2xl" unoptimized />
              ) : (
                <Icon name="camera" size={24} className="text-dim group-hover:text-accent transition-colors" />
              )}
            </button>
            <div>
              <p className="text-sm font-medium text-content">{t.developer.settings}</p>
              <p className="text-xs text-dim">Optional logo for your service</p>
            </div>
          </div>

          <Input
            label={t.developer.serviceName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.developer.serviceNamePlaceholder}
            required
          />
          <Input
            label={t.profile.displayName}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder={t.developer.displayNamePlaceholder}
          />
          <Input
            label={t.developer.description}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t.developer.descriptionPlaceholder}
          />
          <Input
            label={t.developer.website}
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder={t.developer.websitePlaceholder}
          />
          <div className="input-wrapper">
            <label className="input-label">{t.developer.redirectUris}</label>
            <textarea
              className="input"
              value={form.redirectUris}
              onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
              placeholder={t.developer.redirectUrisHint}
              rows={3}
            />
            <p className="text-xs text-dim">One URI per line</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleCreate} loading={loading} disabled={!form.name.trim()}>
              {t.developer.createService}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
