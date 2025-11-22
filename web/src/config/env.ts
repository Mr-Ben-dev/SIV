import { z } from "zod";

// Zod schema for environment validation
const envSchema = z.object({
  // Network Configuration
  VITE_MASSA_NETWORK: z
    .enum(["mainnet", "buildnet", "testnet"])
    .default("mainnet"),

  // RPC Endpoints
  VITE_MASSA_RPC_HTTP: z.string().url("Invalid HTTP RPC endpoint"),
  VITE_MASSA_RPC_WS: z
    .string()
    .url("Invalid WebSocket RPC endpoint")
    .optional(),

  // Contract Addresses (Massa addresses start with AS1)
  VITE_SIV_VAULT_ADDRESS: z
    .string()
    .min(1)
    .default("AS1vq6bHTGjaNCXc8yeHHpf3jtgnBCRJUFsevzYZR54FQJaYSKiS"),
  VITE_USDCE_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYerT"),
  VITE_WMAS_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYfsU"),
  VITE_WETHE_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYgtV"),

  // DEX Addresses
  VITE_DUSA_ROUTER_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYhuW"),
  VITE_DUSA_QUOTER_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYivX"),
  VITE_EAGLEFI_ROUTER_ADDRESS: z
    .string()
    .min(1)
    .default("AS1tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYjwY"),

  // Explorer & UI
  VITE_EXPLORER_URL: z.string().url("Invalid explorer URL"),
  VITE_DEFAULT_SLIPPAGE_BPS: z.coerce.number().min(1).max(10000).default(50),
  VITE_EPOCH_SECONDS: z.coerce.number().positive().default(1800),
  VITE_SLICES_PER_REBALANCE: z.coerce.number().int().positive().default(6),

  // Optional Performance Settings
  VITE_DEFAULT_GAS_LIMIT: z.coerce
    .number()
    .positive()
    .optional()
    .default(1000000000),
  VITE_POLL_INTERVAL_MS: z.coerce.number().positive().optional().default(12000),
});

export type Env = z.infer<typeof envSchema>;

// Parse and validate environment variables
function parseEnv(): { data: Env | null; errors: string[] } {
  const errors: string[] = [];

  try {
    const data = envSchema.parse({
      VITE_MASSA_NETWORK: import.meta.env.VITE_MASSA_NETWORK,
      VITE_MASSA_RPC_HTTP: import.meta.env.VITE_MASSA_RPC_HTTP,
      VITE_MASSA_RPC_WS: import.meta.env.VITE_MASSA_RPC_WS,
      VITE_SIV_VAULT_ADDRESS: import.meta.env.VITE_SIV_VAULT_ADDRESS,
      VITE_USDCE_ADDRESS: import.meta.env.VITE_USDCE_ADDRESS,
      VITE_WMAS_ADDRESS: import.meta.env.VITE_WMAS_ADDRESS,
      VITE_WETHE_ADDRESS: import.meta.env.VITE_WETHE_ADDRESS,
      VITE_DUSA_ROUTER_ADDRESS: import.meta.env.VITE_DUSA_ROUTER_ADDRESS,
      VITE_DUSA_QUOTER_ADDRESS: import.meta.env.VITE_DUSA_QUOTER_ADDRESS,
      VITE_EAGLEFI_ROUTER_ADDRESS: import.meta.env.VITE_EAGLEFI_ROUTER_ADDRESS,
      VITE_EXPLORER_URL: import.meta.env.VITE_EXPLORER_URL,
      VITE_DEFAULT_SLIPPAGE_BPS: import.meta.env.VITE_DEFAULT_SLIPPAGE_BPS,
      VITE_EPOCH_SECONDS: import.meta.env.VITE_EPOCH_SECONDS,
      VITE_SLICES_PER_REBALANCE: import.meta.env.VITE_SLICES_PER_REBALANCE,
      VITE_DEFAULT_GAS_LIMIT: import.meta.env.VITE_DEFAULT_GAS_LIMIT,
      VITE_POLL_INTERVAL_MS: import.meta.env.VITE_POLL_INTERVAL_MS,
    });

    return { data, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        const field = err.path.join(".");
        errors.push(`${field}: ${err.message}`);
      });
    } else {
      errors.push("Unknown configuration error");
    }

    return { data: null, errors };
  }
}

// Global state for environment
let cachedEnv: Env | null = null;
let cachedErrors: string[] = [];

export function getEnv(): Env | null {
  if (cachedEnv) return cachedEnv;

  const result = parseEnv();
  cachedEnv = result.data;
  cachedErrors = result.errors;

  return cachedEnv;
}

export function getEnvErrors(): string[] {
  if (cachedErrors.length === 0 && !cachedEnv) {
    parseEnv();
  }
  return cachedErrors;
}

export function hasEnvErrors(): boolean {
  return getEnvErrors().length > 0;
}

// Export validated env or throw in development
export const env = getEnv();

if (!env && import.meta.env.DEV) {
  console.error("Environment validation errors:", getEnvErrors());
}

// Helper to check if environment is valid
export function isEnvValid(): boolean {
  return env !== null && !hasEnvErrors();
}

// Export individual values for convenience (with fallbacks)
export const config = {
  network: env?.VITE_MASSA_NETWORK ?? "mainnet",
  rpc: {
    http: env?.VITE_MASSA_RPC_HTTP ?? "",
    ws: env?.VITE_MASSA_RPC_WS,
  },
  addresses: {
    sivVault: env?.VITE_SIV_VAULT_ADDRESS ?? "",
    usdce: env?.VITE_USDCE_ADDRESS ?? "",
    wmas: env?.VITE_WMAS_ADDRESS ?? "",
    wethe: env?.VITE_WETHE_ADDRESS ?? "",
    dusaRouter: env?.VITE_DUSA_ROUTER_ADDRESS ?? "",
    dusaQuoter: env?.VITE_DUSA_QUOTER_ADDRESS ?? "",
    eaglefiRouter: env?.VITE_EAGLEFI_ROUTER_ADDRESS ?? "",
  },
  explorer: {
    baseUrl: env?.VITE_EXPLORER_URL ?? "https://explorer.massa.net",
  },
  defaults: {
    slippageBps: env?.VITE_DEFAULT_SLIPPAGE_BPS ?? 50,
    epochSeconds: env?.VITE_EPOCH_SECONDS ?? 1800,
    slicesPerRebalance: env?.VITE_SLICES_PER_REBALANCE ?? 6,
    gasLimit: env?.VITE_DEFAULT_GAS_LIMIT ?? 1000000000,
    pollIntervalMs: env?.VITE_POLL_INTERVAL_MS ?? 12000,
  },
};

// Helper functions for common tasks
export function getExplorerUrl(
  type: "address" | "operation",
  id: string
): string {
  return `${config.explorer.baseUrl}/${type}/${id}`;
}

export function isMainnet(): boolean {
  return config.network === "mainnet";
}
