"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useI18n } from "@/lib/i18n/context";

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

function SidebarLink({ href, icon, label, badge }: NavItem & { badge?: number }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center justify-center",
        "w-12 h-12 rounded-button",
        "text-muted no-underline outline-none transition-all",
        "hover:text-content hover:bg-surface-hover",
        isActive && "text-accent bg-accent/12",
      )}
    >
      {isActive && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-[3px] bg-accent" />
      )}
      <Icon name={icon} size={20} />
      {badge != null && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1 leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
        {label}
      </span>
    </Link>
  );
}

interface SidebarProps {
  user?: { avatar?: string; email?: string; displayName?: string; role?: string } | null;
  onLogout: () => void | Promise<void>;
  openTicketCount?: number;
}

export function Sidebar({ user, onLogout, openTicketCount }: SidebarProps) {
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const isDev = user?.role === "developer" || isAdmin;

  const userItems: NavItem[] = [
    { href: "/sessions", icon: "laptop", label: t.nav.sessions },
    { href: "/connected", icon: "link", label: t.nav.connected },
  ];

  const devItems: NavItem[] = [
    { href: "/developer/services", icon: "terminal", label: t.nav.developer },
  ];

  const adminItems: (NavItem & { badge?: number })[] = [
    { href: "/admin/users", icon: "shield", label: t.nav.admin, badge: openTicketCount },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-20 flex flex-col items-center py-4 gap-2 z-40 bg-app border-r border-border max-md:hidden">
      <Link href="/profile" className="w-12 h-12 flex items-center justify-center mb-4 mt-2">
        <Image src="/splash-icon.png" alt="Neo ID" width={40} height={40} className="w-10 h-10" />
      </Link>

      <Link
        href="/profile"
        className="group relative w-10 h-10 flex items-center justify-center overflow-visible rounded-button text-muted transition-colors hover:bg-surface-hover hover:text-content"
        aria-label={t.nav.profile}
      >
        <AvatarImage src={user?.avatar} name={user?.displayName || user?.email} size="sm" proxy />
        <span className="absolute left-14 top-2 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
          {t.nav.profile}
        </span>
      </Link>

      <div className="flex flex-col items-center gap-1">
        {userItems.map((item) => (
          <SidebarLink key={item.href} {...item} />
        ))}
      </div>

      {isDev && (
        <div className="flex flex-col items-center gap-1 mt-2 pt-2 border-t border-border/50">
          {devItems.map((item) => (
            <SidebarLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-col items-center gap-1 mt-2 pt-2 border-t border-border/50">
          {adminItems.map((item) => (
            <SidebarLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-1">
        <ThemeToggle />
        <button
          onClick={onLogout}
          className="group relative flex items-center justify-center w-12 h-12 rounded-button text-muted cursor-pointer transition-all outline-none hover:text-danger hover:bg-surface-hover"
        >
          <Icon name="sign-out-alt" size={20} />
          <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
            {t.nav.logout}
          </span>
        </button>
      </div>
    </aside>
  );
}
