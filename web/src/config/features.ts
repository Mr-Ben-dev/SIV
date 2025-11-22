/**
 * Feature Flags for SIV dApp
 * Toggle features on/off for testing and gradual rollout
 */

export const FEATURE_FLAGS = {
  // DEX Integration
  USE_REAL_DUSA_QUOTES: false, // Set to true when Dusa DEX is available on mainnet

  // Price Feed
  USE_LIVE_PRICES: false, // Set to true to fetch real prices from DEX
  FALLBACK_PRICES_ENABLED: true, // Show estimated prices when real prices unavailable

  // Auto-refresh intervals (milliseconds)
  PRICE_REFRESH_INTERVAL: 30_000, // 30 seconds
  VAULT_REFRESH_INTERVAL: 12_000, // 12 seconds
  EVENT_POLL_INTERVAL: 5_000, // 5 seconds

  // Cache TTL
  QUOTE_CACHE_TTL: 15_000, // 15 seconds
  PRICE_CACHE_TTL: 15_000, // 15 seconds

  // UI Features
  SHOW_USD_VALUES: true, // Display USD equivalents
  SHOW_PRICE_CHARTS: false, // Historical price charts (future feature)
  ENABLE_ADVANCED_TRADING: false, // Advanced swap UI (future feature)

  // Debug
  DEBUG_MODE: false, // Enable console logging
  MOCK_TRANSACTIONS: false, // Simulate tx without sending to blockchain
} as const;

// Fallback price estimates (used when USE_REAL_DUSA_QUOTES = false)
export const FALLBACK_PRICES = {
  WMAS: 0.1, // $0.10 per WMAS
  WETHE: 2500.0, // $2500 per WETH.e
  USDCE: 1.0, // $1.00 per USDC.e (stablecoin)
} as const;

// DEX Configuration
export const DEX_CONFIG = {
  // Slippage tolerance in basis points (100 = 1%)
  DEFAULT_SLIPPAGE_BPS: 50, // 0.5%
  MAX_SLIPPAGE_BPS: 500, // 5%

  // Price impact warnings
  WARN_PRICE_IMPACT_BPS: 100, // Warn at 1% impact
  BLOCK_PRICE_IMPACT_BPS: 500, // Block at 5% impact

  // Swap deadlines
  DEFAULT_DEADLINE_SECONDS: 1200, // 20 minutes
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature] as boolean;
}

/**
 * Get fallback price for a token
 */
export function getFallbackPrice(token: "WMAS" | "WETHE" | "USDCE"): number {
  return FALLBACK_PRICES[token];
}

/**
 * Development mode check
 */
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

/**
 * Log debug messages only when debug mode is on
 */
export function debugLog(...args: any[]) {
  if (FEATURE_FLAGS.DEBUG_MODE || isDevelopment) {
    console.log("[SIV Debug]", ...args);
  }
}

/**
 * Instructions for enabling Dusa DEX integration
 *
 * When Dusa DEX becomes available on Massa mainnet:
 *
 * 1. Verify contract addresses in .env.local:
 *    - VITE_DUSA_ROUTER_ADDRESS
 *    - VITE_DUSA_QUOTER_ADDRESS
 *
 * 2. Test Dusa Quoter API:
 *    - Call getQuote(tokenIn, tokenOut, amountIn)
 *    - Verify response format
 *    - Check path array structure
 *
 * 3. Update dex.ts getDusaQuote():
 *    - Replace fallback logic with readContract call
 *    - Parse response according to actual API
 *    - Handle errors gracefully
 *
 * 4. Enable feature flags:
 *    - Set USE_REAL_DUSA_QUOTES = true
 *    - Set USE_LIVE_PRICES = true
 *
 * 5. Test thoroughly:
 *    - Verify price accuracy
 *    - Test swap execution
 *    - Check error handling
 *    - Monitor gas costs
 *
 * 6. Gradually rollout:
 *    - Start with USE_REAL_DUSA_QUOTES = true, FALLBACK_PRICES_ENABLED = true
 *    - Monitor for errors
 *    - After stable period, set FALLBACK_PRICES_ENABLED = false
 */
