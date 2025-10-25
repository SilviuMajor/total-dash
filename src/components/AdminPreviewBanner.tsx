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
    isPreviewMode: mtIsPreviewMode, 
    previewAgency, 
    isClientPreviewMode, 
    previewClient 
  } = useMultiTenantAuth();
  
  const previewName = mtIsPreviewMode && previewAgency 
    ? previewAgency.name 
    : isClientPreviewMode && previewClient 
    ? previewClient.name 
    : "";
  
  const previewType = mtIsPreviewMode && previewAgency 
    ? 'agency' 
    : isClientPreviewMode && previewClient 
    ? 'client' 
    : null;

  const handleExitPreview = () => {
    window.close();
  };

  // Show for admin/super admin in preview mode
  const shouldShow = 
    (profile?.role === 'admin' && isClientPreviewMode && previewClient) ||
    (userType === 'super_admin' && mtIsPreviewMode && previewAgency);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">
            {previewType === 'agency' ? 'Super Admin' : 'Admin'} Preview Mode
          </p>
          <p className="text-sm text-blue-100">
            Viewing as: {previewName || 'Loading...'}
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
