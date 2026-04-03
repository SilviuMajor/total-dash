import { useState, useEffect } from "react";
import { ImpersonationOverlay } from "./ImpersonationOverlay";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, Bot, Eye, FileText, Home, CreditCard, Building2, DollarSign, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { ClientAgentSelector } from "./ClientAgentSelector";
import { UserProfileCard } from "./UserProfileCard";
import { Button } from "./ui/button";


const clientNavigation = [
  { name: "Conversations", href: "/", icon: MessageSquare, permissionKey: "conversations", provider: "voiceflow" },
  { name: "Transcripts", href: "/text-transcripts", icon: FileText, permissionKey: "transcripts", provider: "voiceflow" },
  { name: "Transcripts", href: "/transcripts", icon: MessageSquare, permissionKey: "transcripts", provider: "retell" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, permissionKey: "analytics" },
  { name: "Specifications", href: "/specs", icon: FileText, permissionKey: "specs" },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permissionKey: "knowledge_base" },
  { name: "Guides", href: "/guides", icon: BookOpen, permissionKey: "guides" },
  { name: "Agent Settings", href: "/agent-settings", icon: Bot, permissionKey: "agent_settings" },
  { name: "Company Settings", href: "/settings", icon: Settings, permissionKey: "settings_page" },
];

const agencyNavigation = [
  { name: "Clients", href: "/agency/clients", icon: Users, permissionKey: "clients" },
  { name: "Agents", href: "/agency/agents", icon: Bot, permissionKey: "agents" },
  { name: "Subscription", href: "/agency/subscription", icon: CreditCard, permissionKey: "subscription" },
  { name: "Settings", href: "/agency/settings", icon: Settings, permissionKey: "settings" },
];

const adminNavigation = [
  { name: "Agencies", href: "/admin/agencies", icon: Building2 },
  { name: "Billing", href: "/admin/billing", icon: DollarSign },
  { name: "Plans", href: "/admin/plans", icon: CreditCard },
  { name: "Email Templates", href: "/admin/email-templates", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { profile: mtProfile, userType, signOut: mtSignOut, isPreviewMode: mtIsPreviewMode, previewAgency, isClientPreviewMode, previewClient, previewClientAgencyId } = useMultiTenantAuth();
  const { selectedAgentPermissions, agents, selectedAgentId } = useClientAgentContext();
  const { effectiveTheme } = useTheme();
  const location = useLocation();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  // Determine branding context
  const isClientView = isClientPreviewMode;
  const agencyId = isClientView ? previewClientAgencyId : undefined;
  
  // Use branding hook for dynamic branding
  const branding = useBranding({ isClientView, agencyId, appTheme: effectiveTheme });
  
  // Use multi-tenant auth if available
  const effectiveProfile = mtProfile || profile;
  const effectiveSignOut = mtProfile ? mtSignOut : signOut;

  // Determine which navigation to show based on preview depth
  const { previewDepth } = useMultiTenantAuth();
  let navigation;
  
  // Check preview depth first (highest priority)
  if (previewDepth === 'agency_to_client' || previewDepth === 'client') {
    // Client preview mode → show filtered client navigation
    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    navigation = clientNavigation.filter(item => {
      // settings_page special check — always show in preview mode
      if (item.permissionKey === 'settings_page') return true;
      if (item.permissionKey && selectedAgent) {
        return selectedAgentPermissions?.[item.permissionKey] === true;
      }
      return item.permissionKey === null;
    }).filter(item => {
      if ((item as any).provider && selectedAgent) {
        return selectedAgent.provider === (item as any).provider;
      }
      return true;
    });
  } else if (previewDepth === 'agency') {
    // Agency preview mode → show agency navigation
    navigation = agencyNavigation;
  } else if (userType === 'super_admin') {
    // Regular super admin → show admin navigation
    navigation = adminNavigation;
  } else if (userType === 'agency') {
    // Regular agency → show agency navigation
    navigation = agencyNavigation;
  } else {
    // Client navigation with filtering
    navigation = clientNavigation.filter(item => {
      // settings_page special check
      if (item.permissionKey === 'settings_page') return selectedAgentPermissions?.settings_page === true;
      
      // Items with null permissionKey are always visible
      if (item.permissionKey === null) {
        return true;
      }
      
      // Filter by provider if specified
      if ((item as any).provider && agents.length > 0) {
        const selectedAgent = agents.find(a => a.id === selectedAgentId);
        if (selectedAgent && selectedAgent.provider !== (item as any).provider) {
          return false;
        }
      }
      
      // Filter by permission
      return selectedAgentPermissions?.[item.permissionKey] === true;
    });
  }

  // Preserve preview query params when in client preview mode
  const getNavHref = (basePath: string) => {
    const storedPreviewMode = sessionStorage.getItem('preview_mode');
    const storedPreviewClient = sessionStorage.getItem('preview_client');
    const storedPreviewClientAgency = sessionStorage.getItem('preview_client_agency');

    // Check both context state AND sessionStorage
    const isInClientPreview = 
      previewDepth === 'agency_to_client' || 
      previewDepth === 'client' ||
      (storedPreviewMode === 'client' && storedPreviewClient);

    if (isInClientPreview) {
      const params = new URLSearchParams(window.location.search);
      
      // If URL doesn't have preview params but sessionStorage does, reconstruct them
      if (!params.has('preview') && storedPreviewClient && storedPreviewClientAgency) {
        params.set('preview', 'true');
        params.set('clientId', storedPreviewClient);
        params.set('agencyId', storedPreviewClientAgency);
      }

      const query = params.toString();
      return query ? `${basePath}?${query}` : basePath;
    }
    return basePath;
  };

  return (
    <div className="flex flex-col w-[240px] h-screen border-r border-border bg-card overflow-hidden flex-shrink-0">
      {/* Logo area */}
      <div className="flex justify-center py-8 border-b border-border">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.companyName}
            className="w-[52px] h-[52px] object-contain rounded-lg"
          />
        ) : (
          <div className="w-[52px] h-[52px] bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-primary">
              {branding.companyName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {(mtIsPreviewMode || isClientPreviewMode) && (
        <div className="px-3.5 py-2 bg-blue-600/10 border-b border-blue-600/20">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Eye className="w-4 h-4" />
            <span>Preview Mode</span>
          </div>
        </div>
      )}

      {(effectiveProfile?.role === 'client' || previewDepth === 'client' || previewDepth === 'agency_to_client') && (
      <div className="px-3 py-1.5 border-b border-border">
          <ClientAgentSelector compact />
        </div>
      )}

      {/* Search trigger */}
      <div className="px-3 py-1.5">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-search'))}
          className="flex items-center justify-between w-full px-2.5 py-2 bg-muted/30 border border-border rounded-md hover:bg-muted transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">Search...</span>
          </div>
          <kbd className="bg-background border border-border rounded px-1 py-0.5 text-[10px] text-muted-foreground font-sans">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={getNavHref(item.href)}
            end={item.href === "/" || item.href === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Impersonation trigger — super admin only */}
      {userType === 'super_admin' && (
        <div className="px-2.5 pb-1">
          <button
            onClick={() => setOverlayOpen(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            title="Impersonate"
          >
            <Eye className="w-[18px] h-[18px] flex-shrink-0" />
            Impersonate
          </button>
        </div>
      )}

      {/* User Profile Card */}
      <UserProfileCard onSignOut={effectiveSignOut} />

      {/* Impersonation Overlay */}
      {userType === 'super_admin' && (
        <ImpersonationOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}
