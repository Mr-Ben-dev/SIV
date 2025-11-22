/**
 * Dusa DEX Integration
 * Provides quote fetching and swap execution for Dusa V2 Core
 * Uses real Dusa Quoter contract on Massa mainnet
 */

import { config } from "@/config/env";
import { debugLog } from "@/config/features";
import { getAccount, writeContract } from "@/lib/massa";
import { readContract } from "@/lib/massaSimple";
import { Args, ArrayTypes } from "@massalabs/massa-web3";

// Token addresses for convenience
export const TOKENS = {
  WMAS: config.addresses.wmas,
  WETHE: config.addresses.wethe,
  USDCE: config.addresses.usdce,
} as const;

export type TokenSymbol = keyof typeof TOKENS;

// Quote result from Dusa Quoter
export interface DusaQuote {
  amountOut: bigint;
  path: string[];
  fees: bigint;
  priceImpact: number; // in basis points
  route: string; // human-readable route like "WMAS → USDC.e"
}

// Swap parameters
export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient?: string;
  deadline?: number; // Unix timestamp in seconds
}

// Cache for quotes (15 second TTL)
interface QuoteCache {
  quote: DusaQuote;
  timestamp: number;
}

const quoteCache = new Map<string, QuoteCache>();
const QUOTE_CACHE_TTL = 15_000; // 15 seconds

/**
 * Get a quote from Dusa Quoter contract
 * @param tokenIn Input token address
 * @param tokenOut Output token address
 * @param amountIn Amount of input tokens
 * @param useCache Whether to use cached quotes (default: true)
 * @returns Quote with expected output amount and route
 */
