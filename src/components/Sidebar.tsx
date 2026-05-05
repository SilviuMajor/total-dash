import { useState, useEffect } from "react";
import { ImpersonationOverlay } from "./ImpersonationOverlay";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, User, Bot, Eye, FileText, Home, CreditCard, Building2, DollarSign, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { useImpersonation } from "@/hooks/useImpersonation";
import { ClientAgentSelector } from "./ClientAgentSelector";
import { UserProfileCard } from "./UserProfileCard";


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

export function Sidebar({ className }: { className?: string } = {}) {
  const { profile, signOut } = useAuth();
  const { profile: mtProfile, userType, signOut: mtSignOut, isPreviewMode: mtIsPreviewMode, previewAgency, isClientPreviewMode, previewClient, previewClientAgencyId } = useMultiTenantAuth();
  const { selectedAgentPermissions, agents, selectedAgentId, companySettingsPermissions } = useClientAgentContext();
  const { effectiveTheme } = useTheme();
  const location = useLocation();
  const { isImpersonating, activeSession, impersonationMode, targetUserName, elapsedMinutes, endImpersonation, exitAll, backToAgency, switchTarget, clientUsers, getReturnUrl } = useImpersonation();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  // Determine branding context
  const isClientView = isClientPreviewMode;
  const agencyId = isClientView ? (previewClientAgencyId ?? undefined) : undefined;
  
  // Use branding hook for dynamic branding
  const branding = useBranding({ isClientView, agencyId, appTheme: effectiveTheme });
  
  // Use multi-tenant auth if available
  const effectiveProfile = mtProfile || profile;
  const effectiveSignOut = mtProfile ? mtSignOut : signOut;

  // Determine which navigation to show based on preview depth AND active impersonation
  const { previewDepth } = useMultiTenantAuth();
  let navigation;
  
  // Also check the current route and impersonation session as fallback
  // This handles the case where previewDepth hasn't updated yet but we're on agency/client routes
  const currentPath = window.location.pathname;
  const isOnAgencyRoute = currentPath.startsWith('/agency');
  const isOnClientRoute = !currentPath.startsWith('/admin') && !currentPath.startsWith('/agency');
  const hasAgencySession = isImpersonating && activeSession?.target_type === 'agency';
  const hasClientSession = isImpersonating && activeSession?.client_id;

  // Check preview depth first (highest priority)
  if (previewDepth === 'agency_to_client' || previewDepth === 'client' || hasClientSession) {
    // Client preview mode → show filtered client navigation
    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    navigation = clientNavigation.filter(item => {
      // settings_page special check — always show in preview mode
      if (item.permissionKey === 'settings_page') return true;
      if (item.permissionKey && selectedAgent) {
        return (selectedAgentPermissions as unknown as Record<string, boolean> | null)?.[item.permissionKey] === true;
      }
      return item.permissionKey === null;
    }).filter(item => {
      if ((item as any).provider && selectedAgent) {
        return selectedAgent.provider === (item as any).provider;
      }
      return true;
    });
  } else if (previewDepth === 'agency' || hasAgencySession || (isOnAgencyRoute && userType === 'super_admin')) {
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
      // F8 fix: settings_page is client-scoped (not agent-scoped). The
      // canonical resolved value lives on companySettingsPermissions, which
      // is computed once per (user, client) — not once per (user, agent).
      // Reading from selectedAgentPermissions worked while F7 was broken
      // because both paths produced the same answer; with F7 fixed they
      // now diverge for users with client_user_permissions overrides.
      if (item.permissionKey === 'settings_page') return companySettingsPermissions?.settings_page === true;
      
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
      return (selectedAgentPermissions as unknown as Record<string, boolean> | null)?.[item.permissionKey] === true;
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

  const handleImpersonationExit = () => {
    const actorType = activeSession?.actor_type;
    const hasParent = !!activeSession?.parent_session_id;

    // Navigate FIRST, then clean up in the background
    // This prevents the brief login page flash that occurs when
    // endImpersonation clears bridge values before navigation completes
    if (hasParent && actorType === "super_admin") {
      backToAgency();
      window.location.href = "/agency/clients";
    } else {
      // Determine destination before clearing state
      let destination = "/";
      if (actorType === "super_admin") {
        destination = "/admin/agencies";
      } else if (actorType === "agency_user") {
        destination = "/agency/clients";
      } else {
        destination = getReturnUrl() || "/";
      }

      // Fire and forget — the admin route sync init will clean up bridge values
      endImpersonation();
      window.location.href = destination;
    }
  };

  const formatElapsed = (mins: number) => {
    if (mins < 1) return "< 1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };


  return (
    <div className={cn("hidden md:flex flex-col w-[240px] h-screen border-r border-border bg-card overflow-hidden flex-shrink-0", className)}>
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
                  ? "bg-theme-bg text-theme-fg"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Impersonation panel — super admin and agency users */}
      {(userType === 'super_admin' || userType === 'agency') && (
        <div className="relative border-t border-border">
          {/* Backdrop when expanded */}
          {overlayOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setOverlayOpen(false)}
            />
          )}

          <div className="relative z-50">
            {/* The single expanding container */}
            <div
              className={`rounded-lg mx-2 mb-1 mt-1 overflow-hidden transition-all ${
                overlayOpen
                  ? 'absolute bottom-0 left-0 right-0 mx-2 bg-background border border-border shadow-xl'
                  : isImpersonating
                  ? (() => {
                      const isAgencyView = activeSession?.target_type === 'agency';
                      const isUserView = impersonationMode === 'view_as_user';
                      return isAgencyView
                        ? 'bg-rose-bg border border-rose-bg-2'
                        : isUserView
                        ? 'bg-sage-bg border border-sage-bg-2'
                        : 'bg-sky-bg border border-sky-bg-2';
                    })()
                  : 'border border-border'
              }`}
              style={overlayOpen ? { maxHeight: 'calc(100vh - 160px)' } : {}}
            >
              {overlayOpen ? (
                /* ===== EXPANDED STATE ===== */
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[12px] font-semibold">
                        {userType === 'agency' ? 'Preview client' : 'Impersonate'}
                      </span>
                    </div>
                    <button
                      onClick={() => setOverlayOpen(false)}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Overlay content */}
                  <ImpersonationOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} />
                </>
              ) : isImpersonating ? (
                /* ===== COLLAPSED — ACTIVE SESSION CARD ===== */
                (() => {
                  const isAgencyView = activeSession?.target_type === 'agency';
                  const isUserView = impersonationMode === 'view_as_user';

                  const colors = isAgencyView
                    ? { icon: 'text-rose-fg', title: 'text-rose-fg', sub: 'text-rose-fg', line: 'bg-rose-bg-2', badge: 'bg-rose-bg text-rose-fg' }
                    : isUserView
                    ? { icon: 'text-sage-fg', title: 'text-sage-fg', sub: 'text-sage-fg', line: 'bg-sage-bg-2', badge: 'bg-sage-bg text-sage-fg' }
                    : { icon: 'text-sky-fg', title: 'text-sky-fg', sub: 'text-sky-fg', line: 'bg-sky-bg-2', badge: 'bg-sky-bg text-sky-fg' };

                  const TypeIcon = isAgencyView ? Building2 : isUserView ? User : Users;
                  const displayName = isAgencyView
                    ? (previewAgency?.name || sessionStorage.getItem('preview_agency_name') || 'Agency')
                    : isUserView
                    ? (targetUserName || 'User')
                    : (previewClient?.name || sessionStorage.getItem('preview_client_name') || 'Client');

                  return (
                    <div className="cursor-pointer" onClick={() => setOverlayOpen(true)}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Eye className={`w-3.5 h-3.5 ${colors.icon}`} />
                          <span className={`text-[12px] font-medium ${colors.title}`}>Impersonate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] ${colors.sub}`}>{formatElapsed(elapsedMinutes)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImpersonationExit(); }}
                            className={`w-4 h-4 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${colors.sub}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* 80% separator */}
                      <div className="flex justify-center px-2.5">
                        <div className={`w-[80%] h-[0.5px] ${colors.line} opacity-60`} />
                      </div>

                      {/* Target */}
                      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <TypeIcon className={`w-3 h-3 flex-shrink-0 ${colors.icon}`} />
                          <span className={`text-[11px] font-medium truncate ${colors.title}`}>{displayName}</span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ml-1.5 ${colors.badge}`}>
                          {isUserView ? 'read-only' : 'full access'}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ===== COLLAPSED — NO SESSION (BUTTON) ===== */
                <button
                  onClick={() => setOverlayOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-all"
                >
                  <Eye className="w-4 h-4 flex-shrink-0" />
                  {userType === 'agency' ? 'Preview client' : 'Impersonate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Card */}
      <UserProfileCard onSignOut={effectiveSignOut} />
    </div>
  );
}