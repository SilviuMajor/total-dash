import { Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatWaitTime, getResponseTimeColor, type ResponseThresholds } from './cardUtils';
import { ConversationAvatar } from './ConversationAvatar';

export interface CardConversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  is_widget_test?: boolean;
  owner_id?: string | null;
  owner_name?: string | null;
  department_id?: string | null;
  first_unanswered_message_at?: string | null;
  last_activity_at?: string | null;
  metadata?: {
    variables?: { user_name?: string; [k: string]: any };
    tags?: string[];
    [k: string]: any;
  } | null;
}

export interface CardDepartment {
  id: string;
  name: string;
  color: string | null;
}

export interface PendingMeta {
  createdAt: string;
  takeoverType: 'handover' | 'transfer';
}

export interface ConversationCardProps {
  conversation: CardConversation;
  departments: CardDepartment[];
  tagsEnabled: boolean;
  currentClientUserId: string | null;
  isSelected?: boolean;
  isChecked?: boolean;
  showCheckbox?: boolean;
  pendingMeta?: PendingMeta | null;
  /** Live mirror of the currently-selected conversation, used for clock-pill freshness on the dashboard. */
  selectedConversationLive?: CardConversation | null;
  responseThresholds?: ResponseThresholds;
  onClick?: () => void;
  onCheckChange?: (checked: boolean) => void;
  /** When provided, renders a small "matched: ..." line at the bottom of the card. */
  matchedField?: string | null;
  matchPrefix?: string | null;
  matchHit?: string | null;
  matchSuffix?: string | null;
}

const STATUSES_WITH_OWNER_INITIALS = new Set([
  'in_handover',
  'aftercare',
  'needs_review',
  'resolved',
]);

const KNOWN_STATUSES = new Set([
  'with_ai',
  'waiting',
  'in_handover',
  'aftercare',
  'needs_review',
  'resolved',
]);

function statusLabel(status: string, isTransfer: boolean): string {
  switch (status) {
    case 'with_ai': return 'With AI';
    case 'waiting': return isTransfer ? 'TRANSFER' : 'Waiting';
    case 'in_handover': return 'In Handover';
    case 'aftercare': return 'Aftercare';
    case 'needs_review': return 'Needs Review';
    case 'resolved': return 'Resolved';
    case 'active': return 'Active (Legacy)';
    case 'completed': return 'Completed';
    case 'owned': return 'Owned (Legacy)';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'name': return 'name';
    case 'email': return 'email';
    case 'phone': return 'phone';
    case 'tag': return 'tag';
    case 'note': return 'note';
    case 'variable': return 'field';
    case 'message': return 'message';
    default: return field;
  }
}