export async function getDusaQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  useCache = true
): Promise<DusaQuote> {
  // Check cache first
  const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
  if (useCache) {
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
      return cached.quote;
    }
  }

  try {
    debugLog("Fetching Dusa quote from mainnet:", {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
    });

    // Build token path for Quoter
    const tokenPath = [tokenIn, tokenOut];

    // Serialize arguments for Quoter.findBestPathFromAmountIn
    // According to Dusa docs: function findBestPathFromAmountIn(route: address[], amountIn: u256): Quote
    const args = new Args()
      .addArray(tokenPath, ArrayTypes.STRING)
      .addU256(amountIn);

    // Call Dusa Quoter contract
    const result = await readContract<Uint8Array>({
      targetAddress: config.addresses.dusaQuoter,
      functionName: "findBestPathFromAmountIn",
      args,
    });

    // Parse Quote response
    const resultArgs = new Args(result);

    // Parse route (array of addresses)
    const route: string[] = resultArgs.nextArray(ArrayTypes.STRING);

    // Parse pairs (array of addresses)
    const pairs: string[] = resultArgs.nextArray(ArrayTypes.STRING);

    // Parse binSteps (array of u64)
    const binStepsLength = Number(resultArgs.nextU32());
    const binSteps: bigint[] = [];
    for (let i = 0; i < binStepsLength; i++) {
      binSteps.push(resultArgs.nextU64());
    }

    // Parse amounts (array of u256)
    const amountsLength = Number(resultArgs.nextU32());
    const amounts: bigint[] = [];
    for (let i = 0; i < amountsLength; i++) {
      amounts.push(resultArgs.nextU256());
    }

    // Parse virtualAmountsWithoutSlippage (array of u256) - skip for now
    const virtualLength = Number(resultArgs.nextU32());
    for (let i = 0; i < virtualLength; i++) {
      resultArgs.nextU256(); // Skip
    }

    // Parse fees (array of u256)
    const feesLength = Number(resultArgs.nextU32());
    const fees: bigint[] = [];
    for (let i = 0; i < feesLength; i++) {
      fees.push(resultArgs.nextU256());
    }

    // Extract amountOut (last element in amounts array)
    const amountOut = amounts.length > 0 ? amounts[amounts.length - 1] : 0n;

    // Calculate total fees
    const totalFees = fees.reduce((sum, fee) => sum + fee, 0n);

    // Calculate price impact
    const priceImpact = calculatePriceImpact(amountIn, amountOut, totalFees);

    // Build human-readable route
    const routeString = buildRoute(route);

    const quote: DusaQuote = {
      amountOut,
      path: route,
      fees: totalFees,
      priceImpact,
      route: routeString,
    };

    // Cache the quote
    quoteCache.set(cacheKey, { quote, timestamp: Date.now() });

    debugLog("Dusa quote received:", {
      amountOut: amountOut.toString(),
      route: routeString,
      fees: totalFees.toString(),
    });

    return quote;
  } catch (error) {
    console.error("Failed to get Dusa quote:", error);
    // DO NOT use fallback prices - throw error so UI shows the problem
    throw new Error(
      `Failed to fetch quote from Dusa DEX: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Execute a swap on Dusa Router
 * @param params Swap parameters
 * @returns Operation ID
 */
export async function executeDusaSwap(params: SwapParams): Promise<string> {
  try {
    const account = await getAccount();
    if (!account) {
      throw new Error("Wallet not connected");
    }

    // Get the user's address from account
    const userAddress = params.recipient || account.address();

    // Default deadline: 20 minutes from now
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;

    // Dusa Router expects: swapExactTokensForTokens(
    //   amountIn: u256,
    //   amountOutMin: u256,
    //   path: [tokenIn, tokenOut],
    //   to: string,
    //   deadline: u64
    // )
    const args = new Args()
      .addU256(params.amountIn)
      .addU256(params.minAmountOut)
      .addU32(2n) // path length
      .addString(params.tokenIn)
      .addString(params.tokenOut)
      .addString(userAddress)
      .addU64(BigInt(deadline));

    const opId = await writeContract({
      targetAddress: config.addresses.dusaRouter,
      functionName: "swapExactTokensForTokens",
      args,
    });

    return opId;
  } catch (error) {
    console.error("Failed to execute Dusa swap:", error);
    throw new Error("Swap execution failed");
  }
}

/**
 * Get quote for swapping any token to USDC.e
 * Convenience function for common use case
 */
export async function getTokenToUSDCQuote(
  tokenAddress: string,
  amount: bigint
): Promise<DusaQuote> {
  return getDusaQuote(tokenAddress, TOKENS.USDCE, amount);
}

/**
 * Get quote for swapping USDC.e to any token
 * Convenience function for common use case
 */
export async function getUSDCToTokenQuote(
  tokenAddress: string,
  usdcAmount: bigint
): Promise<DusaQuote> {
  return getDusaQuote(TOKENS.USDCE, tokenAddress, usdcAmount);
}

/**
 * Calculate price impact in basis points
 * Simplified calculation: (fees / amountIn) * 10000
 */
function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  fees: bigint
): number {
  if (amountIn === 0n) return 0;

  // Price impact = (fees / amountIn) * 10000 for basis points
  const impact = Number((fees * 10000n) / amountIn);
  return Math.min(impact, 10000); // Cap at 100%
}

/**
 * Build human-readable route from path
 */
function buildRoute(path: string[]): string {
  if (path.length === 0) return "Direct";
  if (path.length === 2) {
    return `${getTokenSymbol(path[0])} → ${getTokenSymbol(path[1])}`;
  }
  return path.map(getTokenSymbol).join(" → ");
}

/**
 * Get token symbol from address
 */
function getTokenSymbol(address: string): string {
  switch (address) {
    case TOKENS.WMAS:
      return "WMAS";
    case TOKENS.WETHE:
      return "WETH.e";
    case TOKENS.USDCE:
      return "USDC.e";
    default:
      return address.slice(0, 6);
  }
}

/**
 * Clear the quote cache
 * Useful for forcing fresh quotes
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}

/**
 * Get multiple quotes in parallel
 * Useful for displaying multiple swap options
 */
export async function getMultipleQuotes(
  requests: Array<{ tokenIn: string; tokenOut: string; amountIn: bigint }>
): Promise<DusaQuote[]> {
  const promises = requests.map((req) =>
    getDusaQuote(req.tokenIn, req.tokenOut, req.amountIn)
  );
  return Promise.all(promises);
}
