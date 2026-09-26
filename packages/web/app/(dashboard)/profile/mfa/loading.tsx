import { Skeleton } from "@/components/ui/Skeleton";

function MfaRowSkeleton() {
  return (
    <div className="list-row list-row--header">
      <div className="list-row__icon-wrap list-row__icon-wrap--accent">
        <Skeleton className="skeleton--icon" />
      </div>
      <div className="list-row__content">
        <Skeleton className="skeleton--line w-32" />
        <Skeleton className="skeleton--line w-48 mt-2" />
      </div>
      <Skeleton style={{ width: 40, height: 22, borderRadius: 9999 }} />
    </div>
  );
}

export default function MfaLoading() {
  return (
    <div className="page profile-page">
      <div className="page-intro">
        <Skeleton className="skeleton--title w-56" />
        <Skeleton className="skeleton--line w-72 mt-2" />
      </div>
      <div className="profile-group">
        <MfaRowSkeleton />
      </div>
      <div className="profile-group">
        <MfaRowSkeleton />
      </div>
    </div>
  );
}
