import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface EmptyStateProps {
  image?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ image, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
      {image && (
        <div className="w-[200px] h-[200px] mb-6 flex items-center justify-center aspect-square">
          {image}
        </div>
      )}
      <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg">
          {action.label}
        </Button>
      )}
    </div>
  );
}

