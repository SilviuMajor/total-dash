import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Globe, MessageCircle, Send, Instagram, Facebook, Phone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface DomainsSectionProps {
  selectedDomains: string[];
  onDomainsChange: (domains: string[]) => void;
}

const domainOptions = [
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'messenger', label: 'Messenger', icon: Facebook },
  { value: 'telephony', label: 'Telephony', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
];

export function DomainsSection({ selectedDomains, onDomainsChange }: DomainsSectionProps) {
  const toggleDomain = (domain: string) => {
    if (selectedDomains.includes(domain)) {
      onDomainsChange(selectedDomains.filter(d => d !== domain));
    } else {
      onDomainsChange([...selectedDomains, domain]);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Domains</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {domainOptions.map((domain) => {
          const Icon = domain.icon;
          const isSelected = selectedDomains.includes(domain.value);
          
          return (
            <button
              key={domain.value}
              type="button"
              onClick={() => toggleDomain(domain.value)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground/50 text-muted-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{domain.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}