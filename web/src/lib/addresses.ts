import { config } from "@/config/env";

/**
 * Massa address validation regex
 * Massa addresses are base58 encoded and start with 'AS1'
 * Total length is 51 characters (AS1 + 48 chars)
 */
const MASSA_ADDRESS_REGEX = /^AS1[1-9A-HJ-NP-Za-km-z]{48}$/;

/**
 * Validate if a string is a valid Massa address
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  return MASSA_ADDRESS_REGEX.test(address);
}

/**
 * Shorten address for display (0x1234...5678 format)
 */
export function shortAddr(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (!address) return "";

  if (address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format address for display with optional validation indicator
 */
export function formatAddress(
  address: string,
  options: {
    short?: boolean;
    validate?: boolean;
    startChars?: number;
    endChars?: number;
  } = {}
): string {
  const {
    short = true,
    validate = false,
    startChars = 6,
    endChars = 4,
  } = options;

  if (validate && !isValidAddress(address)) {
    return "Invalid Address";
  }

  return short ? shortAddr(address, startChars, endChars) : address;
}

/**
 * Get all configured contract addresses
 */
export function getContractAddresses() {
  return {
    sivVault: config.addresses.sivVault,
    usdce: config.addresses.usdce,
    wmas: config.addresses.wmas,
    wethe: config.addresses.wethe,
    dusaRouter: config.addresses.dusaRouter,
    dusaQuoter: config.addresses.dusaQuoter,
    eaglefiRouter: config.addresses.eaglefiRouter,
  };
}

/**
 * Validate all configured addresses
 */
export function validateConfiguredAddresses(): Record<string, boolean> {
  const addresses = getContractAddresses();

  return Object.entries(addresses).reduce((acc, [key, address]) => {
    acc[key] = isValidAddress(address);
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Get contract name from address
 */
export function getContractName(address: string): string {
  const addresses = getContractAddresses();

  const entry = Object.entries(addresses).find(([_, addr]) => addr === address);

  if (entry) {
    // Convert camelCase to Title Case
    return entry[0]
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  return "Unknown Contract";
}

/**
 * Compare two addresses (case-insensitive)
 */
export function addressEquals(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;
  return addr1.toLowerCase() === addr2.toLowerCase();
}

/**
 * Get explorer URL for an address
 */
export function getAddressExplorerUrl(address: string): string {
  return `${config.explorer.baseUrl}/address/${address}`;
}

/**
 * Get explorer URL for an operation/transaction
 */
export function getOperationExplorerUrl(operationId: string): string {
  return `${config.explorer.baseUrl}/operation/${operationId}`;
}

/**
 * Copy address to clipboard
 */
export async function copyAddressToClipboard(
  address: string
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(address);
    return true;
  } catch (error) {
    console.error("Failed to copy address:", error);
    return false;
  }
}

/**
 * Token metadata type
 */
export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

/**
 * Get token metadata for configured tokens
 */
export function getTokenMetadata(): Record<string, TokenMetadata> {
  return {
    usdce: {
      address: config.addresses.usdce,
      symbol: "USDC.e",
      name: "USD Coin (Bridged)",
      decimals: 6,
    },
    wmas: {
      address: config.addresses.wmas,
      symbol: "WMAS",
      name: "Wrapped MAS",
      decimals: 9,
    },
    wethe: {
      address: config.addresses.wethe,
      symbol: "WETH.e",
      name: "Wrapped ETH (Ethereum Bridge)",
      decimals: 18,
    },
  };
}

/**
 * Get token info by address
 */
export function getTokenByAddress(address: string): TokenMetadata | undefined {
  const tokens = getTokenMetadata();
  return Object.values(tokens).find((token) =>
    addressEquals(token.address, address)
  );
}

/**
 * Get token info by symbol
 */
export function getTokenBySymbol(symbol: string): TokenMetadata | undefined {
  const tokens = getTokenMetadata();
  return Object.values(tokens).find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxDecimals: number = 6
): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr
    .slice(0, maxDecimals)
    .replace(/0+$/, "");

  if (trimmedFractional === "") {
    return integerPart.toString();
  }

  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Parse token amount from string to bigint with decimals
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [integerPart = "0", fractionalPart = "0"] = amount.split(".");

  const paddedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);
  const fullAmount = integerPart + paddedFractional;

  return BigInt(fullAmount);
}
