"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
}

export function BackButton({ href, onClick, label = "Back", className }: BackButtonProps) {
  const classes = cn("back-btn", className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={label}>
        <Icon name="arrow-left" size={18} />
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} aria-label={label}>
      <Icon name="arrow-left" size={18} />
    </button>
  );
}
