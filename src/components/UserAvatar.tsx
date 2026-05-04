import { cn } from '@/lib/utils';

export type AvatarColor = 'rose' | 'sky' | 'sand' | 'lav' | 'peach';

export const AVATAR_COLORS: { value: AvatarColor; label: string }[] = [
  { value: 'rose',  label: 'Rose' },
  { value: 'sky',   label: 'Sky' },
  { value: 'sand',  label: 'Sand' },
  { value: 'lav',   label: 'Lavender' },
  { value: 'peach', label: 'Peach' },
];

const TONE_CLASSES: Record<AvatarColor, string> = {
  rose:  'bg-rose-bg text-rose-fg',
  sky:   'bg-sky-bg text-sky-fg',
  sand:  'bg-sand-bg text-sand-fg',
  lav:   'bg-lav-bg text-lav-fg',
  peach: 'bg-peach-bg text-peach-fg',
};

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[11px] rounded-md',
  md: 'h-9 w-9 text-sm rounded-md',
  lg: 'h-11 w-11 text-base rounded-md',
};

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  color?: AvatarColor | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function UserAvatar({ firstName, lastName, color, size = 'md', className }: UserAvatarProps) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const tone = color
    ? TONE_CLASSES[color]
    : 'bg-primary/10 text-primary';
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-semibold flex-shrink-0 tracking-tight',
        SIZE_CLASSES[size],
        tone,
        className,
      )}
    >
      {initials || '?'}
    </div>
  );
}
