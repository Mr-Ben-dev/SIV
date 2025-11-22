/**
 * Wallet Context - Provides wallet state globally
 */
import { useToast } from "@/hooks/use-toast";
import { getWallets } from "@massalabs/wallet-provider";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface WalletInfo {
  name: string;
}

interface WalletContextType {
  wallets: WalletInfo[];
  selectedWallet: any;
  address: string | null;
  connecting: boolean;
  connected: boolean;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  // Detect available wallets once on mount
  useEffect(() => {
    getWallets()
      .then((availableWallets) => {
        setWallets(availableWallets.map((w) => ({ name: w.name() })));
      })
      .catch((err) => {
        console.error("Failed to detect wallets:", err);
      });
  }, []);

  // Connect to wallet
  const connect = useCallback(
    async (walletName: string) => {
      if (connecting) return;
      setConnecting(true);

      try {
        // Get the specific wallet
        const availableWallets = await getWallets();
        const wallet = availableWallets.find((w) => w.name() === walletName);

        if (!wallet) {
          throw new Error(`Wallet ${walletName} not found`);
        }

        // Connect
        const connected = await wallet.connect();
        if (!connected) {
          throw new Error("Wallet connection rejected");
        }

        // Get accounts
        const accounts = await wallet.accounts();
        if (accounts.length === 0) {
          throw new Error("No accounts found");
        }

        // Get address - it's a getter property
        const accountAddress = accounts[0].address;

        setSelectedWallet(wallet);
        setAddress(accountAddress);

        // Save to localStorage for reconnection
        localStorage.setItem("siv-wallet", walletName);
        localStorage.setItem("siv-address", accountAddress);

        toast({
          title: "Wallet Connected",
          description: `Connected to ${walletName}`,
        });
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        toast({
          title: "Connection Failed",
          description:
            error instanceof Error ? error.message : "Failed to connect wallet",
          variant: "destructive",
        });
      } finally {
        setConnecting(false);
      }
    },
    [connecting, toast]
  );

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (selectedWallet && selectedWallet.disconnect) {
        await selectedWallet.disconnect();
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setSelectedWallet(null);
      setAddress(null);
      localStorage.removeItem("siv-wallet");
      localStorage.removeItem("siv-address");

      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
      });
    }
  }, [selectedWallet, toast]);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const savedWallet = localStorage.getItem("siv-wallet");
    const savedAddress = localStorage.getItem("siv-address");

    if (
      savedWallet &&
      savedAddress &&
      !selectedWallet &&
      !connecting &&
      wallets.length > 0
    ) {
      // Try to reconnect silently
      connect(savedWallet).catch(() => {
        // If reconnection fails, clear saved data
        localStorage.removeItem("siv-wallet");
        localStorage.removeItem("siv-address");
      });
    }
  }, [wallets.length]); // Run when wallets are detected

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWallet,
        address,
        connecting,
        connected: !!selectedWallet && !!address,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
