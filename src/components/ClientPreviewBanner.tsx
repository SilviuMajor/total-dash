import { useLocation } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientPreviewBanner() {
  const { userType, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const location = useLocation();
  
  const searchParams = new URLSearchParams(location.search);
  const clientId = searchParams.get('clientId');
  const agencyId = searchParams.get('agencyId');

  const handleExitPreview = () => {
    window.close();
  };

  // Show for agency users previewing client analytics
  const shouldShow = 
    userType === 'agency' && 
    isPreviewMode && 
    clientId && 
    agencyId &&
    previewAgency?.id === agencyId;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-purple-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">
            Agency Preview Mode
          </p>
          <p className="text-sm text-purple-100">
            Viewing client analytics
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
