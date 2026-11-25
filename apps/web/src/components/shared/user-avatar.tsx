import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  size?: 'default' | 'sm' | 'lg';
}

function getUserInitials(name?: string | null): string {
  if (!name) return 'UT';
  const initials = name
    .split(' ')
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return initials || name.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  name,
  className,
  fallbackClassName,
  size = 'default',
}: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn('font-bold', fallbackClassName)}>
        {getUserInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
