import { Avatar } from "@/components/ui/avatar";
import { CheckCircle, Bot } from "lucide-react";

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
    messageBubbleStyle?: string;
    interactiveButtonStyle?: string;
  };
  selectedButton?: string;
  isWidget?: boolean;
  onButtonClick?: (payload: any, text: string) => void;
  buttonsDisabled?: boolean;
}

export function MessageBubble({
  speaker,
  text,
  buttons,
  timestamp,
  appearance,
  selectedButton,
  isWidget = false,
  onButtonClick,
  buttonsDisabled = false
}: MessageBubbleProps) {
  const isUser = speaker === 'user';
  
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
        <Avatar className="h-8 w-8 flex-shrink-0">
          {appearance.chatIconUrl ? (
            <img 
              src={appearance.chatIconUrl} 
              alt="Agent" 
              className="object-cover w-full h-full"
            />
          ) : (
            <div 
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${appearance.primaryColor}20` }}
            >
              <Bot className="w-4 h-4" style={{ color: appearance.primaryColor }} />
            </div>
          )}
        </Avatar>
      )}
      
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`${getBubbleStyle()} px-4 py-2.5 shadow-sm`}
          style={{
            backgroundColor: isUser 
              ? appearance.primaryColor
              : appearance.messageBgColor || '#f3f4f6',
            color: isUser 
              ? appearance.secondaryColor
              : appearance.messageTextColor || '#1f2937',
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
                    disabled={!isWidget || buttonsDisabled}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      (!isWidget || buttonsDisabled) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'
                    } ${isSelected ? 'ring-2 ring-green-500' : ''}`}
                    style={{
                      ...getButtonStyle(isSelected),
                      opacity: (!isWidget && !isSelected) || buttonsDisabled ? 0.6 : 1
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
