import { Badge } from "@/components/ui/badge";
import { config } from "@/config/env";
import { Lock } from "lucide-react";

export const NetworkBadge = () => {
  const network = config.network;
  const isMainnet = network === "mainnet";

  return (
    <Badge
      variant="outline"
      className={`text-xs ${
        isMainnet
          ? "border-success/30 text-success bg-success-muted"
          : "border-warning/30 text-warning bg-warning-muted"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full mr-2 ${
          isMainnet ? "bg-success" : "bg-warning"
        }`}
      />
      {isMainnet
        ? "Mainnet"
        : network.charAt(0).toUpperCase() + network.slice(1)}
      <Lock className="w-3 h-3 ml-1 opacity-50" />
    </Badge>
  );
};
