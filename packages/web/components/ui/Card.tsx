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
        "card",
        hover && "card--hover",
        padding && "card__section",
        className,
      )}
    >
      {children}
    </div>
  );
}
