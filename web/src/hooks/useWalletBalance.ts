/**
 * Hook for fetching user wallet token balances
 */
import { TOKENS } from "@/adapters/dex";
import { getMultipleTokenPrices } from "@/adapters/priceFeed";
import { config } from "@/config/env";
import { useWallet } from "@/contexts/WalletContext";
import { getAddressBalance, getTokenBalance } from "@/lib/massaSimple";
import { useCallback, useEffect, useState } from "react";

interface WalletBalances {
  usdce: bigint;
  wmas: bigint;
  wethe: bigint;
  mas: bigint; // Native MAS balance
  totalUSD: number; // Total USD value of all wallet assets
}

export function useWalletBalance() {
  const { address, connected } = useWallet();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address || !connected) {
      setBalances(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all token balances in parallel using real blockchain data
      const [usdceBalance, wmasBalance, wetheBalance, masBalance] =
        await Promise.all([
          getTokenBalance(config.addresses.usdce, address),
          getTokenBalance(config.addresses.wmas, address),
          getTokenBalance(config.addresses.wethe, address),
          getAddressBalance(address), // Native MAS balance
        ]);

      // Get prices for USD value calculation
      const priceMap = await getMultipleTokenPrices([
        TOKENS.WMAS,
        TOKENS.WETHE,
        TOKENS.USDCE,
      ]);

      // Calculate USD values with correct decimals
      // MAS: 9 decimals, WMAS: 9 decimals, WETH.e: 18 decimals, USDC.e: 6 decimals
      const masPrice = priceMap.get(TOKENS.WMAS) || 0; // MAS and WMAS have same price
      const masValue = (Number(masBalance) / 1_000_000_000) * masPrice;
      const wmasValue = (Number(wmasBalance) / 1_000_000_000) * masPrice;
      const wetheValue =
        (Number(wetheBalance) / 1_000_000_000_000_000_000) *
        (priceMap.get(TOKENS.WETHE) || 0);
      const usdceValue = (Number(usdceBalance) / 1_000_000) * 1.0; // Stablecoin

      const totalUSD = masValue + wmasValue + wetheValue + usdceValue;

      setBalances({
        usdce: usdceBalance,
        wmas: wmasBalance,
        wethe: wetheBalance,
        mas: masBalance,
        totalUSD,
      });
    } catch (err) {
      console.error("Failed to fetch wallet balances:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, [address, connected]);

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    balances,
    loading,
    error,
    refresh: fetchBalances,
  };
}
