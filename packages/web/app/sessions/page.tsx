"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/sessions", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setSessions(json.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/v1/sessions/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
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
        <h1 className="text-xl font-bold text-content">Sessions</h1>
        <p className="text-sm text-muted mt-0.5">Manage your active sessions</p>
      </div>

      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-dim hover:text-content transition-colors">
        <Icon name="arrow-left" size={16} />
        Back to Profile
      </Link>

      {sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon name="clock" size={32} className="text-dim mx-auto mb-3" />
          <p className="text-sm text-muted">No active sessions</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <Card key={session.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon name="monitor" size={20} className="text-dim" />
                  <div>
                    <p className="text-sm font-medium text-content">
                      {session.deviceInfo || "Unknown device"}
                    </p>
                    <p className="text-xs text-muted">
                      {session.ipAddress || "Unknown IP"} ·{" "}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(session.id)}>
                  Revoke
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
