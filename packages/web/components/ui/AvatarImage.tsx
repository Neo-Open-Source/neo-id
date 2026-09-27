"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export const DEFAULT_AVATAR = "/avatars/alvan-nee-ZCHj_2lJP00-unsplash.jpg";

interface AvatarImageProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  imageClassName?: string;
  proxy?: boolean;
  fallbackSrc?: string | null;
  loading?: boolean;
}

const iconSizeMap = { sm: 20, md: 28, lg: 36 };

function getInitials(name?: string) {
  if (!name) return null;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isLocalSrc(src: string) {
  return src.startsWith("data:") || src.startsWith("/") || src.startsWith("blob:");
}

export function AvatarImage({
  src,
  name,
  size = "md",
  className,
  imageClassName,
  proxy = false,
  fallbackSrc = DEFAULT_AVATAR,
  loading = false,
}: AvatarImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const resolvedSrc = src ?? fallbackSrc;
  const initials = getInitials(name);
  const remote = Boolean(resolvedSrc && /^https?:\/\//i.test(resolvedSrc));
  const useProxy = proxy && remote && Boolean(src);

  useEffect(() => {
    let objectUrl: string | null = null;
    setFailed(false);
    setDisplaySrc(null);

    if (!resolvedSrc) return;

    if (isLocalSrc(resolvedSrc) || (!useProxy && !remote)) {
      setDisplaySrc(resolvedSrc);
      return;
    }

    if (!useProxy) {
      setDisplaySrc(resolvedSrc);
      return;
    }

    fetch("/api/v1/user/avatar/image", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("avatar unavailable");
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setDisplaySrc(objectUrl);
      })
      .catch(() => setDisplaySrc(DEFAULT_AVATAR));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolvedSrc, useProxy, remote]);

  if (loading || (src && !displaySrc && !failed)) {
    return (
      <div
        className={cn("avatar", `avatar--${size}`, "skeleton", className)}
        aria-hidden="true"
      />
    );
  }

  if (displaySrc && !failed) {
    return (
      <Image
        src={displaySrc}
        alt=""
        width={80}
        height={80}
        className={cn("avatar__image", imageClassName)}
        onError={() => {
          if (fallbackSrc && displaySrc !== fallbackSrc) {
            setDisplaySrc(fallbackSrc);
          } else {
            setFailed(true);
          }
        }}
        unoptimized
      />
    );
  }

  if (initials) {
    return (
      <div className={cn("avatar__initials", `avatar__initials--${size}`, className)}>
        {initials}
      </div>
    );
  }

  return (
    <div className={cn("avatar__initials", className)}>
      <Icon name="circle-user" size={iconSizeMap[size]} className="text-dim" />
    </div>
  );
}
