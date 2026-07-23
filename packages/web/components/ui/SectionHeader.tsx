import { Icon } from "./Icon";

interface SectionHeaderProps {
  icon: string;
  title: string;
  description?: string;
}

export function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <Icon name={icon} size={20} className="section-header__icon" />
      <div>
        <h2 className="section-header__title">{title}</h2>
        {description && <p className="section-header__desc">{description}</p>}
      </div>
    </div>
  );
}
