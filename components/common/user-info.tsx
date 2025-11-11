import { cn } from "@/lib/utils";

interface UserInfoProps {
  name?: string | null;
  email: string;
  className?: string;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

export function UserInfo({ name, email, className }: UserInfoProps) {
  const initials = getInitials(name);
  const displayName = name || email;

  return (
    <div className={cn("p-3 mb-4", className)}>
      {initials} {displayName} {email}
    </div>
  );
}

