"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
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
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/services/${params.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setService(json.data);
          setForm({
            displayName: json.data.displayName || "",
            description: json.data.description || "",
            website: json.data.website || "",
            redirectUris: (json.data.redirectUris || []).join("\n"),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/v1/services/${params.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({
        displayName: form.displayName,
        description: form.description,
        website: form.website,
        redirectUris: form.redirectUris.split("\n").filter((u) => u.trim()),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setService(json.data);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleRotateSecret = async () => {
    if (!confirm("Are you sure? The old secret will be invalidated.")) return;
    const res = await fetch(`/api/v1/services/${params.id}/rotate-secret`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    const json = await res.json();
    if (json.ok) {
      alert(`New client secret: ${json.data.client_secret}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    const res = await fetch(`/api/v1/services/${params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    if (res.ok) router.push("/developer/services");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      <Link href="/developer/services" className="flex items-center gap-1.5 text-sm text-dim hover:text-content transition-colors">
        <Icon name="arrow-left" size={16} />
        Back to Services
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-row flex items-center justify-center">
            {service.logoUrl ? (
              <img src={service.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Icon name="key" size={20} className="text-accent" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">{service.displayName || service.name}</h1>
            <p className="text-sm text-muted">{service.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          <Icon name="pencil" size={14} />
        </Button>
      </div>

      {/* Credentials */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-content mb-4">Credentials</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-surface-hover rounded-card">
            <div>
              <p className="text-xs text-muted">Client ID</p>
              <p className="text-sm font-mono text-content">{service.clientId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(service.clientId)}>
              <Icon name="copy" size={14} />
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-hover rounded-card">
            <div>
              <p className="text-xs text-muted">Client Secret</p>
              <p className="text-sm font-mono text-content">
                {showSecret ? "Click rotate to get new secret" : "••••••••••••••••"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSecret(!showSecret)}>
              <Icon name={showSecret ? "eye-crossed" : "eye"} size={14} />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleRotateSecret}>
            <Icon name="refresh" size={14} />
            Rotate Secret
          </Button>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-content mb-4">Settings</h2>
        {editing ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Display Name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              label="Website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
            <div>
              <label className="text-sm text-content">Redirect URIs (one per line)</label>
              <textarea
                value={form.redirectUris}
                onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
                className="w-full px-4 py-2.5 text-sm bg-surface border border-border text-content rounded-input outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 mt-1.5"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Display Name</span>
              <span className="text-content">{service.displayName || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Description</span>
              <span className="text-content">{service.description || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Website</span>
              <span className="text-content">{service.website || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Redirect URIs</span>
              <span className="text-content">{(service.redirectUris || []).length}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="p-5 border-danger/20">
        <h2 className="text-sm font-semibold text-danger mb-4">Danger Zone</h2>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Icon name="trash" size={14} />
          Delete Service
        </Button>
      </Card>
    </div>
  );
}
