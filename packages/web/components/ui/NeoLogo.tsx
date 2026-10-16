"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

interface NeoLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function NeoLogo({ size = 40, className, priority = false }: NeoLogoProps) {
  const width = Math.round(size * (665 / 236));
  return (
    <span className={cn("neo-logo", className)}>
      <Image
        src="/neoid-logo-compact.png"
        alt="Neo ID"
        width={width}
        height={size}
        priority={priority}
        className="neo-logo-img neo-logo-img--light"
      />
      <Image
        src="/neoid-logo-compact-dark.png"
        alt=""
        aria-hidden="true"
        width={width}
        height={size}
        priority={priority}
        className="neo-logo-img neo-logo-img--dark"
      />
    </span>
  );
}
