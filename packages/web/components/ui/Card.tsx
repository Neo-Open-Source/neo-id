import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border/50 rounded-card shadow-card",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
