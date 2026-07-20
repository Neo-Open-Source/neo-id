import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, className, padding = true, hover }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border/50 rounded-card shadow-card",
        padding && "p-5",
        hover && "hover:shadow-card-hover transition-shadow cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
