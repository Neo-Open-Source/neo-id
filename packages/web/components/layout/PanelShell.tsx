"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface PanelShellProps {
  children: ReactNode;
  items: NavItem[];
}

export function PanelShell({ children, items }: PanelShellProps) {
  const pathname = usePathname();

  return (
    <div className="panel-shell flex flex-col w-full">
      <div className="panel-tabs">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("panel-tab", active && "panel-tab--active")}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="panel-shell__content">
        {children}
      </div>
    </div>
  );
}
