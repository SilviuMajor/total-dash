import { useLocation } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientPreviewBanner() {
  const { 
    userType, 
    previewDepth,
    previewClient, 
    previewClientAgencyId,
    profile 
  } = useMultiTenantAuth();

  const handleExitPreview = () => {
    window.close();
  };

  // Show for:
  // 1. Agency users previewing client
  // 2. Super admin in chained preview (agency → client)
  const shouldShow = (
    (userType === 'agency' && 
     previewDepth === 'client' &&
     previewClient &&
     previewClientAgencyId &&
     profile?.agency?.id === previewClientAgencyId)
    ||
    (userType === 'super_admin' &&
     previewDepth === 'agency_to_client' &&
     previewClient)
  );

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-purple-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">
            {userType === 'super_admin' ? 'Super Admin' : 'Agency'} Preview Mode
          </p>
          <p className="text-sm text-purple-100">
            Previewing Client: {previewClient?.name || 'Loading...'}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExitPreview}
        className="text-white hover:bg-purple-700"
      >
        <X className="w-4 h-4 mr-2" />
        Exit Preview
      </Button>
    </div>
  );
}
