import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, FileText, Settings, Users, Bot, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import fiveleafLogo from "@/assets/fiveleaf-logo.png";

const clientNavigation = [
  { name: "Conversations", href: "/", icon: LayoutDashboard },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Transcripts", href: "/transcripts", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Clients", href: "/admin/clients", icon: Users },
  { name: "Agents", href: "/admin/agents", icon: Bot },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const { profile, signOut, hasPageAccess } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [agencyName, setAgencyName] = useState("Fiveleaf");
  const [agencyLogo, setAgencyLogo] = useState(fiveleafLogo);
  
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
  
  // Filter navigation based on permissions for client users
  const navigation = isAdmin 
    ? adminNavigation 
    : clientNavigation.filter(item => {
        const pageName = item.href === '/' ? 'dashboard' : item.href.substring(1);
        return hasPageAccess(pageName);
      });

  return (
    <div className="flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <img src={agencyLogo} alt={agencyName} className="w-10 h-10 object-contain" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {agencyName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Admin Portal' : 'Client Portal'}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
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
