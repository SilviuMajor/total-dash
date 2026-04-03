import { useImpersonation } from "@/hooks/useImpersonation";
import { useAuth } from "@/hooks/useAuth";
import { Eye, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

export function ImpersonationBanner() {
  const { profile } = useAuth();
  const {
    isImpersonating,
    activeSession,
    impersonationMode,
    targetUserName,
    elapsedMinutes,
    clientUsers,
    switchTarget,
    endImpersonation,
    exitAll,
    backToAgency,
    getReturnUrl,
  } = useImpersonation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!isImpersonating || !activeSession) return null;

  // Determine banner colour by actor type
  const bannerColor =
    activeSession.actor_type === "super_admin"
      ? "bg-blue-700"
      : activeSession.actor_type === "agency_user"
      ? "bg-amber-600"
      : "bg-emerald-600";

  const hasParent = !!activeSession.parent_session_id;
  const isViewingAsUser = impersonationMode === "view_as_user";
  const displayMode = isViewingAsUser
    ? `as ${targetUserName || "user"}`
    : "as full access";

  const actorLabel =
    activeSession.actor_type === "super_admin"
      ? "Super Admin"
      : activeSession.actor_type === "agency_user"
      ? "Agency"
      : "Admin";

  const handleExit = async () => {
    if (hasParent) {
      await exitToParent();
      window.location.href = "/agency/clients";
    } else {
      await endImpersonation();
      if (activeSession.actor_type === "super_admin") {
        window.location.href = "/admin/agencies";
      } else if (activeSession.actor_type === "agency_user") {
        window.location.href = "/agency/clients";
      } else {
        // Client admin — return to stored URL or home
        const returnUrl = getReturnUrl();
        window.location.href = returnUrl || "/";
      }
    }
  };

  const handleExitAll = async () => {
    await exitAll();
    if (activeSession.actor_type === "super_admin") {
      window.location.href = "/admin/agencies";
    } else if (activeSession.actor_type === "agency_user") {
      window.location.href = "/agency/clients";
    } else {
      window.location.href = "/";
    }
  };

  const handleSwitchTarget = async (userId: string | null) => {
    await switchTarget(userId);
    setDropdownOpen(false);
  };

  const formatElapsed = (mins: number) => {
    if (mins < 1) return "< 1 min";
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className={`${bannerColor} text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50`}>
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold text-sm">
            Viewing {activeSession.client_id ? "client" : "agency"} {displayMode}
          </p>
          <p className="text-xs opacity-80">
            Logged in as: {activeSession.actor_name} ({actorLabel}) ·{" "}
            {formatElapsed(elapsedMinutes)}
            {isViewingAsUser && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-medium uppercase">
                Read-only
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* User switcher dropdown — only show when viewing a client */}
        {activeSession.client_id && clientUsers.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/15 hover:bg-white/25 transition-colors"
            >
              {isViewingAsUser ? targetUserName : "Full access"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-border overflow-hidden z-50">
                {/* Full access option */}
                <button
                  onClick={() => handleSwitchTarget(null)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    !isViewingAsUser
                      ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Full access
                  {!isViewingAsUser && (
                    <span className="ml-2 text-xs opacity-60">active</span>
                  )}
                </button>

                <div className="border-t border-border" />

                {/* User list */}
                <div className="max-h-64 overflow-y-auto">
                  {clientUsers
                    .filter((u) => u.user_id !== profile?.id)
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleSwitchTarget(u.user_id)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          targetUserName === u.full_name
                            ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs opacity-60">
                          {u.role_name}
                          {u.department_name ? ` · ${u.department_name}` : ""}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        {hasParent && (
          <Button variant="ghost" size="sm" onClick={handleExit} className="text-white hover:bg-white/15">
            Back
          </Button>
        )}

        {hasParent && (
          <Button variant="ghost" size="sm" onClick={handleExitAll} className="text-white hover:bg-white/15">
            <X className="w-4 h-4 mr-1" />
            Exit all
          </Button>
        )}

        {!hasParent && (
          <Button variant="ghost" size="sm" onClick={handleExit} className="text-white hover:bg-white/15">
            <X className="w-4 h-4 mr-1" />
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
