import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/Sidebar";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const { effectiveTheme } = useTheme();
  const { isClientPreviewMode, previewClientAgencyId } = useMultiTenantAuth();
  const branding = useBranding({
    isClientView: isClientPreviewMode,
    agencyId: isClientPreviewMode ? previewClientAgencyId : undefined,
    appTheme: effectiveTheme,
  });

  return (
    <div className="md:hidden flex items-center gap-2 h-12 px-3 border-b border-border bg-card flex-shrink-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[260px]">
          <div onClick={() => setOpen(false)} className="h-full">
            <Sidebar className="flex w-full border-r-0" />
          </div>
        </SheetContent>
      </Sheet>
      <span className="text-sm font-semibold truncate">{branding.companyName}</span>
    </div>
  );
}
