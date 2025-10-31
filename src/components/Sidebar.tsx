import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, Bot, Eye, FileText, Home, CreditCard, Building2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { ClientAgentSelector } from "./ClientAgentSelector";
import { UserProfileCard } from "./UserProfileCard";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

const clientNavigation = [
  { name: "Conversations", href: "/", icon: MessageSquare, permissionKey: "conversations", provider: "voiceflow" },
  { name: "Transcripts", href: "/transcripts", icon: MessageSquare, permissionKey: "transcripts", provider: "retell" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, permissionKey: "analytics" },
  { name: "Specifications", href: "/specs", icon: FileText, permissionKey: "specs" },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permissionKey: "knowledge_base" },
  { name: "Guides", href: "/guides", icon: BookOpen, permissionKey: null },
  { name: "Agent Settings", href: "/agent-settings", icon: Settings, permissionKey: "agent_settings" },
];

const agencyNavigation = [
  { name: "Clients", href: "/agency/clients", icon: Users, permissionKey: "clients" },
  { name: "Agents", href: "/agency/agents", icon: Bot, permissionKey: "agents" },
  { name: "Subscription", href: "/agency/subscription", icon: CreditCard, permissionKey: "subscription" },
  { name: "Settings", href: "/agency/settings", icon: Settings as any, permissionKey: "settings" },
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
  const isAdmin = profile?.role === 'admin';
  const [clientPermissions, setClientPermissions] = useState<any>(null);
  
  // Determine branding context
  const isClientView = isClientPreviewMode;
  const agencyId = previewClientAgencyId || (mtProfile?.agency?.id);
  
  // Use branding hook for dynamic branding
  const branding = useBranding({ isClientView, agencyId, appTheme: effectiveTheme });
  
  // Use multi-tenant auth if available
  const effectiveProfile = mtProfile || profile;
  const effectiveSignOut = mtProfile ? mtSignOut : signOut;

  useEffect(() => {
    if (isClientPreviewMode && previewClient) {
      const loadClientPermissions = async () => {
        const { data } = await supabase
          .from('client_settings')
          .select('default_user_permissions')
          .eq('client_id', previewClient.id)
          .single();
        
        if (data?.default_user_permissions) {
          setClientPermissions(data.default_user_permissions);
        }
      };
      loadClientPermissions();
    }
  }, [isClientPreviewMode, previewClient]);
  
  // Determine which navigation to show based on preview depth
  const { previewDepth } = useMultiTenantAuth();
  let navigation;
  
  // Check preview depth first (highest priority)
  if (previewDepth === 'agency_to_client' || previewDepth === 'client') {
    // Client preview mode → show filtered client navigation
    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    navigation = clientNavigation.filter(item => {
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
    if (previewDepth === 'agency_to_client' || previewDepth === 'client') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('preview')) {
        return `${basePath}?${params.toString()}`;
      }
    }
    return basePath;
  };

  return (
    <div className="flex flex-col w-64 h-screen border-r border-border bg-card/50 backdrop-blur-sm overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-center p-6 border-b border-border">
        {branding.logoUrl ? (
          <img 
            src={branding.logoUrl} 
            alt={branding.companyName} 
            className="w-12 h-12 object-contain" 
          />
        ) : (
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {branding.companyName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      {(mtIsPreviewMode || isClientPreviewMode) && (
        <div className="px-4 py-2 bg-blue-600/10 border-b border-blue-600/20">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Eye className="w-4 h-4" />
            <span>Preview Mode</span>
          </div>
        </div>
      )}

      {(effectiveProfile?.role === 'client' || previewDepth === 'client' || previewDepth === 'agency_to_client') && (
        <div className="p-4 border-b border-border">
          <ClientAgentSelector />
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={getNavHref(item.href)}
            end={item.href === "/" || item.href === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User Profile Card */}
      <UserProfileCard onSignOut={effectiveSignOut} />
    </div>
  );
}
