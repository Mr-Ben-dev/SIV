import { create } from "zustand";

export interface NetworkState {
  // Connection status
  connected: boolean;
  checking: boolean;
  lastChecked: number | null;

  // Network info
  nodeVersion: string | null;
  chainId: string | null;

  // Performance
  latency: number | null;

  // Error state
  error: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setChecking: (checking: boolean) => void;
  setLastChecked: (timestamp: number) => void;
  setNodeVersion: (version: string | null) => void;
  setChainId: (chainId: string | null) => void;
  setLatency: (latency: number | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  checking: false,
  lastChecked: null,
  nodeVersion: null,
  chainId: null,
  latency: null,
  error: null,
};

export const useNetworkStore = create<NetworkState>((set) => ({
  ...initialState,

  setConnected: (connected) =>
    set({ connected, error: connected ? null : "Disconnected" }),
  setChecking: (checking) => set({ checking }),
  setLastChecked: (timestamp) => set({ lastChecked: timestamp }),
  setNodeVersion: (version) => set({ nodeVersion: version }),
  setChainId: (chainId) => set({ chainId }),
  setLatency: (latency) => set({ latency }),
  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
