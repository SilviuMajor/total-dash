import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgencyClientPreviewBanner() {
  const { 
    userType, 
    previewDepth,
    previewClient
  } = useMultiTenantAuth();

  const handleExitPreview = () => {
    window.close();
  };

  // Show when agency is previewing a client
  const shouldShow = (
    userType === 'agency' && 
    previewDepth === 'client' &&
    previewClient
  );

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <div>
          <p className="font-semibold">Agency Preview Mode</p>
          <p className="text-sm text-blue-100">
            Previewing Client: {previewClient?.name || 'Loading...'}
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
