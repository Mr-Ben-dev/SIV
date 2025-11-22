import { create } from "zustand";

export interface VaultConfig {
  owner: string; // Owner address
  targetsBps: number[]; // Target weights in basis points [WMAS, WETH.e, USDC.e]
  driftBps: number; // Max allowed drift in basis points
  epochSeconds: number; // Seconds per epoch
  slicesPerRebalance: number; // Number of slices for rebalancing
  guardArmed: boolean; // Risk-off guard status
}

export interface VaultBalances {
  wmas: bigint;
  wethe: bigint;
  usdce: bigint;
  total: bigint; // Total value in USDC terms
  totalShares: bigint; // Total shares issued by vault
  gasBank: bigint; // Gas bank balance in nanoMAS
}

export interface VaultWeights {
  wmas: number; // Current weight percentage
  wethe: number;
  usdce: number;
}

export interface VaultState {
  // Configuration
  config: VaultConfig | null;

  // State
  balances: VaultBalances | null;
  weights: VaultWeights | null;
  totalShares: bigint;
  gasBankMas: bigint;

  // Computed
  driftPercent: number; // Current drift from target
  nextRebalanceWindow: number | null; // Timestamp
  currentSlice: number;

  // Loading states
  loading: boolean;
  loadingConfig: boolean;
  loadingBalances: boolean;
  loadingShares: boolean;

  // Error state
  error: string | null;

  // Timestamps
  lastUpdated: number | null;

  // Actions
  setConfig: (config: VaultConfig) => void;
  setBalances: (balances: VaultBalances) => void;
  setWeights: (weights: VaultWeights) => void;
  setTotalShares: (shares: bigint) => void;
  setGasBankMas: (amount: bigint) => void;
  setDriftPercent: (percent: number) => void;
  setNextRebalanceWindow: (timestamp: number | null) => void;
  setCurrentSlice: (slice: number) => void;
  setLoading: (loading: boolean) => void;
  setLoadingConfig: (loading: boolean) => void;
  setLoadingBalances: (loading: boolean) => void;
  setLoadingShares: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (timestamp: number) => void;
  reset: () => void;
}

const initialState = {
  config: null,
  balances: null,
  weights: null,
  totalShares: 0n,
  gasBankMas: 0n,
  driftPercent: 0,
  nextRebalanceWindow: null,
  currentSlice: 0,
  loading: false,
  loadingConfig: false,
  loadingBalances: false,
  loadingShares: false,
  error: null,
  lastUpdated: null,
};

export const useVaultStore = create<VaultState>((set) => ({
  ...initialState,

  setConfig: (config) => set({ config }),
  setBalances: (balances) => set({ balances }),
  setWeights: (weights) => set({ weights }),
  setTotalShares: (shares) => set({ totalShares: shares }),
  setGasBankMas: (amount) => set({ gasBankMas: amount }),
  setDriftPercent: (percent) => set({ driftPercent: percent }),
  setNextRebalanceWindow: (timestamp) =>
    set({ nextRebalanceWindow: timestamp }),
  setCurrentSlice: (slice) => set({ currentSlice: slice }),
  setLoading: (loading) => set({ loading }),
  setLoadingConfig: (loading) => set({ loadingConfig: loading }),
  setLoadingBalances: (loading) => set({ loadingBalances: loading }),
  setLoadingShares: (loading) => set({ loadingShares: loading }),
  setError: (error) => set({ error }),
  setLastUpdated: (timestamp) => set({ lastUpdated: timestamp }),

  reset: () => set(initialState),
}));
