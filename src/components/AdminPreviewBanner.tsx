import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminPreviewBanner() {
  const { profile } = useAuth();
  const { 
    userType, 
    previewDepth,
    previewAgency, 
    previewClient 
  } = useMultiTenantAuth();
  
  const handleExitPreview = () => {
    window.close();
  };

  // Show for super admin previewing agency (not client preview chain)
  const shouldShow = 
    userType === 'super_admin' && 
    previewDepth === 'agency' &&
    previewAgency;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">
            Super Admin Preview Mode
          </p>
          <p className="text-sm text-blue-100">
            Previewing Agency: {previewAgency?.name || 'Loading...'}
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
