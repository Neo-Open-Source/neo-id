"use client";

import { type ReactNode } from "react";
import { SecondaryNav } from "./SecondaryNav";

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
  return (
    <div className="panel-shell flex min-h-svh w-full max-md:flex-col">
      <SecondaryNav items={items} />
      <div className="panel-shell__content flex-1 min-w-0 flex justify-center px-8 pb-12 pt-8 max-md:px-4 max-md:pb-10 max-md:pt-5">
        {children}
      </div>
    </div>
  );
}
