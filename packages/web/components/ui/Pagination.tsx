import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  labels?: {
    back?: string;
    next?: string;
  };
}

export function Pagination({ page, pages, loading, onPrev, onNext, labels }: PaginationProps) {
  if (pages <= 1) return null;

  return (
    <div className="admin-pagination">
      <span>
        {page} / {pages}
      </span>
      <div className="admin-pagination__btns">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={onPrev}
        >
          {labels?.back ?? "Back"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages || loading}
          onClick={onNext}
        >
          {labels?.next ?? "Next"}
        </Button>
      </div>
    </div>
  );
}
