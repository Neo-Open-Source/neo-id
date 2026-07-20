"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function PasskeysPage() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/passkeys", {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setPasskeys(json.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    setActionLoading(true);
    try {
      // Start registration
      const startRes = await fetch("/api/v1/passkeys/register/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
      });
      const startJson = await startRes.json();

      if (!startJson.ok) {
        setActionLoading(false);
        return;
      }

      // Browser native passkey dialog
      const credential = await navigator.credentials.create({
        publicKey: startJson.data,
      });

      // Finish registration
      const finishRes = await fetch("/api/v1/passkeys/register/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
        },
        body: JSON.stringify({
          response: credential,
          expectedChallenge: startJson.data.challenge,
          deviceName: navigator.userAgent.includes("Mobile") ? "Mobile Device" : "Desktop",
        }),
      });

      const finishJson = await finishRes.json();
      if (finishJson.ok) {
        setPasskeys((prev) => [...prev, finishJson.data]);
      }
    } catch (err) {
      console.error("Passkey registration failed:", err);
    }
    setActionLoading(false);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    const res = await fetch(`/api/v1/passkeys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    if (res.ok) {
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      <div>
        <h1 className="text-xl font-bold text-content">Passkeys</h1>
        <p className="text-sm text-muted mt-0.5">Use biometric authentication to sign in</p>
      </div>

      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-dim hover:text-content transition-colors">
        <Icon name="arrow-left" size={16} />
        Back to Profile
      </Link>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted">{passkeys.length} passkey(s) registered</p>
          <Button size="sm" onClick={handleAdd} loading={actionLoading}>
            <Icon name="plus" size={14} />
            Add passkey
          </Button>
        </div>

        {passkeys.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="fingerprint" size={32} className="text-dim mx-auto mb-3" />
            <p className="text-sm text-muted">No passkeys registered yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between p-3 bg-surface-hover rounded-card">
                <div className="flex items-center gap-3">
                  <Icon name="fingerprint" size={20} className="text-dim" />
                  <div>
                    <p className="text-sm font-medium text-content">
                      {pk.deviceName || "Passkey"}
                    </p>
                    <p className="text-xs text-muted">
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(pk.id)}
                  loading={actionLoading}
                  className="text-danger"
                >
                  <Icon name="trash" size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
