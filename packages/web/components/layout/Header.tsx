"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguagePicker } from "@/components/features/auth/LanguagePicker";
import { useI18n } from "@/lib/i18n/context";

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

function HeaderLink({ href, label, badge }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn("site-header__nav-link", isActive && "site-header__nav-link--active")}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="site-header__nav-badge">{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

interface HeaderProps {
  user?: { avatar?: string; email?: string; displayName?: string; role?: string } | null;
  openTicketCount?: number;
}

export function Header({ user, openTicketCount }: HeaderProps) {
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const isDev = user?.role === "developer" || isAdmin;

  const navItems: NavItem[] = [
    { href: "/profile", label: t.nav.profile },
    { href: "/sessions", label: t.nav.sessions },
    ...(isDev ? [{ href: "/developer/services", label: t.nav.developer }] : []),
    ...(isAdmin ? [{ href: "/admin/users", label: t.nav.admin, badge: openTicketCount }] : []),
  ];

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/profile" className="site-header__logo-link" aria-label="Neo ID">
          <Image src="/splash-icon.png" alt="Neo ID" width={30} height={30} className="site-header__logo" />
        </Link>

        <nav className="site-header__nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <HeaderLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="site-header__actions">
          <LanguagePicker />
          <ThemeToggle className="w-8 h-8" iconSize={15} showTooltip={false} />
          <Link href="/profile" className="site-header__avatar-btn" aria-label={t.nav.profile}>
            <AvatarImage src={user?.avatar} name={user?.displayName || user?.email} size="sm" proxy />
          </Link>
        </div>
      </div>
    </header>
  );
}
