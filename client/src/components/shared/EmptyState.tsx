import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4">
      <div className="w-10 h-10 rounded-full bg-muted grid place-items-center text-muted-foreground mb-3">
        <Icon size={20} strokeWidth={1.5} />
      </div>

      <h3 className="text-xs font-semibold text-foreground">{title}</h3>

      {description && (
        <p className="text-xs text-muted-foreground text-center max-w-sm mt-1 mb-4">
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}
