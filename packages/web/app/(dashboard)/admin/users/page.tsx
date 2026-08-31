"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";
import { readCache, writeCache } from "@/lib/cache";

interface AdminUser {
  id: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  passkeyCount?: number;
  sessionCount?: number;
  totpEnabled?: boolean;
  emailMfaEnabled?: boolean;
  identities?: Array<{ provider: string }>;
}

interface UsersResponse {
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const ROLES = ["user", "developer", "admin"] as const;

export default function AdminUsersPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.users);
  const cacheKey = "/admin/users?page=1&limit=20";
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [resetPassLoading, setResetPassLoading] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  useEffect(() => {
    const cached = readCache<UsersResponse>(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
  }, [cacheKey]);

  const fetchUsers = useCallback(async (p: number, q: string) => {
    if (!readCache<UsersResponse>(cacheKey) || p !== 1 || q) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (q) params.set("search", q);
      const result = await api<UsersResponse>(`/admin/users?${params}`);
      setData(result);
      if (p === 1 && !q) writeCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, t.common.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      void fetchUsers(1, search);
    }, search ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [search, fetchUsers]);

  const openUser = async (user: AdminUser) => {
    setDetailLoading(true);
    setSelected(user);
    try {
      const detail = await api<AdminUser>(`/admin/users/${user.id}`);
      setSelected(detail);
    } catch {
      // keep list row data
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBan = async (userId: string, banned: boolean) => {
    setActionId(userId);
    try {
      await api(`/admin/users/${userId}/ban`, {
        method: "POST",
        body: { banned },
      });
      await fetchUsers(page, search);
      if (selected?.id === userId) {
        setSelected((prev) => (prev ? { ...prev, status: banned ? "banned" : "active" } : prev));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionId(null);
    }
  };

  const handleRole = async (role: string) => {
    if (!selected || roleSaving || selected.role === role) return;
    setRoleSaving(true);
    try {
      await api(`/admin/users/${selected.id}/role`, {
        method: "POST",
        body: { role },
      });
      setSelected((prev) => (prev ? { ...prev, role } : prev));
      await fetchUsers(page, search);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setRoleSaving(false);
    }
  };

  const notifyTerms = async () => {
    if (notifying) return;
    setNotifying(true);
    setError(null);
    try {
      const result = await api<{ recipients: number; sent: number; failed: number }>(
        "/admin/broadcast",
        {
          method: "POST",
          body: {
            audience: "active",
            subject: t.admin.termsSubject,
            body: t.admin.termsBody,
          },
        },
      );
      toast.success(
        t.admin.broadcastSent
          .replace("{{sent}}", String(result.sent))
          .replace("{{total}}", String(result.recipients)),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.error;
      setError(msg);
      toast.error(msg);
    } finally {
      setNotifying(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selected || resetPassLoading) return;
    setResetPassLoading(true);
    try {
      const data = await api<{ newPassword: string }>(`/admin/users/${selected.id}/reset-password`, { method: "POST" });
      navigator.clipboard.writeText(data.newPassword);
      toast.success(`${t.admin.passwordCopied}: ${data.newPassword}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setResetPassLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selected || deleteUserLoading) return;
    if (!window.confirm(t.admin.deleteUserConfirm)) return;
    setDeleteUserLoading(true);
    try {
      await api(`/admin/users/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      await fetchUsers(page, search);
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const users = data?.users ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 0, total: 0, limit: 20 };
  const selectedName = selected
    ? selected.displayName || selected.username || selected.email
    : "";

  return (
    <div className="panel-page">
      <div className="panel-page__header panel-page__header--row">
        <div>
          <h1>{t.admin.usersTitle}</h1>
          <p>{t.admin.usersCount.replace("{{count}}", String(pagination.total))}</p>
        </div>
        <Button
          variant="secondary"
          loading={notifying}
          onClick={notifyTerms}
        >
          <Icon name="envelope" size={14} />
          {t.admin.notifyTerms}
        </Button>
      </div>

      <div className="admin-toolbar">
        <Input
          placeholder={t.admin.searchUsers}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading && !data ? (
        <ListPageSkeleton rows={6} />
      ) : users.length === 0 ? (
        <div className="empty-panel">
          <p className="empty-panel__title">{t.admin.noUsers}</p>
          <p className="empty-panel__desc">{t.admin.noUsersDesc}</p>
        </div>
      ) : (
        <div className="admin-users">
          {users.map((user) => {
            const name = user.displayName || user.username || user.email;
            return (
              <div key={user.id} className="admin-user-row">
                <UserAvatar src={user.avatar} name={name} size={40} />
                <button
                  type="button"
                  className="admin-user-row__main admin-user-row__main--btn"
                  onClick={() => openUser(user)}
                >
                  <div className="admin-user-row__top">
                    <p className="admin-user-row__name">{name}</p>
                    <span className={`admin-pill admin-pill--${user.role}`}>{user.role}</span>
                    <span
                      className={`admin-pill admin-pill--status-${
                        user.status === "banned" ? "banned" : "active"
                      }`}
                    >
                      {user.status === "banned" ? t.admin.banned : t.admin.active}
                    </span>
                  </div>
                  <p className="admin-user-row__email">{user.email}</p>
                  <p className="admin-user-row__meta">
                    {user.sessionCount != null
                      ? t.admin.sessionsCount.replace("{{count}}", String(user.sessionCount))
                      : null}
                    {user.lastLoginAt
                      ? ` · ${t.admin.lastLogin.replace(
                          "{{date}}",
                          new Date(user.lastLoginAt).toLocaleDateString(),
                        )}`
                      : ""}
                  </p>
                </button>
                <div className="admin-user-row__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title={t.admin.view}
                    aria-label={t.admin.view}
                    onClick={() => openUser(user)}
                  >
                    <Icon name="eye" size={16} />
                  </button>
                  {user.status === "banned" ? (
                    <button
                      type="button"
                      className="icon-btn"
                      title={t.admin.unban}
                      aria-label={t.admin.unban}
                      disabled={actionId === user.id}
                      onClick={() => handleBan(user.id, false)}
                    >
                      <Icon name="unlock" size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title={t.admin.ban}
                      aria-label={t.admin.ban}
                      disabled={actionId === user.id || user.role === "admin"}
                      onClick={() => handleBan(user.id, true)}
                    >
                      <Icon name="ban" size={16} />
                    </button>
                  )}
                  {user.role !== "admin" && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title={t.admin.deleteUser}
                      aria-label={t.admin.deleteUser}
                      disabled={actionId === user.id}
                      onClick={async () => {
                        if (!window.confirm(t.admin.deleteUserConfirm)) return;
                        setActionId(user.id);
                        try {
                          await api(`/admin/users/${user.id}`, { method: "DELETE" });
                          await fetchUsers(page, search);
                          toast.success(t.common.success);
                        } catch (e) {
                          toast.error(e instanceof ApiError ? e.message : t.common.error);
                        } finally {
                          setActionId(null);
                        }
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="admin-pagination">
          <span>
            {pagination.page} / {pagination.pages}
          </span>
          <div className="admin-pagination__btns">
            <Button
              variant="ghost"
              disabled={page <= 1 || loading}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                void fetchUsers(next, search);
              }}
            >
              {t.common.back}
            </Button>
            <Button
              variant="ghost"
              disabled={page >= pagination.pages || loading}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void fetchUsers(next, search);
              }}
            >
              {t.common.next}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selectedName || t.admin.view}
        size="md"
        footer={
          selected && selected.role !== "admin" ? (
            <div className="admin-user-modal__actions">
              <Button
                variant="secondary"
                loading={resetPassLoading}
                onClick={handleResetPassword}
              >
                <Icon name="key" size={16} />
                {t.admin.resetPassword}
              </Button>
              <Button
                variant={selected.status === "banned" ? "secondary" : "danger"}
                loading={actionId === selected.id}
                onClick={() => handleBan(selected.id, selected.status !== "banned")}
              >
                <Icon name={selected.status === "banned" ? "unlock" : "ban"} size={16} />
                {selected.status === "banned" ? t.admin.unban : t.admin.ban}
              </Button>
              <Button
                variant="danger"
                loading={deleteUserLoading}
                onClick={handleDeleteUser}
              >
                <Icon name="trash" size={16} />
                {t.admin.deleteUser}
              </Button>
            </div>
          ) : undefined
        }
        footerLayout="stacked"
      >
        {selected && (
          <div className="admin-user-modal">
            {detailLoading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="loading__spinner" />
                <p className="text-sm text-muted">{t.common.loading}</p>
              </div>
            ) : (
              <>
                <div className="admin-user-modal__identity">
                  <UserAvatar src={selected.avatar} name={selectedName} size={56} />
                  <div>
                    <p className="text-lg font-semibold text-content">{selectedName}</p>
                    <p className="text-sm text-muted">{selected.email}</p>
                  </div>
                </div>
                <div className="admin-user-modal__section">
                  <p className="admin-user-modal__label">{t.admin.role}</p>
                  <div className="admin-role-grid">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={`admin-role-chip${selected.role === role ? " admin-role-chip--active" : ""}`}
                        disabled={roleSaving}
                        onClick={() => handleRole(role)}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="admin-user-modal__meta">
                  <div>
                    <span>{t.admin.status}</span>
                    <strong>
                      {selected.status === "banned" ? t.admin.banned : t.admin.active}
                    </strong>
                  </div>
                  <div>
                    <span>{t.admin.sessionsCount.replace("{{count}}", "").trim() || "Sessions"}</span>
                    <strong>{selected.sessionCount ?? 0}</strong>
                  </div>
                  <div>
                    <span>MFA</span>
                    <strong>
                      {selected.totpEnabled || selected.emailMfaEnabled
                        ? t.common.enabled
                        : t.common.notEnabled}
                    </strong>
                  </div>
                  {selected.lastLoginAt && (
                    <div>
                      <span>{t.admin.lastLogin.replace(" {{date}}", "").replace("{{date}}", "")}</span>
                      <strong>{new Date(selected.lastLoginAt).toLocaleString()}</strong>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
