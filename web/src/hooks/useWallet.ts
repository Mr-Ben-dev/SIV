import { isMainnet } from "@/config/env";
import { useToast } from "@/hooks/use-toast";
import {
  connectWallet as connectWalletLib,
  detectWalletProvider,
  disconnectWallet as disconnectWalletLib,
  getAccounts,
  getNodeStatus,
  selectWallet,
} from "@/lib/massa";
import { useNetworkStore } from "@/store/networkStore";
import { useWalletStore } from "@/store/walletStore";
import { useCallback, useEffect, useRef } from "react";

export function useWallet() {
  const { toast } = useToast();
  const connectingRef = useRef(false);

  const {
    connected,
    connecting,
    address,
    addresses,
    availableWallets,
    selectedWalletName,
    providerAvailable,
    providerChecked,
    isCorrectNetwork,
    setConnected,
    setConnecting,
    setAddress,
    setAddresses,
    setAvailableWallets,
    setSelectedWalletName,
    setProviderAvailable,
    setProviderChecked,
    setIsCorrectNetwork,
    reset: resetWallet,
  } = useWalletStore();

  const {
    setConnected: setNetworkConnected,
    setNodeVersion,
    setChainId,
    setError: setNetworkError,
  } = useNetworkStore();

  // Check if wallet provider is available and detect wallets
  const checkProvider = useCallback(async () => {
    if (providerChecked) return;

    try {
      const wallets = await detectWalletProvider();
      setAvailableWallets(wallets.map((w) => ({ name: w.name })));
      const available = wallets.length > 0;
      setProviderAvailable(available);
      setProviderChecked(true);

      if (!available) {
        toast({
          title: "Wallet Not Found",
          description:
            "Please install Bearby, MassaStation, or MetaMask with Massa Snap to continue.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to check wallet provider:", error);
      setProviderAvailable(false);
      setProviderChecked(true);
    }
  }, [
    providerChecked,
    setAvailableWallets,
    setProviderAvailable,
    setProviderChecked,
    toast,
  ]);

  // Check network connection
  const checkNetwork = useCallback(async () => {
    try {
      const status = await getNodeStatus();

      if (status.connected) {
        setNetworkConnected(true);
        setNodeVersion(status.nodeVersion || null);
        setChainId(status.chainId || null);
        setNetworkError(null);

        // Verify we're on the correct network
        const correctNetwork = isMainnet();
        setIsCorrectNetwork(correctNetwork);

        if (!correctNetwork) {
          toast({
            title: "Wrong Network",
            description: "Please switch to Massa Mainnet in your wallet.",
            variant: "destructive",
          });
        }
      } else {
        setNetworkConnected(false);
        setNetworkError(status.error || "Network disconnected");
      }
    } catch (error) {
      console.error("Failed to check network:", error);
      setNetworkConnected(false);
      setNetworkError("Failed to connect to network");
    }
  }, [
    setNetworkConnected,
    setNodeVersion,
    setChainId,
    setNetworkError,
    setIsCorrectNetwork,
    toast,
  ]);

  // Select wallet before connecting
  const chooseWallet = useCallback(
    (walletName: string) => {
      const success = selectWallet(walletName);
      if (success) {
        setSelectedWalletName(walletName);
      }
      return success;
    },
    [setSelectedWalletName]
  );

  // Connect wallet (must select wallet first)
  const connect = useCallback(
    async (walletName?: string) => {
      if (connecting || connected || connectingRef.current) return;

      connectingRef.current = true;
      setConnecting(true);

      try {
        // Provider availability should already be checked by useEffect
        if (!providerAvailable) {
          throw new Error("Wallet provider not available");
        }

        // If walletName provided, select it first
        if (walletName) {
          if (!chooseWallet(walletName)) {
            throw new Error(`Failed to select wallet: ${walletName}`);
          }
        } else if (!selectedWalletName) {
          // No wallet selected and none provided - show error
          throw new Error(
            "Please select a wallet first. Available wallets: " +
              availableWallets.map((w) => w.name).join(", ")
          );
        }

        // Check network
        await checkNetwork();

        // Connect wallet
        const accounts = await connectWalletLib();

        if (accounts.length === 0) {
          throw new Error("No accounts found");
        }

        setAddresses(accounts);
        setAddress(accounts[0]);
        setConnected(true);

        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(
            0,
            8
          )}...${accounts[0].slice(-6)}`,
        });
      } catch (error) {
        console.error("Failed to connect wallet:", error);

        toast({
          title: "Connection Failed",
          description:
            error instanceof Error ? error.message : "Failed to connect wallet",
          variant: "destructive",
        });

        resetWallet();
      } finally {
        connectingRef.current = false;
        setConnecting(false);
      }
    },
    [
      connecting,
      connected,
      providerAvailable,
      availableWallets,
      selectedWalletName,
      chooseWallet,
      setConnecting,
      setAddresses,
      setAddress,
      setConnected,
      resetWallet,
      checkNetwork,
      toast,
    ]
  );

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await disconnectWalletLib();
      resetWallet();

      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
      });
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }, [resetWallet, toast]);

  // Refresh accounts
  const refreshAccounts = useCallback(async () => {
    if (!connected) return;

    try {
      const accounts = await getAccounts();

      if (accounts.length === 0) {
        // Wallet was disconnected
        resetWallet();
        return;
      }

      setAddresses(accounts);

      // Update address if current one is no longer available
      if (address && !accounts.includes(address)) {
        setAddress(accounts[0]);
      }
    } catch (error) {
      console.error("Failed to refresh accounts:", error);
    }
  }, [connected, address, setAddresses, setAddress, resetWallet]);

  // Initialize on mount
  useEffect(() => {
    checkProvider();
    checkNetwork();
  }, [checkProvider, checkNetwork]); // Only run once on mount

  // Auto-reconnect after provider is checked
  useEffect(() => {
    // Only attempt auto-reconnect if:
    // 1. Provider has been checked
    // 2. Provider is available
    // 3. We have a saved wallet and address
    // 4. Not currently connected or connecting
    if (
      providerChecked &&
      providerAvailable &&
      selectedWalletName &&
      address &&
      !connected &&
      !connecting
    ) {
      console.log("Auto-reconnecting to", selectedWalletName);
      connect(selectedWalletName).catch((err) => {
        console.error("Auto-reconnect failed:", err);
      });
    }
  }, [
    providerChecked,
    providerAvailable,
    selectedWalletName,
    address,
    connected,
    connecting,
  ]);

  // Refresh accounts periodically if connected
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(refreshAccounts, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [connected, refreshAccounts]);

  return {
    // State
    connected,
    connecting,
    address,
    addresses,
    availableWallets,
    selectedWalletName,
    providerAvailable,
    isCorrectNetwork,

    // Actions
    connect,
    disconnect,
    refreshAccounts,
    checkNetwork,
    chooseWallet,
  };
}
