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
  openTicketCount?: number;
}

export function BottomNav({ user, onLogout, openTicketCount }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const isDev = user?.role === "developer" || isAdmin;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex items-center justify-around py-1.5 px-2 z-40 md:hidden">
      <Link
        href="/profile"
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors",
          pathname === "/profile" ? "text-accent" : "text-muted"
        )}
        aria-label={t.nav.profile}
      >
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          <AvatarImage src={user?.avatar} name={user?.displayName || user?.email} size="sm" proxy />
        </div>
      </Link>
      <Link
        href="/sessions"
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors",
          pathname.startsWith("/sessions") ? "text-accent" : "text-muted"
        )}
        aria-label={t.nav.sessions}
      >
        <Icon name="laptop" size={20} />
      </Link>
      <Link
        href="/connected"
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors",
          pathname.startsWith("/connected") ? "text-accent" : "text-muted"
        )}
        aria-label={t.nav.connected}
      >
        <Icon name="link" size={20} />
      </Link>
      {isDev && (
        <Link
          href="/developer/services"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors",
            pathname.startsWith("/developer") ? "text-accent" : "text-muted"
          )}
          aria-label={t.nav.developer}
        >
          <Icon name="terminal" size={20} />
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin/users"
          className={cn(
            "relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors",
            pathname.startsWith("/admin") ? "text-accent" : "text-muted"
          )}
          aria-label={t.nav.admin}
        >
          <Icon name="shield" size={20} />
          {openTicketCount != null && openTicketCount > 0 && (
            <span className="absolute top-0 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-accent text-white text-[9px] font-bold px-1 leading-none">
              {openTicketCount > 99 ? "99+" : openTicketCount}
            </span>
          )}
        </Link>
      )}
      <div className="flex items-center gap-0.5">
        <ThemeToggle />
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-button transition-colors text-danger"
          aria-label={t.nav.logout}
        >
          <Icon name="sign-out-alt" size={20} />
        </button>
      )}
    </nav>
  );
}
