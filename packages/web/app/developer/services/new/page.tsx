"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

export default function NewServicePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    description: "",
    website: "",
    redirectUris: "",
  });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    const res = await fetch("/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({
        name: form.name,
        displayName: form.displayName || undefined,
        description: form.description || undefined,
        website: form.website || undefined,
        redirectUris: form.redirectUris.split("\n").filter((u) => u.trim()),
      }),
    });

    const json = await res.json();
    if (json.ok) {
      alert(`Client Secret: ${json.data.client_secret}\n\nCopy this now. It won't be shown again.`);
      router.push(`/developer/services/${json.data.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      <Link href="/developer/services" className="flex items-center gap-1.5 text-sm text-dim hover:text-content transition-colors">
        <Icon name="arrow-left" size={16} />
        Back to Services
      </Link>

      <h1 className="text-xl font-bold text-content">Create Service</h1>

      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <Input
            label="Service Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="my-service"
            required
          />
          <Input
            label="Display Name"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="My Service"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this service do?"
          />
          <Input
            label="Website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://example.com"
          />
          <div>
            <label className="text-sm text-content">Redirect URIs (one per line)</label>
            <textarea
              value={form.redirectUris}
              onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-surface border border-border text-content rounded-input outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 mt-1.5"
              rows={3}
              placeholder="https://example.com/callback"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} loading={loading} disabled={!form.name.trim()}>
              Create Service
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
