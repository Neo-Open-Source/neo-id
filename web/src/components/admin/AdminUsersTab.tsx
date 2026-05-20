import { Avatar, Badge, Button, Input } from '@neo-open-source/ui-web'
import type { AdminUser } from '../../types/app'
import styles from '../../styles/AdminPage.module.css'

interface AdminUsersTabProps {
  users: AdminUser[]
  usersSearch: string
  usersBannedOnly: boolean
  usersLoading: boolean
  usersPage: number
  usersPages: number
  onSearchChange: (value: string) => void
  onSearch: () => void
  onSearchEnter: () => void
  onBannedOnlyChange: (value: boolean) => void
  onChangeRole: (userId: string, role: string) => void
  onBanClick: (userId: string) => void
  onUnban: (userId: string) => void
  onPrevPage: () => void
  onNextPage: () => void
}

export default function AdminUsersTab({
  users,
  usersSearch,
  usersBannedOnly,
  usersLoading,
  usersPage,
  usersPages,
  onSearchChange,
  onSearch,
  onSearchEnter,
  onBannedOnlyChange,
  onChangeRole,
  onBanClick,
  onUnban,
  onPrevPage,
  onNextPage,
}: AdminUsersTabProps) {
  return (
    <div className={styles.section}>
      <div className={styles.searchGrid}>
        <Input
          className={styles.searchInput}
          placeholder="Search by email or name…"
          value={usersSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
        />
        <label className={styles.bannedLabel}>
          <input type="checkbox" checked={usersBannedOnly} onChange={(e) => onBannedOnlyChange(e.target.checked)} />
          Banned
        </label>
        <Button className={styles.searchButton} variant="secondary" size="sm" disabled={usersLoading} onClick={onSearch}>
          Search
        </Button>
      </div>

      <div className={styles.usersList}>
        {users.map((u) => (
          <div key={u.unified_id} className={styles.userRow}>
            <Avatar className={styles.avatarSm} src={u.avatar || ''} fallback={(u.display_name || u.email || '?')[0].toUpperCase()} />
            <div className={styles.userMain}>
              <p className={styles.rowTitle}>{u.display_name || '—'}</p>
              <p className={styles.rowSubtle}>{u.email}</p>
            </div>
            <div className={styles.userActions}>
              <Badge className={`${styles.statusBadge} ${u.is_banned ? styles.statusBadgeBanned : styles.statusBadgeActive}`} tone={u.is_banned ? undefined : 'success'}>
                {u.is_banned ? 'Banned' : 'Active'}
              </Badge>
              <select className={styles.roleSelect} value={u.role || 'User'} onChange={(e) => onChangeRole(u.unified_id, e.target.value)}>
                {['User', 'Developer', 'Moderator', 'Admin'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {!u.is_banned ? (
                <Button className={styles.rowActionButton} variant="danger" size="sm" onClick={() => onBanClick(u.unified_id)}>
                  Ban
                </Button>
              ) : (
                <Button className={styles.rowActionButton} variant="secondary" size="sm" onClick={() => onUnban(u.unified_id)}>
                  Unban
                </Button>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && <p className={styles.emptyText}>No users found</p>}
      </div>

      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>Page {usersPage} / {usersPages}</span>
        <Button variant="secondary" size="sm" disabled={usersLoading || usersPage <= 1} onClick={onPrevPage}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={usersLoading || usersPage >= usersPages} onClick={onNextPage}>
          Next
        </Button>
      </div>
    </div>
  )
}
