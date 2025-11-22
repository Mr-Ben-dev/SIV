/**
 * Example: How to use DEX and Price Feed adapters
 *
 * This file demonstrates the usage patterns for the DEX and Price Feed adapters.
 * Copy these patterns into your components as needed.
 */

import {
  executeDusaSwap,
  getDusaQuote,
  getTokenToUSDCQuote,
  TOKENS,
} from "@/adapters/dex";
import {
  formatLargeUSDValue,
  formatUSDPrice,
  getTokenPrice,
  getVaultUSDValue,
} from "@/adapters/priceFeed";
import { useState } from "react";

/**
 * Example 1: Get a swap quote
 */
export async function exampleGetQuote() {
  try {
    // Get quote for swapping 100 WMAS to USDC.e
    const amountIn = 100_000_000n; // 100 WMAS (6 decimals)

    const quote = await getDusaQuote(TOKENS.WMAS, TOKENS.USDCE, amountIn);

    console.log("Quote:", {
      amountOut: quote.amountOut.toString(),
      route: quote.route,
      priceImpact: `${quote.priceImpact / 100}%`,
      fees: quote.fees.toString(),
    });

    return quote;
  } catch (error) {
    console.error("Failed to get quote:", error);
    throw error;
  }
}

/**
 * Example 2: Execute a swap
 */
export async function exampleExecuteSwap() {
  try {
    // First get a quote
    const amountIn = 10_000_000n; // 10 WMAS
    const quote = await getDusaQuote(TOKENS.WMAS, TOKENS.USDCE, amountIn);

    // Apply 1% slippage tolerance
    const minAmountOut = (quote.amountOut * 99n) / 100n;

    // Execute the swap
    const opId = await executeDusaSwap({
      tokenIn: TOKENS.WMAS,
      tokenOut: TOKENS.USDCE,
      amountIn,
      minAmountOut,
    });

    console.log("Swap operation ID:", opId);
    return opId;
  } catch (error) {
    console.error("Failed to execute swap:", error);
    throw error;
  }
}

/**
 * Example 3: Get token price in USD
 */
export async function exampleGetPrice() {
  try {
    // Get WMAS price in USD
    const wmasPrice = await getTokenPrice(TOKENS.WMAS);
    console.log(`WMAS price: ${formatUSDPrice(wmasPrice)}`);

    // Get WETH.b price
    const wethbPrice = await getTokenPrice(TOKENS.WETHB);
    console.log(`WETH.b price: ${formatUSDPrice(wethbPrice)}`);

    return { wmasPrice, wethbPrice };
  } catch (error) {
    console.error("Failed to get prices:", error);
    throw error;
  }
}

/**
 * Example 4: Calculate vault USD value
 */
export async function exampleCalculateVaultValue() {
  try {
    const balances = {
      wmas: 1000_000_000n, // 1000 WMAS
      wethb: 500_000_000n, // 500 WETH.b
      usdce: 5000_000_000n, // 5000 USDC.e
    };

    const usdValue = await getVaultUSDValue(balances);
    console.log(`Total vault value: ${formatLargeUSDValue(usdValue)}`);

    return usdValue;
  } catch (error) {
    console.error("Failed to calculate vault value:", error);
    throw error;
  }
}

/**
 * Example Component: Price Display
 */
export function PriceDisplayExample() {
  const [wmasPrice, setWmasPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPrice = async () => {
    setLoading(true);
    try {
      const price = await getTokenPrice(TOKENS.WMAS);
      setWmasPrice(price);
    } catch (error) {
      console.error("Failed to fetch price:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>WMAS Price</h3>
      {loading ? (
        <p>Loading...</p>
      ) : wmasPrice ? (
        <p>{formatUSDPrice(wmasPrice)}</p>
      ) : (
        <button onClick={fetchPrice}>Fetch Price</button>
      )}
    </div>
  );
}

/**
 * Example Component: Swap Widget
 */
export function SwapWidgetExample() {
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getQuote = async () => {
    if (!amount) return;

    setLoading(true);
    try {
      const amountIn = BigInt(Number(amount) * 1_000_000); // Convert to 6 decimals
      const result = await getTokenToUSDCQuote(TOKENS.WMAS, amountIn);
      const amountOut = Number(result.amountOut) / 1_000_000;
      setQuote(`≈ ${amountOut.toFixed(2)} USDC.e`);
    } catch (error) {
      console.error("Failed to get quote:", error);
      setQuote("Error fetching quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Swap WMAS to USDC.e</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />
      <button onClick={getQuote} disabled={loading}>
        {loading ? "Loading..." : "Get Quote"}
      </button>
      {quote && <p>You will receive: {quote}</p>}
    </div>
  );
}

/**
 * Usage in a React component with the custom hook:
 *
 * import { usePrices, useVaultUSDValue } from "@/hooks/usePrices";
 *
 * function MyComponent() {
 *   const { prices, loading, refresh } = usePrices();
 *   const { usdValue } = useVaultUSDValue(balances);
 *
 *   return (
 *     <div>
 *       {prices && (
 *         <>
 *           <p>WMAS: {formatUSDPrice(prices.wmas)}</p>
 *           <p>WETH.b: {formatUSDPrice(prices.wethb)}</p>
 *           <p>Total: {formatLargeUSDValue(usdValue || 0)}</p>
 *         </>
 *       )}
 *       <button onClick={refresh}>Refresh Prices</button>
 *     </div>
 *   );
 * }
 */