export function ConversationCard({
  conversation: conv,
  departments,
  tagsEnabled,
  currentClientUserId,
  isSelected = false,
  isChecked = false,
  showCheckbox = true,
  pendingMeta = null,
  selectedConversationLive = null,
  responseThresholds,
  onClick,
  onCheckChange,
  matchedField = null,
  matchPrefix = null,
  matchHit = null,
  matchSuffix = null,
}: ConversationCardProps) {
  const rawName = conv.metadata?.variables?.user_name || conv.caller_phone || 'Unknown';
  const hasRealName = !!conv.metadata?.variables?.user_name;
  const displayName = (!hasRealName && rawName.length > 8) ? 'User…' + rawName.slice(-4) : rawName;
  const isMine = !!currentClientUserId && conv.owner_id === currentClientUserId;
  const isPending = !!pendingMeta;
  const isTransfer = conv.status === 'waiting' && pendingMeta?.takeoverType === 'transfer';

  const dept = departments.find(d => d.id === conv.department_id) || null;
  const showOwnerInitials =
    !!conv.owner_name && STATUSES_WITH_OWNER_INITIALS.has(conv.status);

  const waitingTimer =
    conv.status === 'waiting' && pendingMeta
      ? Math.floor((Date.now() - new Date(pendingMeta.createdAt).getTime()) / 1000)
      : null;

  const liveStatus = selectedConversationLive && selectedConversationLive.id === conv.id
    ? selectedConversationLive.status
    : conv.status;
  const liveFirstUnanswered = selectedConversationLive && selectedConversationLive.id === conv.id
    ? selectedConversationLive.first_unanswered_message_at
    : conv.first_unanswered_message_at;
  const showSlaPill = liveStatus === 'in_handover' && !!liveFirstUnanswered;
  const slaSeconds = showSlaPill
    ? Math.floor((Date.now() - new Date(liveFirstUnanswered as string).getTime()) / 1000)
    : 0;
  const slaColor = showSlaPill ? getResponseTimeColor(slaSeconds, responseThresholds).color : null;

  const showSnippet = !!matchedField && matchedField !== 'filter';
  const hasSnippetText = !!(matchHit && matchHit.length > 0);

  return (
    <div
      onClick={onClick}
      data-conversation-id={conv.id}
      className={cn(
        'group px-4 py-3 border-b border-border cursor-pointer transition-colors',
        (isPending || conv.status === 'waiting') && 'bg-rose-bg/60',
        !isPending && conv.status !== 'waiting' && isMine && conv.status === 'in_handover' && 'bg-sky-bg/60',
        !isPending && conv.status !== 'waiting' && isMine && conv.status === 'aftercare' && 'bg-lav-bg/60',
        !isPending && conv.status !== 'waiting' && isMine && conv.status === 'needs_review' && 'bg-sand-bg/60',
        !isPending && conv.status !== 'waiting' && isMine && conv.status === 'resolved' && 'bg-surface-2',
        isSelected && 'bg-primary/5',
        !isSelected && !isPending && !isMine && 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {showCheckbox && (
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => onCheckChange?.(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'shrink-0 transition-opacity',
                isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            />
          )}
          <ConversationAvatar
            seed={conv.id}
            name={hasRealName ? rawName : null}
            size="sm"
          />
          <span className="text-[13px] font-medium truncate" title={rawName}>{displayName}</span>
          {isMine && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-sky-bg text-sky-fg shrink-0">You</span>
          )}
          {conv.is_widget_test && (
            <Badge variant="outline" className="text-[10px] shrink-0 px-1 py-0">🧪</Badge>
          )}
          {conv.status === 'needs_review' && (
            <AlertTriangle className="w-3 h-3 text-sand-fg shrink-0" />
          )}
        </div>
        {departments.length > 1 && dept && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium border shrink-0 ml-2"
            style={{
              backgroundColor: `${dept.color || '#6B7280'}15`,
              borderColor: `${dept.color || '#6B7280'}40`,
              color: dept.color || '#6B7280',
            }}
          >
            {dept.name}
          </span>
        )}
      </div>

      <p className={cn('text-xs text-muted-foreground truncate mb-1.5', 'pl-[30px]')}>
        {format(new Date(conv.last_activity_at || conv.started_at), 'h:mm a · d/M')}
      </p>

      <div className={cn('flex items-center justify-between', 'pl-[30px]')}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
              conv.status === 'with_ai' && 'bg-status-ai-bg text-status-ai-fg',
              conv.status === 'waiting' && 'bg-status-waiting-bg text-status-waiting-fg',
              conv.status === 'in_handover' && 'bg-status-handover-bg text-status-handover-fg',
              conv.status === 'aftercare' && 'bg-status-aftercare-bg text-status-aftercare-fg',
              conv.status === 'needs_review' && 'bg-status-review-bg text-status-review-fg',
              conv.status === 'resolved' && 'bg-status-resolved-bg text-status-resolved-fg',
              !KNOWN_STATUSES.has(conv.status) && 'bg-muted text-muted-foreground',
            )}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {statusLabel(conv.status, isTransfer)}
            {showOwnerInitials && (
              `: ${conv.owner_name!.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}`
            )}
            {waitingTimer != null && ` · ${formatWaitTime(waitingTimer)}`}
          </span>
          {tagsEnabled && conv.metadata?.tags?.map((tag: string) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted border border-border/50 text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        {showSlaPill && slaColor && (
          <span
            className="shrink-0 ml-2"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 10,
              background: `${slaColor}14`,
              color: slaColor,
              border: `1px solid ${slaColor}35`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock className="inline h-2.5 w-2.5 mr-0.5" style={{ verticalAlign: 'middle' }} />{formatWaitTime(slaSeconds)}
          </span>
        )}
      </div>

      {showSnippet && (
        <p className={cn('text-[11px] text-muted-foreground truncate mt-1.5', 'pl-[30px]')}>
          <span className="font-medium">matched: {fieldLabel(matchedField!)}</span>
          {hasSnippetText && (
            <>
              {' · '}
              <span className="text-muted-foreground/80">
                {matchPrefix && matchPrefix.length > 0 ? '…' : ''}{matchPrefix}
                <mark className="bg-sand-bg-2/60 text-foreground rounded-sm px-0.5">{matchHit}</mark>
                {matchSuffix}{matchSuffix && matchSuffix.length > 0 ? '…' : ''}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
