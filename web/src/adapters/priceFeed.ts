/**
 * Price Feed Adapter
 * Provides USD price discovery using Dusa DEX quotes
 *
 * NOTE: Currently using fallback price estimates until Dusa DEX mainnet integration is available.
 * Prices are approximate and should not be used for critical financial decisions.
 */

import { getDusaQuote, TOKENS } from "./dex";

// Price cache with TTL
interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const PRICE_CACHE_TTL = 15_000; // 15 seconds

// Standard amount for price quotes (1 token with 6 decimals)
const QUOTE_AMOUNT = 1_000_000n; // 1.0 in 6 decimals

/**
 * Get USD price for a token
 * Uses Dusa DEX quotes against USDC.e as price oracle
 * @param tokenAddress Token contract address
 * @param useCache Whether to use cached prices (default: true)
 * @returns Price in USD (e.g., 1.5 means $1.50)
 */
export async function getTokenPrice(
  tokenAddress: string,
  useCache = true
): Promise<number> {
  // USDC.e is always $1
  if (tokenAddress === TOKENS.USDCE) {
    return 1.0;
  }

  // Check cache
  if (useCache) {
    const cached = priceCache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      return cached.price;
    }
  }

  try {
    // Get quote for 1 token → USDC.e
    const quote = await getDusaQuote(
      tokenAddress,
      TOKENS.USDCE,
      QUOTE_AMOUNT,
      useCache
    );

    // Convert to USD price
    // amountOut is in USDC.e (6 decimals), so divide by 1_000_000
    const price = Number(quote.amountOut) / 1_000_000;

    // Cache the price
    priceCache.set(tokenAddress, { price, timestamp: Date.now() });

    return price;
  } catch (error) {
    console.error(`Failed to get price for ${tokenAddress}:`, error);

    // Fallback: Use approximate mainnet prices when Dusa fails
    // These are rough estimates based on recent market data
    const fallbackPrices: Record<string, number> = {
      [TOKENS.WMAS]: 0.0041, // ~$0.0041 per MAS
      [TOKENS.WETHE]: 3378.0, // ~$3,378 per WETH
      [TOKENS.USDCE]: 1.0, // $1 per USDC.e
    };

    const fallbackPrice = fallbackPrices[tokenAddress];
    if (fallbackPrice) {
      console.warn(
        `Using fallback price for ${tokenAddress}: $${fallbackPrice}`
      );
      // Cache the fallback price
      priceCache.set(tokenAddress, {
        price: fallbackPrice,
        timestamp: Date.now(),
      });
      return fallbackPrice;
    }

    // Return cached price if available, otherwise 0
    const cached = priceCache.get(tokenAddress);
    return cached?.price || 0;
  }
}

/**
 * Get prices for multiple tokens in parallel
 * @param tokenAddresses Array of token addresses
 * @param useCache Whether to use cached prices
 * @returns Map of token address to USD price
 */
export async function getMultipleTokenPrices(
  tokenAddresses: string[],
  useCache = true
): Promise<Map<string, number>> {
  const promises = tokenAddresses.map(async (address) => ({
    address,
    price: await getTokenPrice(address, useCache),
  }));

  const results = await Promise.all(promises);
  const priceMap = new Map<string, number>();

  for (const result of results) {
    priceMap.set(result.address, result.price);
  }

  return priceMap;
}

/**
 * Get WMAS price in USD
 * Convenience function for most common case
 */
export async function getWMASPrice(useCache = true): Promise<number> {
  return getTokenPrice(TOKENS.WMAS, useCache);
}

/**
 * Get WETH.e price in USD
 * Convenience function for common case
 */
export async function getWETHEPrice(useCache = true): Promise<number> {
  return getTokenPrice(TOKENS.WETHE, useCache);
}

/**
 * Calculate USD value of a token amount
 * @param tokenAddress Token contract address
 * @param amount Token amount (in smallest units, e.g., 1_000_000 for 1.0 USDC.e)
 * @param decimals Token decimals (default: 6)
 * @returns USD value
 */
export async function calculateUSDValue(
  tokenAddress: string,
  amount: bigint,
  decimals = 6
): Promise<number> {
  const price = await getTokenPrice(tokenAddress);
  const tokenAmount = Number(amount) / Math.pow(10, decimals);
  return tokenAmount * price;
}

/**
 * Get vault portfolio value in USD
 * Calculates total USD value of all vault holdings
 * @param balances Vault balances { wmas, wethe, usdce }
 * @returns Total USD value
 */
export async function getVaultUSDValue(balances: {
  wmas: bigint;
  wethe: bigint;
  usdce: bigint;
}): Promise<number> {
  try {
    // Get all prices in parallel
    const priceMap = await getMultipleTokenPrices([
      TOKENS.WMAS,
      TOKENS.WETHE,
      TOKENS.USDCE,
    ]);

    // Calculate USD value for each token with correct decimals
    // WMAS: 9 decimals, WETH.e: 18 decimals, USDC.e: 6 decimals
    const wmasValue =
      (Number(balances.wmas) / 1_000_000_000) *
      (priceMap.get(TOKENS.WMAS) || 0);
    const wetheValue =
      (Number(balances.wethe) / 1_000_000_000_000_000_000) *
      (priceMap.get(TOKENS.WETHE) || 0);
    const usdceValue =
      (Number(balances.usdce) / 1_000_000) * (priceMap.get(TOKENS.USDCE) || 1);

    console.log("Vault USD calculation:", {
      wmasBalance: balances.wmas.toString(),
      wetheBalance: balances.wethe.toString(),
      usdceBalance: balances.usdce.toString(),
      wmasValue,
      wetheValue,
      usdceValue,
      total: wmasValue + wetheValue + usdceValue,
    });

    return wmasValue + wetheValue + usdceValue;
  } catch (error) {
    console.error("Failed to calculate vault USD value:", error);
    return 0;
  }
}

/**
 * Format USD price for display
 * @param price USD price
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted price string (e.g., "$1.50")
 */
export function formatUSDPrice(price: number, decimals = 2): string {
  return `$${price.toFixed(decimals)}`;
}

/**
 * Format large USD values with abbreviations
 * @param value USD value
 * @returns Formatted value (e.g., "$1.5K", "$2.3M")
 */
export function formatLargeUSDValue(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return formatUSDPrice(value);
}

/**
 * Clear the price cache
 * Useful for forcing fresh price data
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get all current vault token prices
 * Returns prices for WMAS, WETH.e, and USDC.e
 */
export async function getAllVaultTokenPrices(): Promise<{
  wmas: number;
  wethe: number;
  usdce: number;
}> {
  const priceMap = await getMultipleTokenPrices([
    TOKENS.WMAS,
    TOKENS.WETHE,
    TOKENS.USDCE,
  ]);

  return {
    wmas: priceMap.get(TOKENS.WMAS) || 0,
    wethe: priceMap.get(TOKENS.WETHE) || 0,
    usdce: priceMap.get(TOKENS.USDCE) || 1,
  };
}
