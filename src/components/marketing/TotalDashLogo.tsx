import { cn } from "@/lib/utils";

const FULL_LOGO_LIGHT =
  "https://fkbpxsneprdmiskftteo.supabase.co/storage/v1/object/public/platform-branding/full-logo_1761935140422.png";
const FULL_LOGO_DARK =
  "https://fkbpxsneprdmiskftteo.supabase.co/storage/v1/object/public/platform-branding/full-logo_1761935143126.png";
const ICON_LOGO_LIGHT =
  "https://fkbpxsneprdmiskftteo.supabase.co/storage/v1/object/public/platform-branding/logo_1761934046278.png";

type Props = {
  variant?: "full" | "icon";
  tone?: "light" | "dark";
  className?: string;
};

export const TotalDashLogo = ({ variant = "full", tone = "light", className }: Props) => {
  const src =
    variant === "icon"
      ? ICON_LOGO_LIGHT
      : tone === "dark"
        ? FULL_LOGO_DARK
        : FULL_LOGO_LIGHT;

  return (
    <img
      src={src}
      alt="Total Dash"
      draggable={false}
      className={cn("select-none", className)}
    />
  );
};
