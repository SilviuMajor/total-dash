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
  { value: 'website', label: 'Website', icon: Globe, color: 'from-blue-500/20 to-cyan-500/20' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'from-green-500/20 to-emerald-500/20' },
  { value: 'telegram', label: 'Telegram', icon: Send, color: 'from-sky-500/20 to-blue-500/20' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'from-pink-500/20 to-purple-500/20' },
  { value: 'messenger', label: 'Messenger', icon: Facebook, color: 'from-blue-600/20 to-indigo-600/20' },
  { value: 'telephony', label: 'Telephony', icon: Phone, color: 'from-violet-500/20 to-purple-500/20' },
  { value: 'sms', label: 'SMS', icon: MessageSquare, color: 'from-orange-500/20 to-amber-500/20' },
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
    <div className="space-y-4">
      <Label className="text-base font-semibold">Communication Domains</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {domainOptions.map((domain) => {
          const Icon = domain.icon;
          const isSelected = selectedDomains.includes(domain.value);
          return (
            <button
              key={domain.value}
              type="button"
              onClick={() => toggleDomain(domain.value)}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 bg-gradient-to-br",
                domain.color,
                isSelected
                  ? "border-primary shadow-lg scale-105 opacity-100"
                  : "border-border/50 hover:border-primary/50 hover:scale-102 opacity-70"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
                isSelected ? "bg-primary/20" : "bg-background/50"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors text-left flex-1",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {domain.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}