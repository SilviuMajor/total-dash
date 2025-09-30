import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, Mic, Phone, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Recordings", href: "/recordings", icon: Mic },
  { name: "Live Calls", href: "/live", icon: Phone },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Phone className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            AgentDash
          </h1>
          <p className="text-xs text-muted-foreground">AI Voice Analytics</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
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

      <div className="p-4 border-t border-border">
        <div className="px-4 py-3 rounded-lg bg-muted/50">
          <p className="text-xs font-medium text-foreground">Current Client</p>
          <p className="text-sm text-muted-foreground mt-1">Acme Corp</p>
        </div>
      </div>
    </div>
  );
}
