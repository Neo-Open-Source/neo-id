import { cn } from "@/lib/cn";

type Variant = "enabled" | "disabled" | "warning" | "danger";

interface StatusBadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant = "disabled", children, className }: StatusBadgeProps) {
  return (
    <span className={cn("badge", `badge--${variant}`, className)}>
      {children}
    </span>
  );
}
