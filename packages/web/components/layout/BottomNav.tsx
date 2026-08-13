"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

interface BottomNavProps {
  user?: { avatar?: string; email?: string; displayName?: string; role?: string } | null;
  onLogout?: () => void | Promise<void>;
}

export function BottomNav({ user, onLogout }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const isDev = user?.role === "developer" || isAdmin;

  const itemClass = (active: boolean) =>
    cn("mobile-nav__item", active && "mobile-nav__item--active");

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-nav__inner">
        <Link
          href="/profile"
          className={itemClass(pathname === "/profile")}
          aria-current={pathname === "/profile" ? "page" : undefined}
          aria-label={t.nav.profile}
        >
          <span className="mobile-nav__avatar">
            <AvatarImage src={user?.avatar} name={user?.displayName || user?.email} size="sm" proxy />
          </span>
        </Link>

        <Link
          href="/sessions"
          className={itemClass(isActive("/sessions"))}
          aria-current={isActive("/sessions") ? "page" : undefined}
          aria-label={t.nav.sessions}
        >
          <Icon name="laptop" size={20} />
        </Link>

        <Link
          href="/connected"
          className={itemClass(isActive("/connected"))}
          aria-current={isActive("/connected") ? "page" : undefined}
          aria-label={t.nav.connected}
        >
          <Icon name="link" size={20} />
        </Link>

        {isDev && (
          <Link
            href="/developer/services"
            className={itemClass(isActive("/developer"))}
            aria-current={isActive("/developer") ? "page" : undefined}
            aria-label={t.nav.developer}
          >
            <Icon name="terminal" size={20} />
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/admin/users"
            className={itemClass(isActive("/admin"))}
            aria-current={isActive("/admin") ? "page" : undefined}
            aria-label={t.nav.admin}
          >
            <Icon name="shield" size={20} />
          </Link>
        )}

        <div className="mobile-nav__item">
          <ThemeToggle className="w-9 h-9" iconSize={18} showTooltip={false} />
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="mobile-nav__item mobile-nav__item--danger"
            aria-label={t.nav.logout}
          >
            <Icon name="sign-out-alt" size={20} />
          </button>
        )}
      </div>
    </nav>
  );
}
