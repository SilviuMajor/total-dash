import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Zap, X } from "lucide-react";

interface QuickTarget {
  id: string;
  name: string;
  type: "agency" | "client";
  agency_id?: string;
}

export function DevSwitch() {
  const { userType } = useMultiTenantAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<QuickTarget[]>([]);
  const [loading, setLoading] = useState(false);

  if (userType !== "super_admin") return null;

  const loadTargets = async () => {
    if (targets.length > 0) return;
    setLoading(true);
    try {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .limit(5);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, agency_id")
        .is("deleted_at", null)
        .order("name")
        .limit(10);

      const items: QuickTarget[] = [];
      (agencies || []).forEach((a) => items.push({ id: a.id, name: a.name, type: "agency" }));
      (clients || []).forEach((c) => items.push({ id: c.id, name: c.name, type: "client", agency_id: c.agency_id ?? undefined }));
      setTargets(items);
    } catch (e) {
      console.error("DevSwitch load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const switchTo = (target: "admin" | QuickTarget) => {
    sessionStorage.removeItem("preview_mode");
    sessionStorage.removeItem("preview_agency");
    sessionStorage.removeItem("preview_client");
    sessionStorage.removeItem("preview_client_agency");
    sessionStorage.removeItem("preview_token");
    sessionStorage.removeItem("impersonation_session_id");
    sessionStorage.removeItem("impersonation_return_url");
    sessionStorage.setItem('dev_switch_active', 'true');

    if (target === "admin") {
      sessionStorage.removeItem('dev_switch_active');
      window.dispatchEvent(new Event("impersonation-changed"));
      navigate("/admin/agencies");
    } else if (target.type === "agency") {
      sessionStorage.setItem("preview_mode", "agency");
      sessionStorage.setItem("preview_agency", target.id);
      window.dispatchEvent(new Event("impersonation-changed"));
      navigate("/agency/clients");
    } else if (target.type === "client") {
      sessionStorage.setItem("preview_mode", "client");
      sessionStorage.setItem("preview_client", target.id);
      if (target.agency_id) {
        sessionStorage.setItem("preview_client_agency", target.agency_id);
      }
      window.dispatchEvent(new Event("impersonation-changed"));
      navigate("/");
    }

    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) loadTargets();
  };

  const agencies = targets.filter((t) => t.type === "agency");
  const clients = targets.filter((t) => t.type === "client");
  const currentMode = sessionStorage.getItem("preview_mode");

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 99999 }}>
      {open && (
        <div style={{ position: "absolute", bottom: 50, right: 0, width: 260, background: "white", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.2)", overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#7c3aed", color: "white", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            DEV QUICK SWITCH
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "white" }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ maxHeight: 350, overflowY: "auto" }}>
            <button
              onClick={() => switchTo("admin")}
              style={{
                width: "100%", padding: "8px 10px", textAlign: "left", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
                background: !currentMode ? "#f0f0f0" : "white",
              }}
            >
              🛡️ Admin Dashboard
            </button>

            {loading ? (
              <p style={{ padding: 10, fontSize: 12, color: "#999" }}>Loading...</p>
            ) : (
              <>
                {agencies.length > 0 && (
                  <>
                    <p style={{ padding: "6px 10px 2px", fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase" }}>Agencies</p>
                    {agencies.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => switchTo(a)}
                        style={{
                          width: "100%", padding: "6px 10px", textAlign: "left", border: "none", cursor: "pointer",
                          fontSize: 12, display: "flex", alignItems: "center", gap: 6,
                          background: currentMode === "agency" ? "#fef2f2" : "white",
                        }}
                      >
                        🏢 {a.name}
                      </button>
                    ))}
                  </>
                )}

                {clients.length > 0 && (
                  <>
                    <p style={{ padding: "6px 10px 2px", fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase" }}>Clients</p>
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => switchTo(c)}
                        style={{
                          width: "100%", padding: "6px 10px", textAlign: "left", border: "none", cursor: "pointer",
                          fontSize: 12, display: "flex", alignItems: "center", gap: 6,
                          background: currentMode === "client" ? "#eff6ff" : "white",
                        }}
                      >
                        👤 {c.name}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <button onClick={handleOpen} style={{ width: 44, height: 44, borderRadius: "50%", background: "#7c3aed", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>
        <Zap size={20} />
      </button>
    </div>
  );
}
