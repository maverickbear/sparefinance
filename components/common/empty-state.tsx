import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center w-full py-8">
      <div className="w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {description}
          </p>
          {actionLabel && onAction && (
            <Button onClick={onAction} size="large">
              {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
              {actionLabel}
            </Button>
          )}
      </div>
    </div>
  );
}
