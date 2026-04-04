import { useState, useEffect, useRef } from "react";
import { ImpersonationOverlay } from "./ImpersonationOverlay";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, User, Bot, Eye, FileText, Home, CreditCard, Building2, DollarSign, Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { useImpersonation } from "@/hooks/useImpersonation";
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
  const { isImpersonating, activeSession, impersonationMode, targetUserName, elapsedMinutes, endImpersonation, exitAll, backToAgency, switchTarget, clientUsers, getReturnUrl } = useImpersonation();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = profile?.role === 'admin';
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const handleImpersonationExit = async () => {
    const hasParent = !!activeSession?.parent_session_id;
    if (hasParent && activeSession?.actor_type === "super_admin") {
      await backToAgency();
      window.location.href = "/agency/clients";
    } else {
      await endImpersonation();
      if (activeSession?.actor_type === "super_admin") {
        window.location.href = "/admin/agencies";
      } else if (activeSession?.actor_type === "agency_user") {
        window.location.href = "/agency/clients";
      } else {
        const returnUrl = getReturnUrl();
        window.location.href = returnUrl || "/";
      }
    }
  };

  const handleSwitchTarget = async (userId: string | null) => {
    await switchTarget(userId);
    setUserDropdownOpen(false);
  };

  const formatElapsed = (mins: number) => {
    if (mins < 1) return "< 1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
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

      {/* Impersonation panel — super admin and agency users */}
      {(userType === 'super_admin' || userType === 'agency') && (
        <div className="px-2.5 pb-1 border-t border-border">
          {!isImpersonating ? (
            /* Inactive — outlined button */
            <button
              onClick={() => setOverlayOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-all"
            >
              <Eye className="w-4 h-4 flex-shrink-0" />
              {userType === 'agency' ? 'Preview client' : 'Impersonate'}
            </button>
          ) : (
            /* Active — light pastel card */
            (() => {
              const isAgencyView = activeSession?.target_type === 'agency';
              const isUserView = impersonationMode === 'view_as_user';

              const colors = isAgencyView
                ? { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', title: 'text-red-900 dark:text-red-100', sub: 'text-red-700 dark:text-red-300', line: 'bg-red-200 dark:bg-red-800', badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' }
                : isUserView
                ? { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: 'text-green-600 dark:text-green-400', title: 'text-green-900 dark:text-green-100', sub: 'text-green-700 dark:text-green-300', line: 'bg-green-200 dark:bg-green-800', badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' }
                : { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', title: 'text-blue-900 dark:text-blue-100', sub: 'text-blue-700 dark:text-blue-300', line: 'bg-blue-200 dark:bg-blue-800', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' };

              const TypeIcon = isAgencyView ? Building2 : isUserView ? User : Users;

              const displayName = isAgencyView
                ? 'Agency'
                : isUserView
                ? (targetUserName || 'User')
                : 'Client';

              return (
                <div
                  className={`mt-2 rounded-lg ${colors.bg} border ${colors.border} cursor-pointer transition-all`}
                  onClick={() => setOverlayOpen(true)}
                >
                  {/* Header row */}
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

                  {/* Separator */}
                  <div className="flex justify-center px-2.5">
                    <div className={`w-[80%] h-[0.5px] ${colors.line} opacity-60`} />
                  </div>

                  {/* Target row */}
                  <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <TypeIcon className={`w-3 h-3 flex-shrink-0 ${colors.icon}`} />
                      <span className={`text-[11px] font-medium truncate ${colors.title}`}>{displayName}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ml-1.5 ${colors.badge}`}>
                      {isUserView ? 'read-only' : 'full access'}
                    </span>
                  </div>

                  {/* User switcher — only for client viewing */}
                  {activeSession?.client_id && clientUsers.length > 0 && (
                    <div className="px-2.5 pb-2">
                      <div className="relative" ref={userDropdownRef}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setUserDropdownOpen(!userDropdownOpen); }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-[10px] transition-colors border ${colors.border} hover:bg-black/5 dark:hover:bg-white/5`}
                        >
                          <span className={`truncate ${colors.sub}`}>{isUserView ? targetUserName : 'Full access'}</span>
                          <ChevronDown className={`w-2.5 h-2.5 ml-1 flex-shrink-0 transition-transform ${colors.sub} ${userDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {userDropdownOpen && (
                          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-border overflow-hidden z-50">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSwitchTarget(null); }}
                              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                !isUserView
                                  ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Full access
                            </button>
                            <div className="border-t border-border" />
                            <div className="max-h-40 overflow-y-auto">
                              {clientUsers.map((u) => (
                                <button
                                  key={u.user_id}
                                  onClick={(e) => { e.stopPropagation(); handleSwitchTarget(u.user_id); }}
                                  className={`w-full text-left px-3 py-1 text-[11px] hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                    targetUserName === u.full_name
                                      ? 'text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950/30'
                                      : 'text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <p>{u.full_name}</p>
                                  <p className="text-[9px] opacity-50">{u.role_name}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Back to agency */}
                  {activeSession?.parent_session_id && activeSession?.actor_type === 'super_admin' && (
                    <div className="px-2.5 pb-2">
                      <button
                        onClick={async (e) => { e.stopPropagation(); await backToAgency(); window.location.href = '/agency/clients'; }}
                        className={`text-[10px] ${colors.sub} hover:underline transition-colors`}
                      >
                        ← Back to agency
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* User Profile Card */}
      <UserProfileCard onSignOut={effectiveSignOut} />

      {/* Impersonation Panel */}
      {(userType === 'super_admin' || userType === 'agency') && (
        <ImpersonationOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}