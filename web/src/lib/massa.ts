/**
 * Massa blockchain integration - Using @massalabs/wallet-provider
 * Following official Massa documentation for wallet integration
 */

import {
  Args,
  EventPoller,
  JsonRpcProvider,
  JsonRpcPublicProvider,
  Mas,
  SmartContract,
  type CallSCOptions,
  type ReadSCOptions,
} from "@massalabs/massa-web3";
import { getWallets } from "@massalabs/wallet-provider";

// Export types
export type WalletProvider = any;

export interface WalletInfo {
  name: string;
  wallet: any;
}

// Singleton
let availableWallets: any[] = [];
let selectedWallet: any = null;
let currentProvider: any = null;

/**
 * RPC Provider Factory
 * Creates read-only provider for public blockchain queries
 */
export const rpc = {
  public: (): JsonRpcPublicProvider => {
    return JsonRpcProvider.mainnet() as JsonRpcPublicProvider;
  },
};

/**
 * Detect and get available wallets using @massalabs/wallet-provider
 * Returns all available wallets for user selection
 */
export async function detectWalletProvider(): Promise<WalletInfo[]> {
  if (availableWallets.length > 0) {
    return availableWallets.map((w) => ({ name: w.name(), wallet: w }));
  }

  try {
    console.log("Detecting wallets using @massalabs/wallet-provider...");

    // Get list of available wallets
    const wallets = await getWallets();

    console.log(
      `Found ${wallets.length} wallet(s):`,
      wallets.map((w) => w.name())
    );

    if (wallets.length === 0) {
      console.warn(
        "No wallet provider found. Please install Bearby, MassaStation, or MetaMask with Massa Snap."
      );
      return [];
    }

    // Store all available wallets
    availableWallets = wallets;

    return wallets.map((w) => ({ name: w.name(), wallet: w }));
  } catch (error) {
    console.error("Failed to detect wallet:", error);
    return [];
  }
}

/**
 * Select a specific wallet by name
 */
export function selectWallet(walletName: string): boolean {
  const wallet = availableWallets.find((w) => w.name() === walletName);
  if (wallet) {
    selectedWallet = wallet;
    console.log(`Selected wallet: ${walletName}`);
    return true;
  }
  console.error(`Wallet ${walletName} not found`);
  return false;
}

/**
 * Check if any wallet is available
 */
export async function isWalletAvailable(): Promise<boolean> {
  const wallets = await detectWalletProvider();
  return wallets.length > 0;
}

/**
 * Get currently selected wallet
 */
export function getSelectedWallet(): any {
  return selectedWallet;
}

/**
 * Connect wallet - requests permission and returns accounts
 * Must call selectWallet() first to choose which wallet to use
 */
export async function connectWallet(): Promise<string[]> {
  if (!selectedWallet) {
    const wallets = await detectWalletProvider();
    if (wallets.length === 0) {
      throw new Error(
        "No wallet found. Please install Bearby, MassaStation, or MetaMask with Massa Snap."
      );
    }
    throw new Error(
      "No wallet selected. Please call selectWallet() first to choose a wallet."
    );
  }

  const wallet = selectedWallet;

  try {
    console.log("Attempting to connect to wallet...");

    // Connect to the wallet (Bearby requires this, MassaStation might not)
    if (wallet.connect) {
      const connected = await wallet.connect();
      console.log("Wallet connect result:", connected);

      if (!connected) {
        throw new Error("Failed to connect to wallet");
      }
    }

    // Get accounts (returns array of Provider objects)
    console.log("Getting accounts from wallet...");
    const providers = await wallet.accounts();
    console.log("Got providers:", providers);

    // Extract addresses from providers
    const addresses = providers.map((provider: any) => {
      // Provider should have an address() method
      return typeof provider.address === "function"
        ? provider.address()
        : provider.address;
    });

    console.log("Extracted addresses:", addresses);

    if (addresses.length > 0) {
      currentProvider = providers[0];
    }

    return addresses;
  } catch (error) {
    console.error("Connect wallet error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to connect wallet"
    );
  }
}
/**
 * Get current accounts
 */
