"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import type { ReactNode } from "react";

interface SettingsRowProps {
  icon?: string;
  leading?: ReactNode;
  label: string;
  value?: ReactNode;
  badge?: ReactNode;
  chevron?: boolean;
  external?: boolean;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function SettingsRow({
  icon,
  leading,
  label,
  value,
  badge,
  chevron = true,
  external = false,
  danger = false,
  href,
  onClick,
  className,
}: SettingsRowProps) {
  const interactive = Boolean(href || onClick);
  const showChevron = chevron && interactive;

  const content = (
    <>
      {leading ? (
        <span className="settings-row__leading">{leading}</span>
      ) : (
        <Icon name={icon || "circle"} size={18} className="settings-row__icon" />
      )}
      <span className="settings-row__label">{label}</span>
      {badge && <span className="settings-row__badge">{badge}</span>}
      {value != null && value !== "" && (
        <span className="settings-row__value">{value}</span>
      )}
      {showChevron && (
        <Icon
          name={external ? "arrow-up-right-from-square" : "angle-small-right"}
          size={14}
          className="settings-row__chevron"
        />
      )}
    </>
  );

  const classes = cn(
    "settings-row",
    !interactive && "settings-row--static",
    danger && "settings-row--danger",
    className,
  );

  if (href && external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {content}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  if (!onClick) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
