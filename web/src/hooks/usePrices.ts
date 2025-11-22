/**
 * Hook for fetching and managing token prices
 */

import {
  clearPriceCache,
  getAllVaultTokenPrices,
  getVaultUSDValue,
} from "@/adapters/priceFeed";
import { useEffect, useState } from "react";

interface TokenPrices {
  wmas: number;
  wethe: number;
  usdce: number;
}

interface VaultBalances {
  wmas: bigint;
  wethe: bigint;
  usdce: bigint;
}

export function usePrices() {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async (useCache = true) => {
    try {
      setLoading(true);
      setError(null);
      const tokenPrices = await getAllVaultTokenPrices();
      setPrices(tokenPrices);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch prices";
      setError(errorMsg);
      console.error("Price fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch prices on mount
  useEffect(() => {
    fetchPrices();

    // Refresh prices every 30 seconds
    const interval = setInterval(() => {
      fetchPrices(true); // Use cache for automatic refreshes
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    clearPriceCache();
    fetchPrices(false); // Force fresh data
  };

  return {
    prices,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for calculating vault USD value
 */
export function useVaultUSDValue(balances: VaultBalances | null) {
  const [usdValue, setUsdValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!balances) {
      setUsdValue(null);
      return;
    }

    const calculateValue = async () => {
      try {
        setLoading(true);
        const value = await getVaultUSDValue(balances);
        setUsdValue(value);
      } catch (err) {
        console.error("Failed to calculate USD value:", err);
        setUsdValue(null);
      } finally {
        setLoading(false);
      }
    };

    calculateValue();
  }, [balances]);

  return { usdValue, loading };
}
