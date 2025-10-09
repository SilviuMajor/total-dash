import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3, BookOpen, Settings, Users, Bot, LogOut, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { ClientAgentSelector } from "./ClientAgentSelector";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import fiveleafLogo from "@/assets/fiveleaf-logo.png";

  const clientNavigation = [
    { name: "Conversations", href: "/", icon: MessageSquare, permissionKey: "conversations" },
    { name: "Analytics", href: "/analytics", icon: BarChart3, permissionKey: "analytics" },
    { name: "Specifications", href: "/specs", icon: FileText, permissionKey: "specs" },
    { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permissionKey: "knowledge_base" },
    { name: "Agent Settings", href: "/agent-settings", icon: Settings, permissionKey: "agent_settings" },
  ];

const adminNavigation = [
  { name: "Clients", href: "/admin/clients", icon: Users },
  { name: "Agents", href: "/admin/agents", icon: Bot },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { selectedAgentPermissions } = useClientAgentContext();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin';
  const [agencyName, setAgencyName] = useState("Fiveleaf");
  const [agencyLogo, setAgencyLogo] = useState(fiveleafLogo);
  const [clientPermissions, setClientPermissions] = useState<any>(null);
  
  // Check for preview mode
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const previewClientId = searchParams.get('clientId');
  
  useEffect(() => {
    const loadAgencyBranding = async () => {
      const { data } = await supabase
        .from('agency_settings')
        .select('agency_name, agency_logo_url')
        .single();
      
      if (data?.agency_name) setAgencyName(data.agency_name);
      if (data?.agency_logo_url) setAgencyLogo(data.agency_logo_url);
    };
    loadAgencyBranding();
  }, []);

  useEffect(() => {
    if (isPreviewMode && previewClientId) {
      const loadClientPermissions = async () => {
        const { data } = await supabase
          .from('client_settings')
          .select('default_user_permissions')
          .eq('client_id', previewClientId)
          .single();
        
        if (data?.default_user_permissions) {
          setClientPermissions(data.default_user_permissions);
        }
      };
      loadClientPermissions();
    }
  }, [isPreviewMode, previewClientId]);
  
  // Determine which navigation to show
  // When admin is in preview mode, show client navigation
  const effectiveRole = (isAdmin && isPreviewMode) ? 'client' : profile?.role;
  
  // Filter navigation based on role and permissions
  const navigation = effectiveRole === 'admin' 
    ? adminNavigation 
    : clientNavigation.filter(item => {
        // In preview mode, use client's default permissions
        if (isPreviewMode && clientPermissions) {
          return clientPermissions[item.permissionKey] !== false;
        }
        // Otherwise use selectedAgentPermissions for regular client users
        return selectedAgentPermissions?.[item.permissionKey] === true;
      });

  // Helper to preserve preview params in navigation URLs
  const getNavHref = (basePath: string) => {
    if (isPreviewMode && previewClientId) {
      return `${basePath}?preview=true&clientId=${previewClientId}`;
    }
    return basePath;
  };

  return (
    <div className="flex flex-col w-64 h-screen border-r border-border bg-card/50 backdrop-blur-sm overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-center p-6 border-b border-border">
        <img src={agencyLogo} alt={agencyName} className="w-12 h-12 object-contain" />
      </div>
      
      {isPreviewMode && (
        <div className="px-4 py-2 bg-blue-600/10 border-b border-blue-600/20">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Eye className="w-4 h-4" />
            <span>Preview Mode</span>
          </div>
        </div>
      )}

      {effectiveRole === 'client' && (
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
            {profile?.email}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
