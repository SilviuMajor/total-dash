import { Bot, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ConversationAvatar } from "@/components/conversations/ConversationAvatar";
import { cn } from "@/lib/utils";

// Append `?download=<filename>` so Supabase storage serves the file with
// Content-Disposition: attachment instead of inline. Without this, browsers
// try to render text/csv (and similar) inline and may show "missing plugin".
function withDownloadParam(url: string, fileName: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('download', fileName);
    return u.toString();
  } catch {
    return url;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Button {
  text: string;
  payload: any;
}

interface Attachment {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio' | 'file';
}

interface MessageBubbleProps {
  speaker: 'user' | 'assistant' | 'client_user' | 'system';
  text?: string;
  buttons?: Button[];
  attachments?: Attachment[] | null;
  timestamp: string;
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    chatIconUrl?: string;
    messageTextColor?: string;
    messageBgColor?: string;
    fontSize?: number;
    messageBubbleStyle?: string;
    interactiveButtonStyle?: string;
  };
  selectedButton?: string;
  isWidget?: boolean;
  onButtonClick?: (payload: any, text: string) => void;
  buttonsDisabled?: boolean;
  /** When provided, renders a customer avatar to the right of user-side bubbles. */
  conversationId?: string;
  /** Optional captured customer name for initials inside the avatar. */
  conversationName?: string | null;
  /** Conversation status — used to colour the customer avatar. */
  conversationStatus?: string | null;
}

