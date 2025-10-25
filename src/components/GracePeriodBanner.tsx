import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GracePeriodBannerProps {
  gracePeriodEndsAt: string;
}

export function GracePeriodBanner({ gracePeriodEndsAt }: GracePeriodBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(gracePeriodEndsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining("expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`);
      } else {
        setTimeRemaining(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [gracePeriodEndsAt]);

  if (timeRemaining === "expired") {
    return null;
  }

  const handleUpdatePayment = () => {
    // This would typically open Stripe customer portal
    window.location.href = "/agency/subscription";
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-5 w-5" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong>Payment Failed - Action Required</strong>
          <p className="mt-1">
            Your subscription payment failed. Access will be revoked in <strong>{timeRemaining}</strong>.
          </p>
        </div>
        <Button onClick={handleUpdatePayment} variant="outline" size="sm">
          Update Payment
        </Button>
      </AlertDescription>
    </Alert>
  );
}
