import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletConnectModal } from "@/components/WalletConnectModal";
import { useWallet } from "@/contexts/WalletContext";
import { shortAddr } from "@/lib/addresses";
import { Check, Copy, LogOut, Wallet } from "lucide-react";
import { useState } from "react";

export const WalletButton = () => {
  const [copied, setCopied] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { address, connecting, disconnect } = useWallet();

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  // Show connect button when not connected
  if (!address) {
    return (
      <>
        <Button
          onClick={() => setShowConnectModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={connecting}
        >
          <Wallet className="w-4 h-4 mr-2" />
          {connecting ? "Connecting..." : "Connect Wallet"}
        </Button>

        <WalletConnectModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />
      </>
    );
  }

  // Show connected state with dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="font-mono text-sm press-scale">
          <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
          {shortAddr(address)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Connected Address
        </div>
        <DropdownMenuItem
          onClick={handleCopy}
          className="cursor-pointer font-mono text-xs"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-success" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {shortAddr(address, 10, 8)}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={disconnect}
          className="cursor-pointer text-danger"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
