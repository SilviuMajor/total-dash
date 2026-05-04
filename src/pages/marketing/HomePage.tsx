import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { ProductSection } from "@/components/marketing/sections/ProductSection";
import { WhiteLabelSection } from "@/components/marketing/sections/WhiteLabelSection";
import { HandoverSection } from "@/components/marketing/sections/HandoverSection";
import { TrustSection } from "@/components/marketing/sections/TrustSection";
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
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <ProductSection />
        <WhiteLabelSection />
        <HandoverSection />
        <TrustSection />
        <PricingSection />
        <FinalCTASection />
      </main>
      <MarketingFooter />
    </div>
  );
}
