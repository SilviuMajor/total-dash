import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = ['sage', 'rose', 'sky', 'sand', 'lav', 'peach'] as const;
type Tone = typeof TONES[number];

const TONE_CLASSES: Record<Tone, string> = {
  sage:  'bg-sage-bg text-sage-fg',
  rose:  'bg-rose-bg text-rose-fg',
  sky:   'bg-sky-bg text-sky-fg',
  sand:  'bg-sand-bg text-sand-fg',
  lav:   'bg-lav-bg text-lav-fg',
  peach: 'bg-peach-bg text-peach-fg',
};

const STATUS_TO_TONE: Record<string, Tone> = {
  with_ai:      'sage',
  waiting:      'rose',
  in_handover:  'sky',
  aftercare:    'lav',
  needs_review: 'sand',
};

const RESOLVED_CLASSES = 'bg-status-resolved-bg text-status-resolved-fg';

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'w-5 h-5 text-[8px] rounded-[5px]',
  sm: 'w-6 h-6 text-[10px] rounded-md',
  md: 'w-9 h-9 text-[13px] rounded-md',
};

const ICON_SIZE: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
};

function hashTone(seed: string): Tone {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

function getInitials(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? null;
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ConversationAvatarProps {
  seed: string;
  name?: string | null;
  status?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function ConversationAvatar({ seed, name, status, size = 'sm', className }: ConversationAvatarProps) {
  const initials = getInitials(name);

  let toneClasses: string;
  if (status === 'resolved') {
    toneClasses = RESOLVED_CLASSES;
  } else if (status && STATUS_TO_TONE[status]) {
    toneClasses = TONE_CLASSES[STATUS_TO_TONE[status]];
  } else {
    toneClasses = TONE_CLASSES[hashTone(seed)];
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-semibold flex-shrink-0 tracking-tight',
        SIZE_CLASSES[size],
        toneClasses,
        className,
      )}
    >
      {initials ?? <User className={ICON_SIZE[size]} strokeWidth={2.25} />}
    </div>
  );
}
