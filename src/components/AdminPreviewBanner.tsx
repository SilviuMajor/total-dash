import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminPreviewBanner() {
  const { profile } = useAuth();
  const location = useLocation();
  const [clientName, setClientName] = useState<string>("");
  
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const clientId = searchParams.get('clientId');

  useEffect(() => {
    if (isPreviewMode && clientId) {
      loadClientName(clientId);
    }
  }, [isPreviewMode, clientId]);

  const loadClientName = async (id: string) => {
    const { data } = await supabase
      .from('clients')
      .select('name')
      .eq('id', id)
      .single();
    
    if (data) {
      setClientName(data.name);
    }
  };

  const handleExitPreview = () => {
    window.close();
  };

  if (profile?.role !== 'admin' || !isPreviewMode || !clientId) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">Admin Preview Mode</p>
          <p className="text-sm text-blue-100">
            Viewing as: {clientName || 'Loading...'}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExitPreview}
        className="text-white hover:bg-blue-700"
      >
        <X className="w-4 h-4 mr-2" />
        Exit Preview
      </Button>
    </div>
  );
}
