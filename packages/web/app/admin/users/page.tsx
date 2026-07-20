"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  const fetchUsers = async (p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (q) params.set("search", q);

    const res = await fetch(`/api/v1/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    const json = await res.json();
    if (json.ok) {
      setUsers(json.data.users || []);
      setPagination(json.data.pagination || { total: 0, pages: 0 });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers(1, "");
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    fetchUsers(1, val);
  };

  const handleBan = async (userId: string, ban: boolean) => {
    await fetch(`/api/v1/admin/users/${userId}/ban`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({ banned: ban }),
    });
    fetchUsers(page, search);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto min-h-screen">
      <div>
        <h1 className="text-xl font-bold text-content">Users</h1>
        <p className="text-sm text-muted mt-0.5">{pagination.total} user(s)</p>
      </div>

      <Input
        placeholder="Search users..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-dim">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dim hidden md:table-cell">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-dim hidden lg:table-cell">Role</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-dim hidden lg:table-cell">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-dim">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center">
                          <Icon name="user" size={16} className="text-dim" />
                        </div>
                        <span className="text-sm font-medium text-content">{u.displayName || u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-dim hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs font-medium text-muted bg-surface-row px-2 py-0.5 rounded">{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {u.status === "banned" ? (
                        <span className="text-xs font-medium text-danger">Banned</span>
                      ) : (
                        <span className="text-xs font-medium text-success">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/users/${u.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        {u.status === "banned" ? (
                          <Button variant="ghost" size="sm" onClick={() => handleBan(u.id, false)}>
                            Unban
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleBan(u.id, true)} className="text-danger">
                            Ban
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-dim">{page} / {pagination.pages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchUsers(page - 1, search); }}>
              Previous
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= pagination.pages} onClick={() => { setPage(page + 1); fetchUsers(page + 1, search); }}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
