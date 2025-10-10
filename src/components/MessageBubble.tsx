import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "lucide-react";

interface Button {
  text: string;
  payload: any;
}

interface MessageBubbleProps {
  speaker: 'user' | 'assistant';
  text?: string;
  buttons?: Button[];
  timestamp: string;
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    chatIconUrl?: string;
    messageTextColor?: string;
    messageBgColor?: string;
    fontSize?: number;
  };
  selectedButton?: string;
  isWidget?: boolean;
  onButtonClick?: (payload: any, text: string) => void;
}

export function MessageBubble({
  speaker,
  text,
  buttons,
  timestamp,
  appearance,
  selectedButton,
  isWidget = false,
  onButtonClick
}: MessageBubbleProps) {
  const isUser = speaker === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && appearance.chatIconUrl && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <img 
            src={appearance.chatIconUrl} 
            alt="Agent" 
            className="object-cover"
          />
        </Avatar>
      )}
      
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="rounded-2xl px-4 py-2.5 shadow-sm"
          style={{
            backgroundColor: isUser 
              ? appearance.messageBgColor || '#f3f4f6'
              : appearance.primaryColor,
            color: isUser 
              ? appearance.messageTextColor || '#1f2937'
              : appearance.secondaryColor || '#ffffff',
            fontSize: `${appearance.fontSize || 14}px`
          }}
        >
          {text && (
            <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
          )}
          
          {buttons && buttons.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {buttons.map((button, idx) => {
                const isSelected = selectedButton === button.text;
                
                return (
                  <button
                    key={idx}
                    onClick={() => isWidget && onButtonClick?.(button.payload, button.text)}
                    disabled={!isWidget}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      isWidget ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                    } ${isSelected ? 'ring-2 ring-green-500' : ''}`}
                    style={{
                      backgroundColor: isSelected 
                        ? appearance.primaryColor 
                        : 'transparent',
                      color: isSelected 
                        ? appearance.secondaryColor 
                        : appearance.primaryColor,
                      border: `2px solid ${appearance.primaryColor}`,
                      opacity: !isWidget && !isSelected ? 0.6 : 1
                    }}
                  >
                    <span className="flex items-center gap-2 justify-center">
                      {button.text}
                      {isSelected && <CheckCircle className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <span className="text-xs text-muted-foreground px-1">
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
}
