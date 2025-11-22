import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WalletInfo {
  name: string;
}

export interface WalletState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  address: string | null;
  addresses: string[];

  // Wallet selection
  availableWallets: WalletInfo[];
  selectedWalletName: string | null;

  // Provider state
  providerAvailable: boolean;
  providerChecked: boolean;

  // Network state
  isCorrectNetwork: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setAddress: (address: string | null) => void;
  setAddresses: (addresses: string[]) => void;
  setAvailableWallets: (wallets: WalletInfo[]) => void;
  setSelectedWalletName: (name: string | null) => void;
  setProviderAvailable: (available: boolean) => void;
  setProviderChecked: (checked: boolean) => void;
  setIsCorrectNetwork: (isCorrect: boolean) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  connecting: false,
  address: null,
  addresses: [],
  availableWallets: [],
  selectedWalletName: null,
  providerAvailable: false,
  providerChecked: false,
  isCorrectNetwork: true,
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      ...initialState,

      setConnected: (connected) => set({ connected }),
      setConnecting: (connecting) => set({ connecting }),
      setAddress: (address) => set({ address }),
      setAddresses: (addresses) => set({ addresses }),
      setAvailableWallets: (wallets) => set({ availableWallets: wallets }),
      setSelectedWalletName: (name) => set({ selectedWalletName: name }),
      setProviderAvailable: (available) =>
        set({ providerAvailable: available }),
      setProviderChecked: (checked) => set({ providerChecked: checked }),
      setIsCorrectNetwork: (isCorrect) => set({ isCorrectNetwork: isCorrect }),

      reset: () => set(initialState),
    }),
    {
      name: "siv-wallet-storage",
      partialize: (state) => ({
        // Only persist address and selected wallet, not connection state
        address: state.address,
        selectedWalletName: state.selectedWalletName,
      }),
    }
  )
);
