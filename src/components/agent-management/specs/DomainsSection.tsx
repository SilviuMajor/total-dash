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
  { value: 'website', label: 'Website', icon: Globe, color: 'from-blue-500 to-cyan-500' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'from-green-500 to-emerald-500' },
  { value: 'telegram', label: 'Telegram', icon: Send, color: 'from-sky-500 to-blue-500' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'from-pink-500 to-purple-500' },
  { value: 'messenger', label: 'Messenger', icon: Facebook, color: 'from-blue-600 to-indigo-600' },
  { value: 'telephony', label: 'Telephony', icon: Phone, color: 'from-violet-500 to-purple-500' },
  { value: 'sms', label: 'SMS', icon: MessageSquare, color: 'from-orange-500 to-amber-500' },
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
                "relative p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 overflow-hidden group",
                isSelected
                  ? "border-primary shadow-lg scale-105"
                  : "border-border hover:border-primary/50 hover:scale-102"
              )}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${domain.color} opacity-0 transition-opacity ${
                isSelected ? "opacity-20" : "group-hover:opacity-10"
              }`} />
              <div className={`relative p-3 rounded-lg bg-gradient-to-br ${domain.color} ${
                isSelected ? "shadow-md" : "opacity-70 group-hover:opacity-100"
              } transition-all`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className={cn(
                "relative text-sm font-semibold transition-colors",
                isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
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