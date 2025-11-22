/**
 * Wallet connection modal - like Dusa's design
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/contexts/WalletContext";
import { Loader2 } from "lucide-react";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
}

const WALLET_ICONS: Record<string, string> = {
  BEARBY: "🐻",
  "MASSA STATION": "⭐",
  METAMASK: "🦊",
};

export function WalletConnectModal({ open, onClose }: WalletConnectModalProps) {
  const { wallets, connecting, connect } = useWallet();

  const handleConnect = async (walletName: string) => {
    await connect(walletName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet provider to connect to the dApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {wallets.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>No wallet providers found.</p>
              <p className="mt-2">
                Please install Bearby, Massa Station, or MetaMask with Massa
                Snap.
              </p>
            </div>
          ) : (
            wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                disabled={connecting}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-3xl">
                  {WALLET_ICONS[wallet.name.toUpperCase()] || "💼"}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{wallet.name}</div>
                </div>
                {connecting && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>

        {wallets.length === 0 && (
          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>
              <a
                href="https://www.bearby.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Install Bearby
              </a>
            </p>
            <p>
              <a
                href="https://station.massa/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Install Massa Station
              </a>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
