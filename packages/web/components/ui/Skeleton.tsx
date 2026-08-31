import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function ProfileSkeleton() {
  return (
    <div className="page profile-page">
      <div className="profile-identity">
        <Skeleton className="skeleton--avatar" />
        <Skeleton className="skeleton--title mt-4" />
        <Skeleton className="skeleton--line w-40 mt-2" />
      </div>
      <div className="profile-group">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="settings-row settings-row--static">
            <Skeleton className="skeleton--icon" />
            <Skeleton className="skeleton--line flex-1" />
            <Skeleton className="skeleton--line w-16" />
          </div>
        ))}
      </div>
      <div className="profile-group">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="settings-row settings-row--static">
            <Skeleton className="skeleton--icon" />
            <Skeleton className="skeleton--line flex-1" />
            <Skeleton className="skeleton--line w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="page profile-page">
      <Skeleton className="skeleton--line w-28 mb-4" />
      <Skeleton className="skeleton--title mb-2" />
      <Skeleton className="skeleton--line w-56 mb-6" />
      <div className="profile-group">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="list-row list-row--static">
            <Skeleton className="skeleton--icon rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="skeleton--line w-32" />
              <Skeleton className="skeleton--line w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