function renderAttachment(att: Attachment, key: string | number) {
  if (!att?.url) return null;
  // `first:mt-0` so an image-only bubble (no preceding text) sits flush
  // against the parent's thin p-1 padding, giving an even border around it.
  if (att.kind === 'image') {
    return (
      <a key={key} href={att.url} target="_blank" rel="noreferrer" className="block mt-2 first:mt-0">
        <img src={att.url} alt={att.fileName} className="max-w-full max-h-[320px] rounded-lg cursor-pointer object-cover" />
      </a>
    );
  }
  if (att.kind === 'video') {
    return (
      <video key={key} src={att.url} controls preload="metadata" className="max-w-full max-h-[320px] rounded-lg mt-2 first:mt-0 block bg-black" />
    );
  }
  if (att.kind === 'audio') {
    return (
      <audio key={key} src={att.url} controls preload="metadata" className="w-full mt-2 first:mt-0 block" />
    );
  }
  // File / document tile — explicit colors so they don't inherit the parent
  // bubble's primary/secondary text color (which is white inside a user/blue
  // bubble and would render the filename illegibly on the muted background).
  const sizeLabel = formatBytes(att.size);
  return (
    <a
      key={key}
      href={withDownloadParam(att.url, att.fileName)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 p-2 mt-2 first:mt-0 bg-muted hover:bg-muted/80 rounded-lg transition-colors no-underline max-w-[280px]"
    >
      <div className="w-9 h-9 rounded-md bg-background border border-border flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-medium truncate text-foreground">{att.fileName}</span>
        {sizeLabel && <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>}
      </div>
      <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

export function MessageBubble({
  speaker,
  text,
  buttons,
  attachments,
  timestamp,
  appearance,
  selectedButton,
  isWidget = false,
  onButtonClick,
  buttonsDisabled = false,
  conversationId,
  conversationName,
  conversationStatus,
}: MessageBubbleProps) {
  const isUser = speaker === 'user';
  
  // Parse message for file URLs
  let messageContent = text || '';
  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let isImage = false;
  
  // Detect file patterns: [Image: filename]\nurl or [File: filename]\nurl
  const fileMatch = messageContent.match(/\[(Image|File): ([^\]]+)\]\n(https?:\/\/[^\s]+)/);
  if (fileMatch) {
    fileName = fileMatch[2];
    fileUrl = fileMatch[3];
    isImage = fileMatch[1] === 'Image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
    messageContent = messageContent.replace(/\[(Image|File): [^\]]+\]\n[^\s]+/, '').trim();
  }

  // File-only message: collapse the surrounding primary/secondary-color
  // bubble entirely and let the file tile (which already has its own
  // bg-muted chip styling) be the visual. The previous nested
  // "blue bubble around grey chip" looked like a double border.
  const hasButtons = !!buttons && buttons.length > 0;
  const onlyFileAttachments =
    !messageContent &&
    !hasButtons &&
    (
      (!!attachments && attachments.length > 0 && attachments.every((a) => a.kind === 'file')) ||
      (!!fileUrl && !isImage)
    );
  // In the dashboard (non-widget) view, button-only messages render their
  // buttons directly without a wrapping chat bubble.
  const stripBubbleForButtons =
    !isWidget &&
    hasButtons &&
    !messageContent &&
    !(attachments && attachments.length > 0) &&
    !fileUrl;
  
  const getBubbleStyle = () => {
    const style = appearance.messageBubbleStyle || 'rounded';
    switch (style) {
      case 'square': return 'rounded-none';
      case 'pill': return 'rounded-full';
      default: return 'rounded-2xl';
    }
  };

  const getButtonStyle = (isSelected: boolean) => {
    const buttonStyle = appearance.interactiveButtonStyle || 'solid';
    
    if (isSelected) {
      return {
        backgroundColor: appearance.primaryColor,
        color: appearance.secondaryColor,
        border: `2px solid ${appearance.primaryColor}`
      };
    }
    
    switch (buttonStyle) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          color: appearance.primaryColor,
          border: `2px solid ${appearance.primaryColor}`
        };
      case 'soft':
        return {
          backgroundColor: `${appearance.primaryColor}20`,
          color: appearance.primaryColor,
          border: `1px solid ${appearance.primaryColor}50`
        };
      default: // solid
        return {
          backgroundColor: appearance.primaryColor,
          color: appearance.secondaryColor,
          border: 'none'
        };
    }
  };
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="h-8 w-8 flex-shrink-0 rounded-md overflow-hidden">
          {appearance.chatIconUrl ? (
            <img
              src={appearance.chatIconUrl}
              alt="Agent"
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-sage-bg flex items-center justify-center">
              <Bot className="w-4 h-4 text-sage-fg" />
            </div>
          )}
        </div>
      )}
      {isUser && conversationId && (
        <ConversationAvatar
          seed={conversationId}
          name={conversationName ?? null}
          status={conversationStatus ?? null}
          size="sm"
          className="h-8 w-8 text-[11px]"
        />
      )}
      
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`${onlyFileAttachments || stripBubbleForButtons ? '' : `${getBubbleStyle()} shadow-sm ${messageContent || (buttons?.length) ? 'px-4 py-2.5' : 'p-1'}`}`}
          style={onlyFileAttachments || stripBubbleForButtons ? undefined : {
            backgroundColor: isUser
              ? appearance.primaryColor
              : appearance.messageBgColor || '#f3f4f6',
            color: isUser
              ? appearance.secondaryColor
              : appearance.messageTextColor || '#1f2937',
            fontSize: `${appearance.fontSize || 14}px`
          }}
        >
          {messageContent && (
            <p className="leading-relaxed whitespace-pre-wrap">{messageContent}</p>
          )}

          {attachments && attachments.length > 0 && attachments.map((att, idx) => renderAttachment(att, idx))}

          {fileUrl && (
            isImage ? (
              <img
                src={fileUrl}
                alt={fileName || 'Image'}
                className="max-w-full rounded-lg mt-2 first:mt-0 cursor-pointer"
                onClick={() => window.open(fileUrl, '_blank')}
              />
            ) : (
              <a
                href={withDownloadParam(fileUrl, fileName || 'file')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2 mt-2 first:mt-0 bg-muted hover:bg-muted/80 rounded-lg transition-colors no-underline max-w-[280px]"
              >
                <div className="w-9 h-9 rounded-md bg-background border border-border flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium truncate text-foreground">{fileName}</span>
                </div>
                <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            )
          )}
          
          {buttons && buttons.length > 0 && (
            <div className={cn("flex flex-col gap-2", !stripBubbleForButtons && "mt-2")}>
              {buttons.map((button, idx) => {
                const isSelected = selectedButton === button.text;
                const inDashboard = !isWidget;
                return (
                  <button
                    key={idx}
                    onClick={() => isWidget && onButtonClick?.(button.payload, button.text)}
                    disabled={!isWidget || buttonsDisabled}
                    className={cn(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      (!isWidget || buttonsDisabled) ? 'cursor-not-allowed' : 'hover:shadow-md cursor-pointer',
                      inDashboard && (
                        isSelected
                          ? 'bg-theme-fg text-theme-bg'
                          : 'bg-theme-bg text-theme-fg opacity-70'
                      ),
                    )}
                    style={inDashboard ? undefined : {
                      ...getButtonStyle(isSelected),
                      opacity: buttonsDisabled ? 0.6 : 1,
                    }}
                  >
                    <span className="flex items-center gap-2 justify-center">
                      {button.text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
          {format(new Date(timestamp), 'h:mm a · d/M')}
        </span>
      </div>
    </div>
  );
}
