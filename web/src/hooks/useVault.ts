import { config } from "@/config/env";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  Args,
  getAccount,
  getAddressBalance,
  readContract,
  waitForOperation,
  writeContract,
} from "@/lib/massaSimple";
import { useEventsStore } from "@/store/eventsStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCallback } from "react";

/**
 * Hook for interacting with the SIV vault contract
 */
export function useVault() {
  const { toast } = useToast();
  const { address } = useWallet();
  const { addEvent } = useEventsStore();
  const {
    config: vaultConfig,
    balances,
    loading,
    error,
    setConfig,
    setBalances,
    setLoading,
    setError,
  } = useVaultStore();

  /**
   * Refresh vault configuration from contract
   */
  const refreshConfig = useCallback(async () => {
    // Skip if wallet not connected
    if (!address) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Read vault config from contract
      const configData = await readContract<Uint8Array>({
        targetAddress: config.addresses.sivVault,
        functionName: "getConfig",
      });

      // Parse config data from contract response
      // Contract returns: name, symbol, owner, target0, target1, target2, maxDriftBps, rebalanceEpochSeconds, minDepositUSDC, minSliceValue
      const args = new Args(configData);
      const name = args.nextString(); // Vault name
      const symbol = args.nextString(); // Vault symbol
      const owner = args.nextString(); // Owner address
      const target0 = Number(args.nextU64());
      const target1 = Number(args.nextU64());
      const target2 = Number(args.nextU64());
      const maxDriftBps = Number(args.nextU64());
      const rebalanceEpochSeconds = Number(args.nextU64());
      const minDepositUSDC = Number(args.nextU64());
      const minSliceValue = Number(args.nextU64());

      // Read guard status separately
      const guardData = await readContract<Uint8Array>({
        targetAddress: config.addresses.sivVault,
        functionName: "getGuardStatus",
      });
      const guardArgs = new Args(guardData);
      const guardArmed = guardArgs.nextBool();

      setConfig({
        owner,
        targetsBps: [target0, target1, target2],
        driftBps: maxDriftBps,
        epochSeconds: rebalanceEpochSeconds,
        slicesPerRebalance: 6, // Fixed value from vault design
        guardArmed,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to fetch vault config";
      setError(error);
      console.error("Refresh config error:", err);
    } finally {
      setLoading(false);
    }
  }, [address, setConfig, setLoading, setError]);

  /**
   * Refresh vault balances from contract
   */
  const refreshBalances = useCallback(async () => {
    // Skip if wallet not connected
    if (!address) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Read balances from contract
      const balancesData = await readContract<Uint8Array>({
        targetAddress: config.addresses.sivVault,
        functionName: "getBalances",
      });

      // Parse balances data from contract response
      // Contract returns: totalValueUSDC, wmasBalance, wetheBalance, usdceBalance, totalShares
      const args = new Args(balancesData);
      const totalValueUSDC = args.nextU64();
      const wmasBalance = args.nextU64();
      const wetheBalance = args.nextU64();
      const usdceBalance = args.nextU64();
      const totalShares = args.nextU64();

      // Fetch gas bank balance (contract's MAS balance)
      const gasBankBalance = await getAddressBalance(config.addresses.sivVault);

      console.log("Vault balances:", {
        wmas: wmasBalance.toString(),
        wethe: wetheBalance.toString(),
        usdce: usdceBalance.toString(),
        totalShares: totalShares.toString(),
      });

      setBalances({
        wmas: BigInt(wmasBalance),
        wethe: BigInt(wetheBalance),
        usdce: BigInt(usdceBalance),
        total: BigInt(totalValueUSDC),
        totalShares: BigInt(totalShares),
        gasBank: gasBankBalance,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to fetch vault balances";
      setError(error);
      console.error("Refresh balances error:", err);
    } finally {
      setLoading(false);
    }
  }, [address, setBalances, setLoading, setError]);

  /**
   * Refresh both config and balances
   */
  const refresh = useCallback(async () => {
    await Promise.all([refreshConfig(), refreshBalances()]);
  }, [refreshConfig, refreshBalances]);

  /**
   * Get user's vault shares
   */
  const getUserShares = useCallback(
    async (userAddress?: string): Promise<bigint> => {
      try {
        const targetAddress = userAddress || address;
        if (!targetAddress) {
          return 0n;
        }

        const args = new Args().addString(targetAddress);
        const result = await readContract<Uint8Array>({
          targetAddress: config.addresses.sivVault,
          functionName: "getUserShares",
          args,
        });

        // Contract returns string bytes
        const sharesStr = new TextDecoder().decode(result);
        return BigInt(sharesStr || "0");
      } catch (err) {
        console.error("Failed to get user shares:", err);
        return 0n;
      }
    },
    [address]
  );

  /**
   * Deposit USDC.e into the vault
   */
  const depositUSDC = useCallback(
    async (amount: bigint) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      try {
        setLoading(true);
        setError(null);

        const account = await getAccount();
        if (!account) {
          throw new Error("Failed to get wallet account");
        }

        // Check current allowance using readContract
        const allowanceArgs = new Args()
          .addString(address)
          .addString(config.addresses.sivVault);

        const allowanceResult = await readContract<Uint8Array>({
          targetAddress: config.addresses.usdce,
          functionName: "allowance",
          args: allowanceArgs,
        });

        const allowanceResponseArgs = new Args(allowanceResult);
        const currentAllowance = allowanceResponseArgs.nextU256();

        // If allowance is insufficient, increase it
        if (currentAllowance < amount) {
          toast({
            title: "Approval Required",
            description: "Please approve USDC.e spending in your wallet",
          });

          const increaseAmount = amount - currentAllowance;

          // Use increaseAllowance (Massa FT standard)
          const approveArgs = new Args()
            .addString(config.addresses.sivVault)
            .addU256(increaseAmount);

          const approveOpId = await writeContract({
            targetAddress: config.addresses.usdce,
            functionName: "increaseAllowance",
            args: approveArgs,
          });

          toast({
            title: "Approval Pending",
            description: "Waiting for approval transaction...",
          });

          await waitForOperation(approveOpId);

          toast({
            title: "Approved",
            description: "USDC.e spending approved successfully",
          });

          // Wait a bit for the approval to propagate
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Then deposit - contract expects u64
        toast({
          title: "Deposit",
          description: "Please confirm deposit in your wallet",
        });

        const depositArgs = new Args().addU64(amount);

        let depositOpId: string | undefined;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            depositOpId = await writeContract({
              targetAddress: config.addresses.sivVault,
              functionName: "deposit",
              args: depositArgs,
              maxGas: BigInt(1_000_000_000), // 1B gas for deposit with reentrancy guard
            });
            break; // Success, exit retry loop
          } catch (err) {
            retries++;
            if (retries >= maxRetries) {
              throw err; // Give up after max retries
            }
            // Wait before retry (exponential backoff: 2s, 4s, 8s)
            const delay = Math.pow(2, retries) * 1000;
            toast({
              title: "Retrying...",
              description: `Network error, retrying in ${
                delay / 1000
              }s (${retries}/${maxRetries})`,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!depositOpId) {
          throw new Error("Failed to submit deposit transaction");
        }

        toast({
          title: "Deposit Pending",
          description: "Waiting for deposit transaction...",
        });

        await waitForOperation(depositOpId);

        // Format amount for display (USDC.e has 6 decimals)
        const formattedAmount = (Number(amount) / 1_000_000).toFixed(6);

        // Add deposit event to activity feed
        addEvent({
          id: depositOpId,
          type: "Deposit",
          timestamp: Date.now(),
          data: {
            user: address!,
            amount: amount,
            shares: 0n, // We don't know shares yet, will be updated on refresh
          },
          txHash: depositOpId,
        });

        toast({
          title: "Deposit Successful",
          description: `Deposited ${formattedAmount} USDC.e`,
        });

        // Refresh balances
        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Deposit failed";
        setError(error);
        toast({
          title: "Deposit Failed",
          description: error,
          variant: "destructive",
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, refresh, setLoading, setError, toast]
  );

  /**
   * Redeem shares from the vault
   */
  const redeemShares = useCallback(
    async (shares: bigint, toUSDC = true) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      try {
        setLoading(true);
        setError(null);

        toast({
          title: "Redeem",
          description: "Please confirm redemption in your wallet",
        });

        // Contract expects: redeem(shares: u64, toUSDC: bool)
        // Ensure shares is within u64 range
        if (shares > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("Shares value too large for u64");
        }
        const args = new Args().addU64(shares).addBool(toUSDC);

        const opId = await writeContract({
          targetAddress: config.addresses.sivVault,
          functionName: "redeem",
          args,
        });

        toast({
          title: "Redemption Pending",
          description: "Waiting for redemption transaction...",
        });

        await waitForOperation(opId);

        // Format shares for display (6 decimals like USDC.e)
        const formattedShares = (Number(shares) / 1_000_000).toFixed(6);

        // Add withdraw event to activity feed
        addEvent({
          id: opId,
          type: "Withdraw",
          timestamp: Date.now(),
          data: {
            user: address!,
            shares: shares,
            amount: 0n, // We don't know exact amount yet
            toUSDC: toUSDC,
          },
          txHash: opId,
        });

        toast({
          title: "Redemption Successful",
          description: `Redeemed ${formattedShares} shares`,
        });

        // Refresh balances
        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Redemption failed";
        setError(error);
        toast({
          title: "Redemption Failed",
          description: error,
          variant: "destructive",
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, refresh, setLoading, setError, toast]
  );

  /**
   * Toggle guard (emergency mode)
   */
  const setGuard = useCallback(
    async (armed: boolean) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      try {
        setLoading(true);
        setError(null);

        toast({
          title: "Guard Toggle",
          description: `Please confirm ${
            armed ? "arming" : "disarming"
          } guard in your wallet`,
        });

        const args = new Args().addBool(armed);

        const opId = await writeContract({
          targetAddress: config.addresses.sivVault,
          functionName: "setGuard",
          args,
        });

        toast({
          title: "Guard Toggle Pending",
          description: "Waiting for transaction...",
        });

        await waitForOperation(opId);

        // Add guard event to activity feed
        addEvent({
          id: opId,
          type: "GuardArmed",
          timestamp: Date.now(),
          data: {
            armed: armed,
            reason: "Manual trigger",
          },
          txHash: opId,
        });

        toast({
          title: "Guard Updated",
          description: `Guard is now ${armed ? "armed" : "disarmed"}`,
        });

        // Refresh config
        await refreshConfig();
      } catch (err) {
        const error =
          err instanceof Error ? err.message : "Guard toggle failed";
        setError(error);
        toast({
          title: "Guard Toggle Failed",
          description: error,
          variant: "destructive",
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, refreshConfig, setLoading, setError, toast]
  );

  /**
   * Top up gas bank for autonomous operations
   */
  const topUpGasBank = useCallback(
    async (amount: bigint) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      try {
        setLoading(true);
        setError(null);

        toast({
          title: "Gas Top-up",
          description: "Please confirm gas bank top-up in your wallet",
        });

        // Contract expects: topUpGasBank(_: StaticArray<u8>) with coins
        const args = new Args(); // Empty args

        const opId = await writeContract({
          targetAddress: config.addresses.sivVault,
          functionName: "topUpGasBank",
          args,
          coins: amount, // Send MAS with the transaction
        });

        toast({
          title: "Top-up Pending",
          description: "Waiting for transaction...",
        });

        await waitForOperation(opId);

        // Format amount for display (MAS has 9 decimals)
        const formattedAmount = (Number(amount) / 1_000_000_000).toFixed(2);

        // Add gas bank event to activity feed
        addEvent({
          id: opId,
          type: "GasBankUpdated",
          timestamp: Date.now(),
          data: {
            amount: amount,
            newBalance: 0n, // Will be updated on refresh
          },
          txHash: opId,
        });

        toast({
          title: "Top-up Successful",
          description: `Added ${formattedAmount} MAS to gas bank`,
        });

        // Refresh balances
        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Gas top-up failed";
        setError(error);
        toast({
          title: "Top-up Failed",
          description: error,
          variant: "destructive",
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, refresh, setLoading, setError, toast]
  );

  /**
   * Start autonomous rebalancing cycle
   */
  const startAutonomousRebalancing = useCallback(async () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    try {
      setLoading(true);
      setError(null);

      toast({
        title: "Starting Autonomous Rebalancing",
        description: "Please confirm the transaction in your wallet",
      });

      const args = new Args();

      const opId = await writeContract({
        targetAddress: config.addresses.sivVault,
        functionName: "startAutonomousRebalancing",
        args,
      });

      toast({
        title: "Transaction Pending",
        description: "Initializing autonomous rebalancing...",
      });

      await waitForOperation(opId);

      toast({
        title: "Autonomous Rebalancing Started!",
        description:
          "The vault will now rebalance automatically every 30 minutes",
      });

      // Refresh config
      await refreshConfig();
    } catch (err) {
      const error =
        err instanceof Error
          ? err.message
          : "Failed to start autonomous rebalancing";
      setError(error);
      toast({
        title: "Failed to Start",
        description: error,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refreshConfig, setLoading, setError, toast]);

  /**
   * Check if autonomous rebalancing is scheduled
   */
  const isAutonomousScheduled = useCallback(async (): Promise<boolean> => {
    try {
      const result = await readContract<Uint8Array>({
        targetAddress: config.addresses.sivVault,
        functionName: "isAutonomousScheduled",
      });

      const args = new Args(result);
      return args.nextBool();
    } catch (error) {
      console.error("Failed to check scheduled state:", error);
      return false;
    }
  }, []);

  /**
   * Manually trigger a rebalance execution
   */
  const triggerRebalance = useCallback(async () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);

    try {
      toast({
        title: "Triggering Rebalance",
        description: "Please confirm the transaction in your wallet",
      });

      const args = new Args();

      // Retry logic for network failures
      let opId: string | undefined;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          opId = await writeContract({
            targetAddress: config.addresses.sivVault,
            functionName: "triggerRebalance",
            args,
            maxGas: BigInt(4_000_000_000), // 4B gas (below max limit of ~4.29B)
          });
          break; // Success, exit retry loop
        } catch (err: any) {
          retries++;
          if (retries >= maxRetries) {
            throw err; // Give up after max retries
          }
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
          toast({
            title: "Retrying...",
            description: `Network error, retrying in ${
              delay / 1000
            }s (${retries}/${maxRetries})`,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!opId) {
        throw new Error("Failed to submit rebalance transaction");
      }

      toast({
        title: "Transaction Pending",
        description: "Executing rebalance...",
      });

      await waitForOperation(opId);

      toast({
        title: "Rebalance Triggered",
        description: "Check the event log for swap details",
      });

      // Refresh to get updated state
      await refreshConfig();
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to trigger rebalance";
      setError(error);
      toast({
        title: "Failed to Trigger Rebalance",
        description: error,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refreshConfig, setLoading, setError, toast]);

  /**
   * Redeem shares and convert all tokens to USDC
   */
  const redeemToUSDC = useCallback(
    async (shares: bigint): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      try {
        setLoading(true);
        setError(null);

        toast({
          title: "Exit to USDC",
          description: "Please confirm redemption in your wallet",
        });

        // Ensure shares is within u64 range
        if (shares > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("Shares value too large for u64");
        }
        const args = new Args().addU64(shares).addBool(true); // toUSDC = true

        const operationId = await writeContract({
          targetAddress: config.addresses.sivVault,
          functionName: "redeem",
          args,
        });

        toast({
          title: "Redemption Pending",
          description: "Converting tokens to USDC...",
        });

        await waitForOperation(operationId);

        addEvent({
          id: operationId,
          type: "RedeemToUSDC",
          timestamp: Date.now(),
          data: {
            user: address,
            shares: shares,
            toUSDC: true,
          },
          txHash: operationId,
        });

        toast({
          title: "Exit Complete",
          description: "Successfully converted to USDC",
        });

        // Refresh balances
        await refresh();

        return operationId;
      } catch (err) {
        const error = err instanceof Error ? err.message : "Redemption failed";
        setError(error);
        toast({
          title: "Exit Failed",
          description: error,
          variant: "destructive",
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, refresh, setLoading, setError, toast, addEvent]
  );

  return {
    // State
    config: vaultConfig,
    balances,
    loading,
    error,

    // Actions
    refresh,
    refreshConfig,
    refreshBalances,
    getUserShares,
    depositUSDC,
    redeemShares,
    redeemToUSDC,
    setGuard,
    topUpGasBank,
    startAutonomousRebalancing,
    triggerRebalance,
    isAutonomousScheduled,
  };
}
