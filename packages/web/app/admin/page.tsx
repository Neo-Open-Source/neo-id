"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/stats", {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setStats(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto min-h-screen">
      <div>
        <h1 className="text-xl font-bold text-content">Admin Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">System overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Total Users</p>
          <p className="text-2xl font-bold text-content">{stats?.totalUsers || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Active Users</p>
          <p className="text-2xl font-bold text-success">{stats?.activeUsers || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">MFA Enabled</p>
          <p className="text-2xl font-bold text-accent">{stats?.mfaEnabled || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">OAuth Connected</p>
          <p className="text-2xl font-bold text-accent">{stats?.oauthConnected || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Services</p>
          <p className="text-2xl font-bold text-accent">{stats?.totalServices || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Recent Logins (24h)</p>
          <p className="text-2xl font-bold text-content">{stats?.recentLogins || 0}</p>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-content mb-4">Management</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/users" className="flex items-center gap-3 p-3 bg-surface-hover rounded-card hover:bg-surface-row transition-colors">
            <Icon name="users" size={20} className="text-accent" />
            <span className="text-sm font-medium text-content">Users</span>
          </Link>
          <Link href="/admin/services" className="flex items-center gap-3 p-3 bg-surface-hover rounded-card hover:bg-surface-row transition-colors">
            <Icon name="key" size={20} className="text-accent" />
            <span className="text-sm font-medium text-content">Services</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
