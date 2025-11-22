# DEX and Price Feed Adapters

This directory contains adapters for integrating with Dusa DEX and fetching token prices on Massa blockchain.

## Files

- **`dex.ts`** - Dusa DEX integration for swap quotes and execution
- **`priceFeed.ts`** - Token price discovery using Dusa as price oracle

## Features

### DEX Adapter (`dex.ts`)

#### Quote Fetching

- Get swap quotes from Dusa V2 Core
- Automatic 15-second quote caching
- Price impact calculation
- Human-readable route display

#### Swap Execution

- Execute token swaps via Dusa Router
- Configurable slippage tolerance
- Deadline management
- Multi-hop routing support

#### Usage Example

```typescript
import { getDusaQuote, executeDusaSwap, TOKENS } from "@/adapters/dex";

// Get a quote
const quote = await getDusaQuote(
  TOKENS.WMAS,
  TOKENS.USDCE,
  100_000_000n // 100 WMAS
);

console.log(`Expected output: ${quote.amountOut}`);
console.log(`Route: ${quote.route}`);
console.log(`Price impact: ${quote.priceImpact / 100}%`);

// Execute swap with 1% slippage tolerance
const minOut = (quote.amountOut * 99n) / 100n;
const opId = await executeDusaSwap({
  tokenIn: TOKENS.WMAS,
  tokenOut: TOKENS.USDCE,
  amountIn: 100_000_000n,
  minAmountOut: minOut,
});
```

### Price Feed Adapter (`priceFeed.ts`)

#### Price Discovery

- Fetch USD prices for any token
- Uses Dusa DEX quotes against USDC.e
- Automatic 15-second price caching
- Fallback to cached prices on errors

#### Value Calculation

- Calculate USD value of token amounts
- Get total vault portfolio value
- Format prices for display

#### Usage Example

```typescript
import {
  getTokenPrice,
  getVaultUSDValue,
  formatUSDPrice,
  formatLargeUSDValue,
} from "@/adapters/priceFeed";

// Get WMAS price
const price = await getTokenPrice(TOKENS.WMAS);
console.log(`WMAS: ${formatUSDPrice(price)}`); // "$1.50"

// Calculate vault value
const balances = {
  wmas: 1000_000_000n,
  wethb: 500_000_000n,
  usdce: 5000_000_000n,
};

const totalValue = await getVaultUSDValue(balances);
console.log(`Total: ${formatLargeUSDValue(totalValue)}`); // "$1.5M"
```

## React Hooks

### `usePrices()`

Auto-refreshing token prices with 30-second intervals.

```typescript
import { usePrices } from "@/hooks/usePrices";

function MyComponent() {
  const { prices, loading, error, refresh } = usePrices();

  if (loading) return <p>Loading prices...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <p>WMAS: ${prices.wmas.toFixed(2)}</p>
      <p>WETH.b: ${prices.wethb.toFixed(2)}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### `useVaultUSDValue(balances)`

Calculate USD value of vault holdings.

```typescript
import { useVaultUSDValue } from "@/hooks/usePrices";
import { formatLargeUSDValue } from "@/adapters/priceFeed";

function VaultValue({ balances }) {
  const { usdValue, loading } = useVaultUSDValue(balances);

  return (
    <div>
      {loading ? (
        <p>Calculating...</p>
      ) : (
        <p>Total Value: {formatLargeUSDValue(usdValue || 0)}</p>
      )}
    </div>
  );
}
```

## Architecture

### Caching Strategy

Both adapters implement intelligent caching:

- **TTL**: 15 seconds for quotes and prices
- **Automatic**: Background cache updates every 30s (via hooks)
- **Manual**: `clearQuoteCache()` and `clearPriceCache()` available

### Error Handling

- Graceful degradation to cached values
- Console warnings for debugging
- User-friendly error messages

### Integration Points

```
┌─────────────────┐
│   Portfolio UI  │
└────────┬────────┘
         │
         ├──> usePrices() ──────> priceFeed.ts ──┐
         │                                        │
         └──> useVaultUSDValue() ────────────────┤
                                                  │
                                                  v
                                        ┌─────────────────┐
                                        │   dex.ts        │
                                        │ (Dusa Quoter)   │
                                        └─────────────────┘
                                                  │
                                                  v
                                        ┌─────────────────┐
                                        │ Massa Blockchain│
                                        │  (Dusa DEX)     │
                                        └─────────────────┘
```

## Token Addresses

All mainnet token addresses are configured in `.env.local`:

- **WMAS**: `AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9`
- **WETH.b**: `AS125oPLYRTtfVjpWisPZVTLjBhCFfQ1jDsi75XNtRm1NZux54eCj`
- **USDC.e**: `AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ`
- **Dusa Router**: `AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p`
- **Dusa Quoter**: `AS1d3DvZeqTo3Uq7mfAAUmNggjFXqEfGGpSUv6uTYvikVVW8EybN`

## Best Practices

1. **Always check quotes before swapping**

   ```typescript
   const quote = await getDusaQuote(tokenIn, tokenOut, amount);
   const minOut = (quote.amountOut * (10000n - slippageBps)) / 10000n;
   ```

2. **Use caching for repeated calls**

   ```typescript
   // Use cached price (fast)
   const price = await getTokenPrice(token, true);

   // Force fresh price (slower, more accurate)
   const freshPrice = await getTokenPrice(token, false);
   ```

3. **Handle errors gracefully**

   ```typescript
   try {
     const quote = await getDusaQuote(...);
   } catch (error) {
     // Show user-friendly message
     toast.error("Unable to fetch quote. Please try again.");
   }
   ```

4. **Monitor price impact**
   ```typescript
   if (quote.priceImpact > 500) {
     // > 5%
     toast.warning("High price impact detected!");
   }
   ```

## Testing

See `examples/dexUsage.tsx` for complete usage examples and test components.

## Performance

- Quote fetching: ~200-500ms (first call)
- Cached quotes: <1ms
- Price calculations: <50ms
- Parallel quotes: Use `getMultipleQuotes()` for efficiency

## Future Enhancements

- [ ] Multi-hop routing optimization
- [ ] Historical price data
- [ ] Price alerts
- [ ] Advanced slippage strategies
- [ ] Gas estimation for swaps
