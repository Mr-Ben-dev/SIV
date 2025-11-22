/**
 * Simplified Massa integration - uses wallet provider directly
 */
import {
  Args,
  JsonRpcProvider,
  SmartContract,
  U256,
} from "@massalabs/massa-web3";

// Export types
export { Args };

/**
 * Get account from wallet - must be called after connecting
 */
export async function getAccount() {
  const savedWallet = localStorage.getItem("siv-wallet");
  if (!savedWallet) {
    throw new Error("No wallet connected");
  }

  const { getWallets } = await import("@massalabs/wallet-provider");
  const wallets = await getWallets();
  const wallet = wallets.find((w) => w.name() === savedWallet);

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const accounts = await wallet.accounts();
  if (accounts.length === 0) {
    throw new Error("No accounts found");
  }

  return accounts[0];
}

/**
 * Read contract - read-only call
 */
export async function readContract<T = Uint8Array>(params: {
  targetAddress: string;
  functionName: string;
  args?: Args;
}): Promise<T> {
  const { targetAddress, functionName, args = new Args() } = params;

  const provider = JsonRpcProvider.mainnet();
  const contract = new SmartContract(provider, targetAddress);

  const result = await contract.read(functionName, args);
  return result.value as T;
}

/**
 * Get address balance in nanoMAS using massa-web3 SDK
 */
export async function getAddressBalance(address: string): Promise<bigint> {
  try {
    const provider = JsonRpcProvider.mainnet();

    // Use the proper massa-web3 SDK method
    const balances = await provider.balanceOf([address], true);

    if (!balances || balances.length === 0) {
      console.warn("No balance data returned for address:", address);
      return 0n;
    }

    const balance = balances[0].balance;
    console.log("MAS balance (nanoMAS):", balance.toString());
    return balance;
  } catch (error) {
    console.error("Error fetching address balance:", error);
    return 0n;
  }
}

/**
 * Write contract - state-changing call
 */
export async function writeContract(params: {
  targetAddress: string;
  functionName: string;
  args?: Args;
  coins?: bigint;
  maxGas?: bigint;
}): Promise<string> {
  const {
    targetAddress,
    functionName,
    args = new Args(),
    coins = 0n,
    maxGas,
  } = params;

  const account = await getAccount();
  const contract = new SmartContract(account, targetAddress);

  const callOptions: any = { coins };
  if (maxGas) {
    callOptions.maxGas = maxGas;
  }

  const operation = await contract.call(functionName, args, callOptions);
  return operation.id;
}

/**
 * Get MRC20 token balance for an address
 * Calls the balanceOf function on the token contract using SmartContract.read()
 */
export async function getTokenBalance(
  tokenAddress: string,
  holderAddress: string
): Promise<bigint> {
  try {
    const provider = JsonRpcProvider.mainnet();
    const tokenContract = new SmartContract(provider, tokenAddress);

    // Call balanceOf function using Args
    const args = new Args().addString(holderAddress);
    const result = await tokenContract.read("balanceOf", args);

    // Parse U256 from return value
    return U256.fromBytes(result.value);
  } catch (error) {
    console.error(`Error reading token balance for ${holderAddress}:`, error);
    return 0n;
  }
}
/**
 * Wait for operation to be final
 * Note: This is a simple delay-based wait
 * In production, you should poll the blockchain or use event listeners
 */
export async function waitForOperation(operationId: string): Promise<void> {
  // Simple delay to allow operation to propagate
  // The operation is already sent to the blockchain
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
