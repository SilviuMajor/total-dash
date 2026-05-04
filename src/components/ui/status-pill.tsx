import { cn } from '@/lib/utils';

export type ConversationStatus =
  | 'with_ai'
  | 'waiting'
  | 'in_handover'
  | 'aftercare'
  | 'needs_review'
  | 'resolved';

const STATUS_CLASSES: Record<ConversationStatus, string> = {
  with_ai:      'bg-status-ai-bg text-status-ai-fg',
  waiting:      'bg-status-waiting-bg text-status-waiting-fg',
  in_handover:  'bg-status-handover-bg text-status-handover-fg',
  aftercare:    'bg-status-aftercare-bg text-status-aftercare-fg',
  needs_review: 'bg-status-review-bg text-status-review-fg',
  resolved:     'bg-status-resolved-bg text-status-resolved-fg',
};

export function statusToTone(status: string): keyof typeof STATUS_CLASSES | null {
  return (status in STATUS_CLASSES ? (status as keyof typeof STATUS_CLASSES) : null);
}

interface StatusPillProps {
  status: string;
  label: string;
  className?: string;
  showDot?: boolean;
}

export function StatusPill({ status, label, className, showDot = true }: StatusPillProps) {
  const tone = statusToTone(status);
  const classes = tone
    ? STATUS_CLASSES[tone]
    : 'bg-muted text-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap',
        'tabular-nums',
        classes,
        className,
      )}
    >
      {showDot && tone && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90" />
      )}
      {label}
    </span>
  );
}
