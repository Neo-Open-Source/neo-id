import { cn } from "@/lib/cn";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <i
      className={cn(`fi fi-rr-${name}`, className)}
      style={{ fontSize: size, lineHeight: 1 }}
    />
  );
}
