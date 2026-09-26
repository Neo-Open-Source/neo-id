"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";

interface UserMenuProps {
  user?: { avatar?: string; email?: string; displayName?: string } | null;
  onLogout?: () => void | Promise<void>;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const name = user?.displayName || user?.email || "";

  return (
    <div ref={rootRef} className="user-menu">
      <button
        type="button"
        className="site-header__avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.nav.profile}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AvatarImage src={user?.avatar} name={name} size="sm" proxy />
      </button>

      {open && (
        <div className="user-menu__popover" role="menu">
          <div className="user-menu__identity">
            <span className="user-menu__avatar">
              <AvatarImage src={user?.avatar} name={name} size="sm" proxy />
            </span>
            <div className="user-menu__identity-text">
              {user?.displayName && (
                <p className="user-menu__name">{user.displayName}</p>
              )}
              {user?.email && (
                <p className="user-menu__email">{user.email}</p>
              )}
            </div>
          </div>

          <Link
            href="/profile"
            className="user-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Icon name="circle-user" size={16} />
            <span>{t.nav.profile}</span>
          </Link>

          {onLogout && (
            <button
              type="button"
              className="user-menu__item user-menu__item--danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
            >
              <Icon name="exit" size={16} />
              <span>{t.nav.logout}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
