import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type BackButtonProps =
  | { to: string; onClick?: never }
  | { to?: never; onClick: () => void };

export function BackButton(props: BackButtonProps) {
  const navigate = useNavigate();
  const handleClick = props.onClick ?? (() => navigate(props.to!));
  return (
    <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Back">
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
