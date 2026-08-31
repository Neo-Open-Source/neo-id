"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { DEFAULT_AVATAR } from "./AvatarImage";
import { Icon } from "./Icon";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

function initialsFrom(name?: string | null) {
  if (!name) return null;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Avatar for any user (admin lists etc). Falls back to default stock photo. */
export function UserAvatar({ src, name, size = 32, className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = initialsFrom(name);
  const resolved =
    src && !failed && !/^https?:\/\/lh3\.googleusercontent\.com/i.test(src)
      ? src
      : DEFAULT_AVATAR;

  if (resolved) {
    return (
      <Image
        src={resolved}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("user-avatar", className)}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        unoptimized
      />
    );
  }

  return (
    <div
      className={cn("user-avatar user-avatar--fallback", className)}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || <Icon name="user" size={Math.round(size * 0.45)} />}
    </div>
  );
}
