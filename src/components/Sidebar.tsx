import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, Bot, LogOut, Eye, FileText, Home, CreditCard, Building2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { ClientAgentSelector } from "./ClientAgentSelector";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import fiveleafLogo from "@/assets/fiveleaf-logo.png";

const clientNavigation = [
  { name: "Conversations", href: "/", icon: MessageSquare, permissionKey: "conversations", provider: "voiceflow" },
  { name: "Transcripts", href: "/transcripts", icon: MessageSquare, permissionKey: "transcripts", provider: "retell" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, permissionKey: "analytics" },
  { name: "Specifications", href: "/specs", icon: FileText, permissionKey: "specs" },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permissionKey: "knowledge_base" },
  { name: "Guides", href: "/guides", icon: BookOpen, permissionKey: null },
  { name: "Agent Settings", href: "/agent-settings", icon: Settings, permissionKey: "agent_settings" },
];

const adminNavigation = [
  { name: "Clients", href: "/admin/clients", icon: Users },
  { name: "Agents", href: "/admin/agents", icon: Bot },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

const agencyNavigation = [
  { name: "Clients", href: "/agency/clients", icon: Users, permissionKey: "clients" },
  { name: "Agents", href: "/agency/agents", icon: Bot, permissionKey: "agents" },
  { name: "Subscription", href: "/agency/subscription", icon: CreditCard, permissionKey: "subscription" },
  { name: "Settings", href: "/agency/settings", icon: Settings as any, permissionKey: "settings" },
];

const superAdminNavigation = [
  { name: "Agencies", href: "/super-admin/agencies", icon: Building2 },
  { name: "Billing", href: "/super-admin/billing", icon: DollarSign },
  { name: "Plans", href: "/super-admin/plans", icon: CreditCard },
  { name: "Settings", href: "/super-admin/settings", icon: Settings },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { profile: mtProfile, userType, signOut: mtSignOut, isPreviewMode: mtIsPreviewMode, previewAgency, isClientPreviewMode, previewClient, previewClientAgencyId } = useMultiTenantAuth();
  const { selectedAgentPermissions, agents, selectedAgentId } = useClientAgentContext();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin';
  const [agencyName, setAgencyName] = useState("Fiveleaf");
  const [agencyLogo, setAgencyLogo] = useState(fiveleafLogo);
  const [clientPermissions, setClientPermissions] = useState<any>(null);
  
  // Use multi-tenant auth if available
  const effectiveProfile = mtProfile || profile;
  const effectiveSignOut = mtProfile ? mtSignOut : signOut;
  
  useEffect(() => {
    const loadAgencyBranding = async () => {
      // If super admin previewing agency, use preview agency branding
      if (mtIsPreviewMode && previewAgency) {
        if (previewAgency.name) setAgencyName(previewAgency.name);
        if (previewAgency.logo_url) setAgencyLogo(previewAgency.logo_url);
        return;
      }
      
      // For agency users, use their agency branding
      if (mtProfile?.agency) {
        if (mtProfile.agency.name) setAgencyName(mtProfile.agency.name);
        if (mtProfile.agency.logo_url) setAgencyLogo(mtProfile.agency.logo_url);
        return;
      }
      
      // Fallback to agency_settings for backward compatibility
      const { data } = await supabase
        .from('agency_settings')
        .select('agency_name, agency_logo_url')
        .single();
      
      if (data?.agency_name) setAgencyName(data.agency_name);
      if (data?.agency_logo_url) setAgencyLogo(data.agency_logo_url);
    };
    loadAgencyBranding();
  }, [mtProfile, mtIsPreviewMode, previewAgency]);

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
    // Regular super admin → show super admin navigation
    navigation = superAdminNavigation;
  } else if (userType === 'agency') {
    // Regular agency → show agency navigation
    navigation = agencyNavigation;
  } else if (effectiveProfile?.role === 'admin') {
    // Admin users → show admin navigation
    navigation = adminNavigation;
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
        <img src={agencyLogo} alt={agencyName} className="w-12 h-12 object-contain" />
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

      <div className="p-4 border-t border-border space-y-3">
        <div className="px-4 py-3 rounded-lg bg-muted/50">
          <p className="text-xs font-medium text-foreground">Logged in as</p>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {effectiveProfile?.email}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {userType || effectiveProfile?.role}
          </p>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={effectiveSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
