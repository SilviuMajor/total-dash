import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { ProductSection } from "@/components/marketing/sections/ProductSection";
import { WorkflowSection } from "@/components/marketing/sections/WorkflowSection";
import { HandoverSection } from "@/components/marketing/sections/HandoverSection";
import { WhiteLabelSection } from "@/components/marketing/sections/WhiteLabelSection";
import { StatsSection } from "@/components/marketing/sections/StatsSection";
import { PricingSection } from "@/components/marketing/sections/PricingSection";
import { FinalCTASection } from "@/components/marketing/sections/FinalCTASection";

const landingFor = (userType: "super_admin" | "agency" | "client" | null): string | null => {
  switch (userType) {
    case "super_admin":
      return "/admin/agencies";
    case "agency":
      return "/agency/clients";
    case "client":
      return "/conversations";
    default:
      return null;
  }
};

export default function HomePage() {
  const { userType, loading } = useMultiTenantAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const target = landingFor(userType);
    if (target) navigate(target, { replace: true });
  }, [userType, loading, navigate]);

  return (
    <div data-marketing="true" className="min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <ProductSection />
        <WorkflowSection />
        <HandoverSection />
        <WhiteLabelSection />
        <StatsSection />
        <PricingSection />
        <FinalCTASection />
      </main>
      <MarketingFooter />
    </div>
  );
}