export async function getAccounts(): Promise<string[]> {
  try {
    return await connectWallet();
  } catch {
    return [];
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (currentWallet && currentWallet.disconnect) {
    await currentWallet.disconnect();
  }
  currentWallet = null;
  currentProvider = null;
}

/**
 * Get node status - placeholder
 */
export async function getNodeStatus() {
  return {
    connected: false,
    nodeVersion: null,
    chainId: null,
    error: "Node status check not yet implemented",
  };
}

/**
 * Read contract - read-only call (no signature required)
 */
export async function readContract<T = Uint8Array>(params: {
  targetAddress: string;
  functionName: string;
  args?: Args;
}): Promise<T> {
  try {
    const { targetAddress, functionName, args = new Args() } = params;

    // Create a public provider (no account needed for read-only calls)
    const provider = JsonRpcProvider.mainnet();

    // Create SmartContract instance
    const contract = new SmartContract(provider, targetAddress);

    // Call read method
    const result = await contract.read(functionName, args);

    return result.value as T;
  } catch (error) {
    console.error("Read contract error:", error);
    throw error;
  }
}

/**
 * Write contract - state-changing call (requires signature)
 */
export async function writeContract(params: {
  targetAddress: string;
  functionName: string;
  args?: Args;
  coins?: bigint;
  fee?: bigint;
}): Promise<string> {
  if (!currentProvider) {
    throw new Error("Wallet not connected. Please connect your wallet first.");
  }

  try {
    const {
      targetAddress,
      functionName,
      args = new Args(),
      coins = 0n,
      fee,
    } = params;

    // Get account to use SmartContract class
    const account = await getAccount();
    if (!account) {
      throw new Error("Failed to get wallet account");
    }

    // Create SmartContract instance with the account
    const contract = new SmartContract(account, targetAddress);

    // Prepare call options
    const options: CallSCOptions = {
      coins: coins,
    };
    if (fee !== undefined) {
      options.fee = fee;
    }

    // Call the contract function
    const operation = await contract.call(functionName, args, options);

    return operation.operationId;
  } catch (error) {
    console.error("Write contract error:", error);
    throw error;
  }
}

/**
 * Wait for operation
 */
export async function waitForOperation(
  operationId: string,
  timeout = 60000
): Promise<boolean> {
  // Placeholder - just wait
  await new Promise((resolve) => setTimeout(resolve, 5000));
  return true;
}

/**
 * Get balance - placeholder
 */
export async function getBalance(address: string): Promise<bigint> {
  const wallet = await detectWalletProvider();

  if (!wallet) return 0n;

  try {
    // Attempt to get balance if wallet supports it
    if (wallet.balance) {
      const balance = await wallet.balance(address);
      return BigInt(balance);
    }
    return 0n;
  } catch {
    return 0n;
  }
}

/**
 * Transfer MAS - placeholder
 */
export async function transferMAS(params: {
  toAddress: string;
  amount: bigint;
}): Promise<string> {
  const wallet = await detectWalletProvider();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  // Placeholder
  throw new Error("Transfer not yet fully implemented");
}

/**
 * Poll events - placeholder
 */
export async function pollEvents(params: {
  address?: string;
  limit?: number;
}): Promise<any[]> {
  // Not implemented yet
  return [];
}

// ============================================================================
// CLEAN READ/WRITE API
// ============================================================================

/**
 * Read-only contract call (no wallet needed)
 * @param contractAddress Contract address
 * @param func Function name
 * @param args Serialized arguments
 * @param options Read options (caller, maxGas, etc.)
 */
export async function readOnly(
  contractAddress: string,
  func: string,
  args: Args | Uint8Array = new Uint8Array(),
  options?: ReadSCOptions
) {
  try {
    const sc = new SmartContract(rpc.public(), contractAddress);
    return await sc.read(func, args, options);
  } catch (error) {
    console.error(`Read error on ${contractAddress}.${func}:`, error);
    throw new Error(
      error instanceof Error ? error.message : "Contract read failed"
    );
  }
}

/**
 * Write contract call (requires connected wallet)
 * @param contractAddress Contract address
 * @param func Function name
 * @param args Serialized arguments
 * @param options Call options (coins, fee, maxGas)
 */
export async function write(
  contractAddress: string,
  func: string,
  args: Args | Uint8Array = new Uint8Array(),
  options: CallSCOptions = {}
) {
  const account = getSelectedWallet();
  if (!account) {
    throw new Error("Connect wallet first");
  }

  try {
    const sc = new SmartContract(account, contractAddress);
    const op = await sc.call(func, args, options);
    return op;
  } catch (error) {
    console.error(`Write error on ${contractAddress}.${func}:`, error);
    throw new Error(
      error instanceof Error ? error.message : "Contract write failed"
    );
  }
}

/**
 * Subscribe to contract events
 * @param filter Event filter (smartContractAddress, isFinal, etc.)
 * @param onData Callback for new events
 * @param onError Callback for errors
 * @param intervalMs Polling interval in milliseconds
 */
export function subscribeEvents(
  filter: { smartContractAddress: string; isFinal?: boolean },
  onData: (events: SCEvent[]) => Promise<void> | void,
  onError: (err: Error) => void,
  intervalMs = 10000
) {
  const { stopPolling } = EventPoller.start(
    rpc.public(),
    {
      smartContractAddress: filter.smartContractAddress,
      isFinal: filter.isFinal ?? true,
    },
    onData,
    onError,
    intervalMs
  );
  return { stop: stopPolling };
}

/**
 * Get current account from wallet
 */
export function getAccount() {
  return currentProvider;
}

// Re-export for convenience
export { Args, Mas };
