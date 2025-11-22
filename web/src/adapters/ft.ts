import { formatTokenAmount, getTokenByAddress } from "@/lib/addresses";
import { readContract, writeContract } from "@/lib/massa";
import { Args } from "@massalabs/massa-web3";

/**
 * Fungible Token (FT) standard adapter for Massa
 * Implements common ERC20-like functions
 */

/**
 * Get token balance for an address
 */
export async function balanceOf(
  tokenAddress: string,
  ownerAddress: string
): Promise<bigint> {
  try {
    const args = new Args().addString(ownerAddress);

    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "balanceOf",
      args,
    });

    // Deserialize the result
    const resultArgs = new Args(result);
    const balance = resultArgs.nextU256();

    return balance || 0n;
  } catch (error) {
    console.error(`Failed to get balance for ${tokenAddress}:`, error);
    throw new Error("Failed to fetch token balance");
  }
}

/**
 * Get formatted balance with decimals
 */
export async function getFormattedBalance(
  tokenAddress: string,
  ownerAddress: string
): Promise<string> {
  const balance = await balanceOf(tokenAddress, ownerAddress);
  const token = getTokenByAddress(tokenAddress);

  if (!token) {
    return balance.toString();
  }

  return formatTokenAmount(balance, token.decimals);
}

/**
 * Get allowance (approved amount for spender)
 */
export async function allowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  try {
    const args = new Args().addString(ownerAddress).addString(spenderAddress);

    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "allowance",
      args,
    });

    // Deserialize the result
    const resultArgs = new Args(result);
    const allowanceAmount = resultArgs.nextU256();

    return allowanceAmount || 0n;
  } catch (error) {
    console.error(`Failed to get allowance for ${tokenAddress}:`, error);
    throw new Error("Failed to fetch token allowance");
  }
}

/**
 * Approve spender to use tokens
 */
export async function approve(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint
): Promise<string> {
  try {
    const args = new Args().addString(spenderAddress).addU256(amount);

    const operationId = await writeContract({
      targetAddress: tokenAddress,
      functionName: "approve",
      args,
      fee: 10000000n, // 0.01 MAS
    });

    return operationId;
  } catch (error) {
    console.error(`Failed to approve ${tokenAddress}:`, error);
    throw new Error("Failed to approve token spending");
  }
}

/**
 * Transfer tokens to another address
 */
export async function transfer(
  tokenAddress: string,
  toAddress: string,
  amount: bigint
): Promise<string> {
  try {
    const args = new Args().addString(toAddress).addU256(amount);

    const operationId = await writeContract({
      targetAddress: tokenAddress,
      functionName: "transfer",
      args,
      fee: 10000000n, // 0.01 MAS
    });

    return operationId;
  } catch (error) {
    console.error(`Failed to transfer ${tokenAddress}:`, error);
    throw new Error("Failed to transfer tokens");
  }
}

/**
 * Transfer tokens from one address to another (requires approval)
 */
export async function transferFrom(
  tokenAddress: string,
  fromAddress: string,
  toAddress: string,
  amount: bigint
): Promise<string> {
  try {
    const args = new Args()
      .addString(fromAddress)
      .addString(toAddress)
      .addU256(amount);

    const operationId = await writeContract({
      targetAddress: tokenAddress,
      functionName: "transferFrom",
      args,
      fee: 10000000n, // 0.01 MAS
    });

    return operationId;
  } catch (error) {
    console.error(`Failed to transferFrom ${tokenAddress}:`, error);
    throw new Error("Failed to transfer tokens");
  }
}

/**
 * Get token name
 */
export async function name(tokenAddress: string): Promise<string> {
  try {
    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "name",
    });

    const resultArgs = new Args(result);
    return resultArgs.nextString() || "Unknown";
  } catch (error) {
    console.error(`Failed to get name for ${tokenAddress}:`, error);
    return "Unknown";
  }
}

/**
 * Get token symbol
 */
export async function symbol(tokenAddress: string): Promise<string> {
  try {
    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "symbol",
    });

    const resultArgs = new Args(result);
    return resultArgs.nextString() || "UNKNOWN";
  } catch (error) {
    console.error(`Failed to get symbol for ${tokenAddress}:`, error);
    return "UNKNOWN";
  }
}

/**
 * Get token decimals
 */
export async function decimals(tokenAddress: string): Promise<number> {
  try {
    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "decimals",
    });

    const resultArgs = new Args(result);
    const dec = resultArgs.nextU8();
    return Number(dec) || 0;
  } catch (error) {
    console.error(`Failed to get decimals for ${tokenAddress}:`, error);
    return 0;
  }
}

/**
 * Get total supply of token
 */
export async function totalSupply(tokenAddress: string): Promise<bigint> {
  try {
    const result = await readContract<Uint8Array>({
      targetAddress: tokenAddress,
      functionName: "totalSupply",
    });

    const resultArgs = new Args(result);
    return resultArgs.nextU256() || 0n;
  } catch (error) {
    console.error(`Failed to get total supply for ${tokenAddress}:`, error);
    return 0n;
  }
}

/**
 * Ensure sufficient allowance and approve if needed
 */
export async function ensureAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: bigint
): Promise<string | null> {
  try {
    const currentAllowance = await allowance(
      tokenAddress,
      ownerAddress,
      spenderAddress
    );

    if (currentAllowance >= requiredAmount) {
      return null; // No approval needed
    }

    // Approve maximum amount to avoid multiple approvals
    const maxAmount = BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const operationId = await approve(tokenAddress, spenderAddress, maxAmount);

    return operationId;
  } catch (error) {
    console.error("Failed to ensure allowance:", error);
    throw new Error("Failed to set token allowance");
  }
}

/**
 * Get multiple token balances at once
 */
export async function getBalances(
  tokenAddresses: string[],
  ownerAddress: string
): Promise<Record<string, bigint>> {
  const balances: Record<string, bigint> = {};

  await Promise.all(
    tokenAddresses.map(async (tokenAddress) => {
      try {
        balances[tokenAddress] = await balanceOf(tokenAddress, ownerAddress);
      } catch (error) {
        console.error(`Failed to get balance for ${tokenAddress}:`, error);
        balances[tokenAddress] = 0n;
      }
    })
  );

  return balances;
}
