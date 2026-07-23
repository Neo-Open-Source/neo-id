"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { toast } from "sonner";
import { api, apiUpload, ApiError } from "@/lib/api";

export default function ServiceDetailPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.service);
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    description: "",
    website: "",
    redirectUris: "",
  });
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    api<any>(`/services/${params.id}`)
      .then((data) => {
        setService(data);
        setForm({
          displayName: data.displayName || "",
          description: data.description || "",
          website: data.website || "",
          redirectUris: (data.redirectUris || []).join("\n"),
        });
      })
      .catch(() => router.push("/developer/services"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api<any>(`/services/${params.id}`, {
        method: "PUT",
        body: {
          displayName: form.displayName,
          description: form.description,
          website: form.website,
          redirectUris: form.redirectUris.split("\n").filter((u) => u.trim()),
        },
      });
      setService(data);
      setEditing(false);
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const handleRotateSecret = async () => {
    setRotating(true);
    try {
      const data = await api<{ client_secret: string }>(`/services/${params.id}/rotate-secret`, {
        method: "POST",
      });
      setRevealedSecret(data.client_secret);
      setShowRotateModal(false);
      toast.success("New secret generated");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setRotating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api(`/services/${params.id}`, { method: "DELETE" });
      router.push("/developer/services");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const data = await apiUpload<{ url: string }>(`/services/${params.id}/logo`, formData);
      setService({ ...service, logoUrl: data.url });
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="page max-w-5xl mx-auto">
      <Link href="/developer/services" className="page-back">
        <Icon name="arrow-left" size={16} />
        {t.developer.backToServices}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
            className="relative w-16 h-16 rounded-2xl bg-surface-row border border-border flex items-center justify-center flex-shrink-0 group overflow-hidden cursor-pointer hover:border-accent transition-colors"
          >
            {service.logoUrl ? (
              <img src={service.logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <Icon name="terminal" size={28} className="text-accent" />
            )}
            <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingLogo ? (
                <div className="spinner" />
              ) : (
                <Icon name="pencil" size={20} className="text-white" />
              )}
            </div>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-content tracking-tight">{service.displayName || service.name}</h1>
            <p className="text-sm text-muted mt-1">{service.name}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setEditing(!editing)}>
          {editing ? t.common.cancel : t.common.edit}
        </Button>
      </div>

      {/* Settings */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="text-base font-semibold text-content mb-5">{t.developer.settings}</h2>

        {editing ? (
          <div className="flex flex-col gap-5">
            <Input
              label={t.profile.displayName}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="My App"
            />
            <Input
              label={t.developer.description}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this service do?"
            />
            <Input
              label={t.developer.website}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://example.com"
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {t.common.save}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between py-4 border-b border-border/50">
              <span className="text-sm text-muted">{t.profile.displayName}</span>
              <span className="text-sm text-content font-medium">{service.displayName || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-4 border-b border-border/50">
              <span className="text-sm text-muted">{t.developer.description}</span>
              <span className="text-sm text-content max-w-[60%] text-right">{service.description || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-4 border-b border-border/50">
              <span className="text-sm text-muted">{t.developer.website}</span>
              {service.website ? (
                <a href={service.website} target="_blank" rel="noopener" className="text-sm text-accent hover:text-accent-hover transition-colors">
                  {service.website}
                </a>
              ) : (
                <span className="text-sm text-content">—</span>
              )}
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-muted">{t.developer.redirectUris}</span>
              <span className="text-sm text-content">{(service.redirectUris || []).length} URIs</span>
            </div>
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="bg-surface rounded-2xl border border-border p-6 w-[594px] h-[344px] flex flex-col">
        <h2 className="text-base font-semibold text-content mb-5">{t.developer.credentials}</h2>

        <div className="flex flex-col gap-4 flex-1">
          {/* Client ID */}
          <div className="flex items-center gap-4 p-4 bg-surface-hover rounded-xl min-h-[72px]">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted mb-1.5">{t.developer.clientId}</p>
              <p className="text-sm font-mono text-content break-all">{service.clientId}</p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(service.clientId, "Client ID")}
              className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-content hover:border-border-hover transition-all"
            >
              <Icon name="copy" size={15} />
            </button>
          </div>

          {/* Client Secret */}
          <div className="flex items-start gap-4 p-4 bg-surface-hover rounded-xl min-h-[72px]">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted mb-1.5">{t.developer.clientSecret}</p>
              <p className="text-sm font-mono text-content break-all">
                {revealedSecret || "••••••••••••••••••••••••••••••••"}
              </p>
              {revealedSecret && (
                <p className="text-xs text-warning mt-1.5 flex items-center gap-1">
                  <Icon name="warning" size={12} />
                  {t.developer.secretWarning}
                </p>
              )}
            </div>
            {revealedSecret && (
              <button
                type="button"
                onClick={() => copyToClipboard(revealedSecret, "Client secret")}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-content hover:border-border-hover transition-all"
              >
                <Icon name="copy" size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" onClick={() => setShowRotateModal(true)}>
              <Icon name="refresh" size={15} />
              {t.developer.rotateSecret}
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Icon name="trash" size={15} />
              {t.developer.deleteService}
            </Button>
          </div>
        </div>
      </div>

      {/* Rotate Secret Modal */}
      <Modal
        open={showRotateModal}
        onClose={() => setShowRotateModal(false)}
        title={t.developer.rotateSecret}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRotateModal(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" onClick={handleRotateSecret} loading={rotating}>
              {t.developer.rotateSecret}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t.developer.rotateSecretConfirm}</p>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t.developer.deleteService}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              {t.common.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t.developer.deleteServiceConfirm}</p>
      </Modal>
    </div>
  );
}
