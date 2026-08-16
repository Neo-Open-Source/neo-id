"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface SecondaryNavItem {
  href: string;
  label: string;
  icon?: string;
}

interface SecondaryNavProps {
  items: SecondaryNavItem[];
}

export function SecondaryNav({ items }: SecondaryNavProps) {
  const pathname = usePathname();

  return (
    <aside className="secondary-nav sticky top-[52px] self-start w-56 shrink-0 min-h-svh p-6 pr-3 border-r border-border bg-app overflow-y-auto">
      <nav className="secondary-nav__list flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium no-underline transition-colors shrink-0",
                "text-muted hover:text-content hover:bg-surface-hover",
                active && "text-content bg-surface shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-border)_70%,transparent)]",
              )}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
