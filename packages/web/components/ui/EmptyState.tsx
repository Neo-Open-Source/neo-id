import { Icon } from "./Icon";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="empty-panel">
      <div className="empty-panel__icon">
        <Icon name={icon} size={28} />
      </div>
      <p className="empty-panel__title">{title}</p>
      {description && <p className="empty-panel__desc">{description}</p>}
    </div>
  );
}
