import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import Dashboard from "@/pages/Dashboard";

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    loadClientInfo();
  }, [clientId]);

  const loadClientInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      setClientName(data.name);
    } catch (error) {
      console.error('Error loading client:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 bg-gradient-card border-border/50 animate-pulse">
          <div className="h-32 w-64"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8">
        <Dashboard />
      </div>
    </div>
  );
}
