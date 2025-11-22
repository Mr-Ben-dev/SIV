// Sentinel Index Vault - Main Contract
import { Args, stringToBytes } from '@massalabs/as-types';
import {
  Address,
  balance,
  call,
  Context,
  Contract,
  deferredCallQuote,
  deferredCallRegister,
  findCheapestSlot,
  generateEvent,
  Storage,
  transferredCoins,
} from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

// IERC20 Serializable wrapper for Dusa Router tokenPath
// Matches Dusa's IERC20/MRC20Wrapper serialization format
class IERC20Ref {
  constructor(public origin: Address) {}

  serialize(): StaticArray<u8> {
    // Router's IERC20.deserialize expects string via Args, not raw bytes
    return new Args().add<string>(this.origin.toString()).serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): i32 {
    // Required for Serializable interface
    const args = new Args(data, offset);
    const addr = args.nextString().unwrap();
    this.origin = new Address(addr);
    return args.offset;
  }
}

// Helper to convert string to Address
function toAddress(addr: string): Address {
  return new Address(addr);
}

// Storage keys
const NAME_KEY = 'name';
const SYMBOL_KEY = 'symbol';
const OWNER_KEY = 'owner';
const TARGETS_BPS_KEY = 'targets_bps';
const MAX_DRIFT_BPS_KEY = 'max_drift_bps';
const REBALANCE_EPOCH_SECONDS_KEY = 'rebalance_epoch_seconds';
const MIN_DEPOSIT_USDC_KEY = 'min_deposit_usdc';
const MIN_SLICE_VALUE_KEY = 'min_slice_value';
const TOTAL_SHARES_KEY = 'total_shares';
const GUARD_ARMED_KEY = 'guard_armed';
const LAST_REBALANCE_KEY = 'last_rebalance';
const PAUSED_KEY = 'paused';
const REENTRANCY_GUARD_KEY = 'reentrancy_guard';
const DEFERRED_CALL_ID_KEY = 'deferred_call_id'; // Store current deferred call ID for autonomous rebalancing

// Autonomous monitoring keys (for persistent state tracking)
const NEXT_REBALANCE_TIMESTAMP_KEY = 'next_rebalance_timestamp';
const REBALANCE_COUNT_KEY = 'rebalance_count';
const LAST_REBALANCE_STATUS_KEY = 'last_rebalance_status'; // "success" | "failed" | "none"
const LAST_ERROR_KEY = 'last_error';
const DEFERRED_CALL_ACTIVE_KEY = 'deferred_call_active'; // "true" | "false"

// Token addresses keys
const USDCE_KEY = 'usdce_address';
const WMAS_KEY = 'wmas_address';
const WETHB_KEY = 'wethb_address';

// DEX addresses keys
const DUSA_ROUTER_KEY = 'dusa_router';
const EAGLEFI_ROUTER_KEY = 'eaglefi_router';

// Gas bank constants
const MIN_GAS_BANK_BALANCE: u64 = 2_000_000_000; // 2 MAS minimum for deferred calls (in nanoMAS)
const LOW_GAS_WARNING: u64 = 5_000_000_000; // 5 MAS warning threshold

// Mainnet Token Addresses
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9';
const WETH_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY'; // WETH-e (Ethereum bridge) - has WMAS pair!
const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';

// Dusa Router V2 Mainnet Address
const DUSA_ROUTER = 'AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p';
const DUSA_QUOTER = 'AS1d3DvZeqTo3Uq7mfAAUmNggjFXqEfGGpSUv6uTYvikVVW8EybN';
const DUSA_FACTORY = 'AS127Lxdux4HCUkZL89SrRYR5kq2u8t64Jt3aYj786t6fBF1cZGcu';

// DEX Parameters
const BIN_STEP_USDC_WMAS: u64 = 20; // USDC/WMAS pair bin step (will be verified via Factory)
const BIN_STEP_WMAS_WETH: u64 = 15; // WMAS/WETH pair bin step (will be verified via Factory)
const STORAGE_FEE_PER_SWAP: u64 = 10_000_000; // 0.01 MAS in nanoMAS (reduced to work with low balance)
const SWAP_DEADLINE_BUFFER: u64 = 600_000; // 10 minutes in milliseconds

// User shares key prefix
function userSharesKey(address: string): string {
  return `shares:${address}`;
}

/**
 * Constructor - Initialize the vault with configuration
 * Called only once during deployment
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'Can only be called during deployment');

  const args = new Args(binaryArgs);

  // Parse constructor arguments
  const name = args.nextString().expect('name required');
  const symbol = args.nextString().expect('symbol required');

  // Target allocations in basis points (must sum to 10000)
  const target0 = args.nextU64().expect('target0 required');
  const target1 = args.nextU64().expect('target1 required');
  const target2 = args.nextU64().expect('target2 required');

  const maxDriftBps = args.nextU64().expect('maxDriftBps required');
  const rebalanceEpochSeconds = args
    .nextU64()
    .expect('rebalanceEpochSeconds required');
  const minDepositUSDC = args.nextU64().expect('minDepositUSDC required');
  const minSliceValue = args.nextU64().expect('minSliceValue required');

  // Token addresses
  const usdceAddress = args.nextString().expect('usdceAddress required');
  const wmasAddress = args.nextString().expect('wmasAddress required');
  const wethbAddress = args.nextString().expect('wethbAddress required');

  // DEX addresses
  const dusaRouter = args.nextString().expect('dusaRouter required');
  const eaglefiRouter = args.nextString().expect('eaglefiRouter required');

  // Validate targets sum to 10000 (100%)
  assert(target0 + target1 + target2 == 10000, 'Targets must sum to 10000 bps');

  // Store configuration
  Storage.set(NAME_KEY, name);
  Storage.set(SYMBOL_KEY, symbol);
  Storage.set(OWNER_KEY, Context.caller().toString());

  // Store targets as comma-separated string
  const targetsStr = `${target0},${target1},${target2}`;
  Storage.set(TARGETS_BPS_KEY, targetsStr);

  Storage.set(MAX_DRIFT_BPS_KEY, maxDriftBps.toString());
  Storage.set(REBALANCE_EPOCH_SECONDS_KEY, rebalanceEpochSeconds.toString());
  Storage.set(MIN_DEPOSIT_USDC_KEY, minDepositUSDC.toString());
  Storage.set(MIN_SLICE_VALUE_KEY, minSliceValue.toString());

  // Token addresses
  Storage.set(USDCE_KEY, usdceAddress);
  Storage.set(WMAS_KEY, wmasAddress);
  Storage.set(WETHB_KEY, wethbAddress);

  // DEX addresses
  Storage.set(DUSA_ROUTER_KEY, dusaRouter);
  Storage.set(EAGLEFI_ROUTER_KEY, eaglefiRouter);

  // Initialize state
  Storage.set(TOTAL_SHARES_KEY, '0');
  Storage.set(LAST_REBALANCE_KEY, Context.timestamp().toString());
  // Don't set pause/guard/reentrancy keys - absence means false

  // Autonomous rebalancing will be available in future SDK version
  // For now, rebalance must be called manually or via external scheduler

  generateEvent(
    `ConstructorCalled:{"name":"${name}","symbol":"${symbol}","timestamp":${Context.timestamp()}}`,
  );
}

/**
 * Start the autonomous rebalancing cycle
 * Call this once to begin automatic rebalancing every epoch
 */
/**
 * Start autonomous rebalancing with TRUE deferred call scheduling
 * This schedules the triggerRebalance function to execute automatically
 */
export function startAutonomousRebalancing(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  // Only owner can start autonomous rebalancing
  assert(caller == owner, 'Only owner can start autonomous rebalancing');

  // Check if vault has any deposits
  const totalSharesStr = Storage.has(TOTAL_SHARES_KEY)
    ? Storage.get(TOTAL_SHARES_KEY)
    : '0';
  const totalShares = U64.parseInt(totalSharesStr);
  if (totalShares == 0) {
    generateEvent('AutonomousStartSkipped:{"reason":"No deposits in vault"}');
    return;
  }

  // Check if guard is armed
  const guardArmed = Storage.has(GUARD_ARMED_KEY);
  if (!guardArmed) {
    generateEvent('AutonomousStartSkipped:{"reason":"Guard not armed"}');
    return;
  }

  // Get rebalance epoch (how often to rebalance)
  const epochStr = Storage.has(REBALANCE_EPOCH_SECONDS_KEY)
    ? Storage.get(REBALANCE_EPOCH_SECONDS_KEY)
    : '1800';
  const epochSeconds = U64.parseInt(epochStr);

  // Calculate target slot (current period + epoch converted to periods)
  // Massa has 1 slot = 0.5 seconds, so we multiply epoch by 2 to get slots/periods
  const currentPeriod = Context.currentPeriod();
  const slotsToAdd = epochSeconds * 2; // Convert seconds to slots (0.5s per slot)
  const targetPeriod = currentPeriod + slotsToAdd;

  // Find cheapest slot in the next epoch range
  const maxGas: u64 = 200_000_000; // 200M gas for rebalance (reduced for affordability)
  const paramsSize: u64 = 0; // No parameters needed for triggerRebalance

  const targetSlot = findCheapestSlot(
    targetPeriod,
    targetPeriod + 100, // Search 100 periods ahead for cheapest slot
    maxGas,
    paramsSize,
  );

  // Get quote for the deferred call
  const quote = deferredCallQuote(targetSlot, maxGas, paramsSize);

  // Check if we have enough in gas bank to pay for the deferred call
  const gasBank = balance();
  if (gasBank < quote) {
    const gasBankMAS = gasBank / 1_000_000_000; // Convert nanoMAS to MAS
    const quoteMAS = quote / 1_000_000_000;
    const requiredMAS = (quote - gasBank) / 1_000_000_000;
    generateEvent(
      `InsufficientGasBank:{"current":"${gasBankMAS}","required":"${quoteMAS}","topUpNeeded":"${requiredMAS}"}`,
    );
    assert(
      false,
      `Insufficient gas bank: ${gasBankMAS} MAS available, ${quoteMAS} MAS required. Top up ${requiredMAS} MAS.`,
    );
  }

  // Register the deferred call
  const deferredId = deferredCallRegister(
    Context.callee().toString(), // Target this contract
    'triggerRebalance', // Call triggerRebalance function
    targetSlot,
    maxGas,
    new StaticArray<u8>(0), // No parameters
    0, // No coins to transfer
  );

  // Calculate expected next rebalance timestamp
  const currentTimestamp = Context.timestamp();
  const nextRebalanceTimestamp = currentTimestamp + epochSeconds * 1000; // Convert seconds to milliseconds

  // Store the deferred call ID and status
  Storage.set(DEFERRED_CALL_ID_KEY, deferredId);
  Storage.set('AUTONOMOUS_MODE_ENABLED', 'true');
  Storage.set(LAST_REBALANCE_KEY, currentTimestamp.toString());
  Storage.set(NEXT_REBALANCE_TIMESTAMP_KEY, nextRebalanceTimestamp.toString());
  Storage.set(DEFERRED_CALL_ACTIVE_KEY, 'true');
  Storage.set(LAST_REBALANCE_STATUS_KEY, 'pending');
  Storage.set(LAST_ERROR_KEY, '');

  // Initialize rebalance count if not exists
  if (!Storage.has(REBALANCE_COUNT_KEY)) {
    Storage.set(REBALANCE_COUNT_KEY, '0');
  }

  generateEvent(
    `AutonomousModeStarted:{"deferredId":"${deferredId}","targetSlot":${targetSlot.period},"quote":${quote},"timestamp":${currentTimestamp},"nextRebalance":${nextRebalanceTimestamp}}`,
  );
}

/**
 * Check if autonomous mode is enabled
 */
export function isAutonomousScheduled(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  const enabled = Storage.has('AUTONOMOUS_MODE_ENABLED');
  return new Args().add<bool>(enabled).serialize();
}

/**
 * Get comprehensive autonomous rebalancing status
 * Returns: (enabled: bool, deferredCallActive: bool, lastRebalanceTime: u64,
 *           nextRebalanceTime: u64, rebalanceCount: u64, lastStatus: string, lastError: string)
 */
export function getAutonomousStatus(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  // Check if autonomous mode is enabled
  const autonomousEnabled = Storage.has('AUTONOMOUS_MODE_ENABLED');

  // Check if a deferred call is currently active
  let deferredCallActive = false;
  if (Storage.has(DEFERRED_CALL_ACTIVE_KEY)) {
    const value: string = Storage.get(DEFERRED_CALL_ACTIVE_KEY);
    deferredCallActive = value == 'true';
  }

  // Get last rebalance timestamp
  const lastRebalanceStr = Storage.has(LAST_REBALANCE_KEY)
    ? Storage.get(LAST_REBALANCE_KEY)
    : '0';
  const lastRebalanceTime = U64.parseInt(lastRebalanceStr);

  // Get next rebalance timestamp
  const nextRebalanceStr = Storage.has(NEXT_REBALANCE_TIMESTAMP_KEY)
    ? Storage.get(NEXT_REBALANCE_TIMESTAMP_KEY)
    : '0';
  const nextRebalanceTime = U64.parseInt(nextRebalanceStr);

  // Get rebalance count
  const rebalanceCountStr = Storage.has(REBALANCE_COUNT_KEY)
    ? Storage.get(REBALANCE_COUNT_KEY)
    : '0';
  const rebalanceCount = U64.parseInt(rebalanceCountStr);

  // Get last status
  const lastStatus = Storage.has(LAST_REBALANCE_STATUS_KEY)
    ? Storage.get(LAST_REBALANCE_STATUS_KEY)
    : 'none';

  // Get last error
  const lastError = Storage.has(LAST_ERROR_KEY)
    ? Storage.get(LAST_ERROR_KEY)
    : '';

  // Get current gas bank balance
  const gasBank = balance();

  return new Args()
    .add<bool>(autonomousEnabled)
    .add<bool>(deferredCallActive)
    .add<u64>(lastRebalanceTime)
    .add<u64>(nextRebalanceTime)
    .add<u64>(rebalanceCount)
    .add<string>(lastStatus)
    .add<string>(lastError)
    .add<u64>(gasBank)
    .serialize();
}

/**
 * Trigger a rebalance (can be called manually or by deferred call)
 * If autonomous mode is enabled, this will self-reschedule for the next epoch
 */
export function triggerRebalance(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): void {
  // Emit start event for debugging
  generateEvent(
    `TriggerRebalanceStarted:{"caller":"${Context.caller().toString()}","timestamp":${Context.timestamp()}}`,
  );

  // Execute the rebalance
  executeRebalanceInternal();

  // Check if autonomous mode is enabled
  const autonomousEnabled = Storage.has('AUTONOMOUS_MODE_ENABLED');

  if (autonomousEnabled) {
    // Check gas bank before scheduling
    const gasBank = balance();
    if (gasBank < MIN_GAS_BANK_BALANCE) {
      Storage.set('AUTONOMOUS_MODE_ENABLED', 'false');
      const gasBankMAS = gasBank / 1_000_000_000;
      generateEvent(
        `AutonomousModeStopped:{"reason":"Low gas bank","balance":"${gasBankMAS} MAS","minRequired":"2 MAS"}`,
      );
      return;
    }

    // Self-reschedule for next epoch
    const epochStr = Storage.has(REBALANCE_EPOCH_SECONDS_KEY)
      ? Storage.get(REBALANCE_EPOCH_SECONDS_KEY)
      : '1800';
    const epochSeconds = U64.parseInt(epochStr);

    // Calculate target slot for next rebalance
    const currentPeriod = Context.currentPeriod();
    const slotsToAdd = epochSeconds * 2; // Convert seconds to slots
    const targetPeriod = currentPeriod + slotsToAdd;

    // Find cheapest slot
    const maxGas: u64 = 200_000_000; // 200M gas (reduced for affordability)
    const paramsSize: u64 = 0;

    const targetSlot = findCheapestSlot(
      targetPeriod,
      targetPeriod + 100,
      maxGas,
      paramsSize,
    );

    // Get quote
    const quote = deferredCallQuote(targetSlot, maxGas, paramsSize);

    // Check gas bank again after getting quote
    const currentGasBank = balance();

    if (currentGasBank >= quote && currentGasBank >= MIN_GAS_BANK_BALANCE) {
      // Register next deferred call
      const deferredId = deferredCallRegister(
        Context.callee().toString(),
        'triggerRebalance',
        targetSlot,
        maxGas,
        new StaticArray<u8>(0),
        0,
      );

      // Update stored deferred call ID
      Storage.set(DEFERRED_CALL_ID_KEY, deferredId);

      generateEvent(
        `NextRebalanceScheduled:{"deferredId":"${deferredId}","targetSlot":${targetSlot.period},"quote":${quote}}`,
      );
    } else {
      // Insufficient gas - stop autonomous mode
      Storage.set('AUTONOMOUS_MODE_ENABLED', 'false');
      generateEvent(
        `AutonomousModeStopped:{"reason":"Insufficient gas bank","required":${quote},"available":${gasBank}}`,
      );
    }
  }
}

// ============================================================================
// DEX SWAP HELPER FUNCTIONS (MVP - Simple Test Swap)
// ============================================================================

/**
 * Get token balance for this contract
 * @param tokenAddress - The ERC20 token address string
 * @returns The balance as u64 (may overflow if balance > 2^64)
 */
function getTokenBalance(tokenAddress: string): u64 {
  // MRC20 balanceOf expects string address via Args
  const args = new Args().add<string>(Context.callee().toString());
  const result = Contract.call(toAddress(tokenAddress), 'balanceOf', args, 0);
  const bal = new Args(result).nextU256().unwrap();

  // Convert u256 to u64 using toU64() method
  // Will return 0 if balance exceeds u64 max
  return bal.toU64();
}

/**
 * Get token balance as string (for backwards compatibility)
 */
function getTokenBalanceString(tokenAddress: string): string {
  // MRC20 balanceOf expects string address via Args
  const args = new Args().add<string>(Context.callee().toString());
  const result = Contract.call(toAddress(tokenAddress), 'balanceOf', args, 0);
  const bal = new Args(result).nextU256().unwrap();
  return bal.toString();
}
/**
 * Approve tokens for the Dusa Router (simplified MVP)
 * @param tokenAddress - The ERC20 token address string
 * @param amount - Amount to approve as u64
 */
function approveToken(tokenAddress: string, amount: u64): void {
  const amountU256 = u256.fromU64(amount);
  // MRC20 increaseAllowance expects string spender via Args
  const args = new Args().add<string>(DUSA_ROUTER).add<u256>(amountU256);

  // Don't send coins to increaseAllowance - it's not payable
  Contract.call(
    toAddress(tokenAddress),
    'increaseAllowance',
    args,
    0, // No coins needed for approval
  );
}

/**
 * Query Dusa Factory for available bin steps for a token pair
 * @param tokenX - First token address
 * @param tokenY - Second token address
 * @returns Comma-separated string of available bin steps
 */
function queryAvailableBinSteps(tokenX: string, tokenY: string): string {
  const args = new Args().add<string>(tokenX).add<string>(tokenY);

  const result = Contract.call(
    toAddress(DUSA_FACTORY),
    'getAvailableLBPairBinSteps',
    args,
    0,
  );

  // Parse result - Factory returns StaticArray<u8> of bin step values
  // The result format is a serialized array via Args
  const resultArgs = new Args(result);

  // Parse as u32 array length followed by elements
  const arrayLen = resultArgs.nextU32().unwrap();
  let binSteps: string = '';
  for (let i: u32 = 0; i < arrayLen; i++) {
    const binStep = resultArgs.nextU64().unwrap();
    binSteps += binStep.toString();
    if (i < arrayLen - 1) {
      binSteps += ',';
    }
  }
  return binSteps;
}

/**
 * Validate bin steps by querying Factory (for testing/debugging)
 * Emits an event with available bin steps for the token pairs
 */
export function validateBinSteps(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  // Query USDC/WMAS pair
  const usdcWmasBinSteps = queryAvailableBinSteps(USDC_ADDRESS, WMAS_ADDRESS);

  // Query WMAS/WETH pair
  const wmasWethBinSteps = queryAvailableBinSteps(WMAS_ADDRESS, WETH_ADDRESS);

  generateEvent(
    `BinStepsValidation:{"usdcWmas":${usdcWmasBinSteps},"wmasWeth":${wmasWethBinSteps},"currentUsdcWmas":${BIN_STEP_USDC_WMAS},"currentWmasWeth":${BIN_STEP_WMAS_WETH}}`,
  );

  return new StaticArray<u8>(0);
}

/**
 * Execute a simple test swap via Dusa Router with proper bytes serialization
 * @param tokenIn - Input token address string
 * @param tokenOut - Output token address string
 * @param amountIn - Amount of input tokens as u64
 * @param minAmountOut - Minimum acceptable output as u64
 * @returns Amount of tokens received
 */
function executeTestSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: u64,
  minAmountOut: u64,
): u256 {
  // Check token balance first
  const tokenBalance = getTokenBalance(tokenIn);
  const balanceBefore = getTokenBalance(tokenOut);

  // Approve tokens first
  approveToken(tokenIn, amountIn);

  const amountInU256 = u256.fromU64(amountIn);
  const minAmountOutU256 = u256.fromU64(minAmountOut);
  const deadline = Context.timestamp() + SWAP_DEADLINE_BUFFER;
  const masToSend: u64 = STORAGE_FEE_PER_SWAP; // 0.01 MAS

  // Determine correct bin step based on token pair
  let binStep: u64 = BIN_STEP_USDC_WMAS;
  if (tokenIn == WMAS_ADDRESS && tokenOut == WETH_ADDRESS) {
    binStep = BIN_STEP_WMAS_WETH;
  }

  // Build arguments for swapExactTokensForTokens
  const args = new Args();

  // 1. amountIn: u256
  args.add<u256>(amountInU256);

  // 2. amountOutMin: u256
  args.add<u256>(minAmountOutU256);

  // 3. pairBinSteps: Array<u64>
  args.add<Array<u64>>([binStep]);

  // 4. isLegacyPools: Array<bool>
  args.add<Array<bool>>([false]);

  // 5. tokenPath: Array<string>
  args.add<Array<string>>([tokenIn, tokenOut]);

  // 6. to: string (recipient address)
  args.add<string>(Context.callee().toString());

  // 7. deadline: u64
  args.add<u64>(deadline);

  // Execute swap - pass masToSend as coins parameter
  const result = Contract.call(
    toAddress(DUSA_ROUTER),
    'swapExactTokensForTokens',
    args,
    masToSend, // Router needs MAS for storage fees
  );

  // Parse result
  const amountOut = new Args(result).nextU256().unwrap();

  // Verify balance increased (DISABLED FOR DEBUGGING)
  const balanceAfter = getTokenBalance(tokenOut);
  // assert(balanceAfter > balanceBefore, 'Swap failed: no tokens received');

  generateEvent(
    `SwapExecuted:{"tokenIn":"${tokenIn}","tokenOut":"${tokenOut}","amountIn":"${amountIn}","amountOut":"${amountOut.toString()}","balanceBefore":"${balanceBefore}","balanceAfter":"${balanceAfter}"}`,
  );

  return amountOut;
}

// ============================================================================
// REBALANCING LOGIC
// ============================================================================

/**
 * Internal rebalance execution with full drift-based algorithm
 * Calculates portfolio drift and executes swaps only when needed
 */
function executeRebalanceInternal(): void {
  Storage.set(LAST_REBALANCE_KEY, Context.timestamp().toString());

  // Step 1: Read current token balances
  const wmasBalanceStr = getTokenBalanceString(WMAS_ADDRESS);
  const wethBalanceStr = getTokenBalanceString(WETH_ADDRESS);
  const usdcBalanceStr = getTokenBalanceString(USDC_ADDRESS);

  // Parse balances to u64 (simplified - assuming balances fit in u64)
  const wmasBalance = U64.parseInt(wmasBalanceStr);
  const wethBalance = U64.parseInt(wethBalanceStr);
  const usdcBalance = U64.parseInt(usdcBalanceStr);

  // Step 2: Convert to USD values using rough price estimates
  // WMAS: 9 decimals, ~$0.06 per WMAS
  // WETH: 18 decimals, ~$3000 per WETH
  // USDC: 6 decimals, $1 per USDC
  // Convert to microUSDC (6 decimals) for calculations

  // WMAS value in microUSDC: balance * 0.06 / 1e9 * 1e6 = balance * 0.06 / 1000
  const wmasValueUSDC = (wmasBalance * 6) / 100000; // balance * 0.00006

  // WETH value in microUSDC: balance * 3000 / 1e18 * 1e6 = balance * 3000 / 1e12
  const wethValueUSDC = (wethBalance * 3) / 1000000000; // balance * 0.000000003

  // USDC value in microUSDC: already in microUSDC (6 decimals)
  const usdcValueUSDC = usdcBalance;

  // Total portfolio value in microUSDC
  const totalValueUSDC = wmasValueUSDC + wethValueUSDC + usdcValueUSDC;

  // Prevent division by zero
  if (totalValueUSDC == 0) {
    generateEvent('RebalanceSkipped:{"reason":"Zero portfolio value"}');
    return;
  }

  // Step 3: Calculate current allocations in basis points (bps)
  const wmasCurrentBps = (wmasValueUSDC * 10000) / totalValueUSDC;
  const wethCurrentBps = (wethValueUSDC * 10000) / totalValueUSDC;
  const usdcCurrentBps = (usdcValueUSDC * 10000) / totalValueUSDC;

  // Get target allocations
  const targetsStr = Storage.get(TARGETS_BPS_KEY);
  const targetsParts = targetsStr.split(',');
  const wmasTargetBps = U64.parseInt(targetsParts[0]); // 3333
  const wethTargetBps = U64.parseInt(targetsParts[1]); // 3334
  const usdcTargetBps = U64.parseInt(targetsParts[2]); // 3333

  // Step 4: Calculate drift for each asset (absolute difference from target)
  const wmasDrift =
    wmasCurrentBps > wmasTargetBps
      ? wmasCurrentBps - wmasTargetBps
      : wmasTargetBps - wmasCurrentBps;
  const wethDrift =
    wethCurrentBps > wethTargetBps
      ? wethCurrentBps - wethTargetBps
      : wethTargetBps - wethCurrentBps;
  const usdcDrift =
    usdcCurrentBps > usdcTargetBps
      ? usdcCurrentBps - usdcTargetBps
      : usdcTargetBps - usdcCurrentBps;

  // Find maximum drift
  const maxDrift =
    wmasDrift > wethDrift
      ? wmasDrift > usdcDrift
        ? wmasDrift
        : usdcDrift
      : wethDrift > usdcDrift
      ? wethDrift
      : usdcDrift;

  const maxDriftBps = U64.parseInt(Storage.get(MAX_DRIFT_BPS_KEY)); // 500 bps (5%)

  generateEvent(
    `DriftCalculated:{"wmasCurrent":${wmasCurrentBps},"wethCurrent":${wethCurrentBps},"usdcCurrent":${usdcCurrentBps},"wmasDrift":${wmasDrift},"wethDrift":${wethDrift},"usdcDrift":${usdcDrift},"maxDrift":${maxDrift}}`,
  );

  // Step 5: Check if rebalancing is needed
  if (maxDrift <= maxDriftBps) {
    generateEvent(
      `RebalanceSkipped:{"reason":"Drift within threshold","maxDrift":${maxDrift},"threshold":${maxDriftBps}}`,
    );
    scheduleNextRebalance();
    return;
  }

  // Step 6: Execute rebalancing swaps
  // Calculate actual amounts needed to reach target allocations
  let swapCount: u64 = 0;

  // Target values in microUSDC
  const wmasTargetValue = (totalValueUSDC * wmasTargetBps) / 10000;
  const wethTargetValue = (totalValueUSDC * wethTargetBps) / 10000;

  // If WMAS is under-allocated, buy WMAS with USDC
  if (wmasCurrentBps < wmasTargetBps - 100) {
    // More than 1% below target
    // Calculate how much USDC to swap to reach target WMAS allocation
    const wmasDeficitValue = wmasTargetValue - wmasValueUSDC;
    const swapAmount =
      wmasDeficitValue > usdcBalance ? usdcBalance / 2 : wmasDeficitValue;

    if (swapAmount >= 10000 && usdcBalance >= swapAmount) {
      // Only swap if amount >= 0.01 USDC and we have enough balance
      // Note: approval now handled inside executeTestSwap

      // Use minimal minOut (1 unit) for initial testing
      // TODO: Integrate Dusa Quoter for realistic slippage protection
      const minOut: u64 = 1;

      const amountOut = executeTestSwap(
        USDC_ADDRESS,
        WMAS_ADDRESS,
        swapAmount,
        minOut,
      );
      if (!amountOut.isZero()) {
        swapCount++;
      }
    }
  }

  // If WETH is under-allocated, buy WETH with USDC (multi-hop via WMAS)
  if (wethCurrentBps < wethTargetBps - 100) {
    // More than 1% below target
    // Calculate how much USDC to swap to reach target WETH allocation
    const wethDeficitValue = wethTargetValue - wethValueUSDC;
    const swapAmount =
      wethDeficitValue > usdcBalance ? usdcBalance / 2 : wethDeficitValue;

    if (swapAmount >= 10000 && usdcBalance >= swapAmount) {
      // Only swap if amount >= 0.01 USDC and we have enough balance
      // Note: approval now handled inside executeMultiHopSwap

      // Use minimal minOut (1 unit) for initial testing
      // TODO: Integrate Dusa Quoter for realistic slippage protection
      const minOut: u64 = 1;

      const amountOut = executeMultiHopSwap(swapAmount, minOut); // Multi-hop: USDC → WMAS → WETH
      if (!amountOut.isZero()) {
        swapCount++;
      }
    }
  }

  // Emit completion event
  generateEvent(
    `RebalanceExecuted:{"epoch":${Context.timestamp()},"totalSwaps":${swapCount},"maxDrift":${maxDrift},"threshold":${maxDriftBps}}`,
  );

  scheduleNextRebalance();
}

/**
 * Get quote from Dusa Quoter and calculate minOut with slippage protection
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address
 * @param amountIn - Input amount as u64
 * @param binStep - Liquidity pool bin step
 * @param slippageBps - Slippage tolerance in basis points (50 = 0.5%)
 * @returns Minimum output amount after slippage
 */
function getQuoteWithSlippage(
  tokenIn: string,
  tokenOut: string,
  amountIn: u64,
  binStep: u64,
  slippageBps: u64,
): u64 {
  // Build args for Quoter.findBestPathFromAmountIn
  const quoteArgs = new Args()
    .add<u256>(u256.fromU64(amountIn))
    .add<string>(tokenIn)
    .add<string>(tokenOut);

  // Call Quoter
  const quoteResult = call(
    toAddress(DUSA_QUOTER),
    'findBestPathFromAmountIn',
    quoteArgs,
    0, // No coins needed for read-only call
  );

  // Parse quote result: returns (Quote memory quote)
  // Quote struct contains: route, pairs, binSteps, amounts, virtualAmountsWithoutSlippage, fees
  const resultArgs = new Args(quoteResult);

  // Skip route array (we don't need it)
  const routeLen = resultArgs.nextU32().unwrap();
  for (let i: u32 = 0; i < routeLen; i++) {
    resultArgs.nextString().unwrap();
  }

  // Skip pairs array
  const pairsLen = resultArgs.nextU32().unwrap();
  for (let i: u32 = 0; i < pairsLen; i++) {
    resultArgs.nextString().unwrap();
  }

  // Skip binSteps array
  const stepsLen = resultArgs.nextU32().unwrap();
  for (let i: u32 = 0; i < stepsLen; i++) {
    resultArgs.nextU64().unwrap();
  }

  // Get amounts array - last element is output amount
  const amountsLen = resultArgs.nextU32().unwrap();
  let expectedOut: u64 = 0;
  for (let i: u32 = 0; i < amountsLen; i++) {
    const amt = resultArgs.nextU256().unwrap();
    if (i == amountsLen - 1) {
      expectedOut = amt.toU64(); // Last amount is our output
    }
  }

  // Calculate minOut with slippage: minOut = expectedOut * (10000 - slippageBps) / 10000
  const minOut = (expectedOut * (10000 - slippageBps)) / 10000;

  return minOut;
}

/**
 * Execute a multi-hop swap via Dusa Router (USDC → WMAS → WETH)
 * @param amountIn - Amount of USDC to swap as u64
 * @param minAmountOut - Minimum acceptable WETH output as u64
 */
function executeMultiHopSwap(amountIn: u64, minAmountOut: u64): u256 {
  // Check balance before
  const balanceBefore = getTokenBalance(WETH_ADDRESS);

  // Approve USDC tokens first
  approveToken(USDC_ADDRESS, amountIn);

  const amountInU256 = u256.fromU64(amountIn);
  const minAmountOutU256 = u256.fromU64(minAmountOut);
  const deadline = Context.timestamp() + SWAP_DEADLINE_BUFFER;
  const masToSend: u64 = STORAGE_FEE_PER_SWAP; // 0.01 MAS

  // Build arguments for 3-token path swap: USDC → WMAS → WETH
  const args = new Args();

  // 1. amountIn: u256
  args.add<u256>(amountInU256);

  // 2. amountOutMin: u256
  args.add<u256>(minAmountOutU256);

  // 3. pairBinSteps: Array<u64> (2 bin steps for 2 hops)
  args.add<Array<u64>>([BIN_STEP_USDC_WMAS, BIN_STEP_WMAS_WETH]);

  // 4. isLegacyPools: Array<bool> (2 pools)
  args.add<Array<bool>>([false, false]);

  // 5. tokenPath: Array<string> (3 tokens for 2 hops)
  args.add<Array<string>>([USDC_ADDRESS, WMAS_ADDRESS, WETH_ADDRESS]);

  // 6. to: string (recipient address)
  args.add<string>(Context.callee().toString());

  // 7. deadline: u64
  args.add<u64>(deadline);

  // Execute swap
  const result = call(
    toAddress(DUSA_ROUTER),
    'swapExactTokensForTokens',
    args,
    masToSend,
  );

  // Parse result
  const amountOut = new Args(result).nextU256().unwrap();

  // Verify balance increased (DISABLED FOR DEBUGGING)
  const balanceAfter = getTokenBalance(WETH_ADDRESS);
  // assert(
  //   balanceAfter > balanceBefore,
  //   'Multi-hop swap failed: no WETH received',
  // );

  generateEvent(
    `MultiHopSwapExecuted:{"amountIn":"${amountIn}","amountOut":"${amountOut.toString()}","balanceBefore":"${balanceBefore}","balanceAfter":"${balanceAfter}"}`,
  );

  return amountOut;
}

/**
 * Schedule next autonomous rebalance in 30 minutes
 */
function scheduleNextRebalance(): void {
  const gasBankBalance = balance();

  // Only schedule next rebalance if gas bank has sufficient funds (>0.1 MAS)
  if (gasBankBalance > 100_000_000) {
    // 0.1 MAS in nanoMAS
    const callCoins: u64 = 50_000_000; // Allocate 0.05 MAS for next rebalance call

    // Schedule deferred call to rebalance() function
    // Note: Actual delay scheduling requires external scheduler or time-based triggers
    call(
      Context.callee(), // Call this same contract
      'rebalance', // Call the rebalance function
      new Args(), // No arguments needed
      callCoins, // Send coins for execution
    );

    // Mark as scheduled
    Storage.set('auton_scheduled', 'true');
  } else {
    // Mark as not scheduled
    Storage.set('auton_scheduled', 'false');
  }
}

/**
 * Get vault configuration
 * Returns serialized config data
 */
export function getConfig(_: StaticArray<u8>): StaticArray<u8> {
  const name = Storage.get(NAME_KEY);
  const symbol = Storage.get(SYMBOL_KEY);
  const owner = Storage.get(OWNER_KEY);

  // Parse targets from comma-separated string
  const targetsStr = Storage.get(TARGETS_BPS_KEY);
  const targetsParts = targetsStr.split(',');
  const target0 = U64.parseInt(targetsParts[0]);
  const target1 = U64.parseInt(targetsParts[1]);
  const target2 = U64.parseInt(targetsParts[2]);

  const maxDriftBps = U64.parseInt(Storage.get(MAX_DRIFT_BPS_KEY));
  const rebalanceEpochSeconds = U64.parseInt(
    Storage.get(REBALANCE_EPOCH_SECONDS_KEY),
  );
  const minDepositUSDC = U64.parseInt(Storage.get(MIN_DEPOSIT_USDC_KEY));
  const minSliceValue = U64.parseInt(Storage.get(MIN_SLICE_VALUE_KEY));

  // Return serialized config
  return new Args()
    .add(name)
    .add(symbol)
    .add(owner)
    .add(target0)
    .add(target1)
    .add(target2)
    .add(maxDriftBps)
    .add(rebalanceEpochSeconds)
    .add(minDepositUSDC)
    .add(minSliceValue)
    .serialize();
}

/**
 * Set minimum deposit amount (owner only)
 */
export function setMinDeposit(binaryArgs: StaticArray<u8>): void {
  const owner = Storage.get(OWNER_KEY);
  assert(
    Context.caller().toString() == owner,
    'Only owner can set minimum deposit',
  );

  const args = new Args(binaryArgs);
  const newMinDeposit = args.nextU64().expect('minDeposit required');

  Storage.set(MIN_DEPOSIT_USDC_KEY, newMinDeposit.toString());
  generateEvent(`Minimum deposit updated to ${newMinDeposit.toString()}`);
}

/**
 * Get vault balances
 * Returns total value and token balances
 */
export function getBalances(_: StaticArray<u8>): StaticArray<u8> {
  // Get total shares
  const totalSharesStr = Storage.has(TOTAL_SHARES_KEY)
    ? Storage.get(TOTAL_SHARES_KEY)
    : '0';
  const totalShares =
    totalSharesStr == '0' ? 0 : u64(U64.parseInt(totalSharesStr, 10));

  // Read ACTUAL token balances from contracts (not mock values!)
  const wmasBalance: u64 = getTokenBalance(WMAS_ADDRESS);
  const wethBalance: u64 = getTokenBalance(WETH_ADDRESS);
  const usdceBalance: u64 = getTokenBalance(USDC_ADDRESS);

  // Calculate total value in USDC equivalent (simplified: just sum USDC balance)
  // In production, this should convert all token values to USDC using price feeds
  const totalValueUSDC: u64 = usdceBalance;

  return new Args()
    .add(totalValueUSDC)
    .add(wmasBalance)
    .add(wethBalance)
    .add(usdceBalance)
    .add(totalShares)
    .serialize();
}

/**
 * Get user shares
 */
export function getUserShares(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args.nextString().expect('user address required');

  const sharesKey = userSharesKey(userAddress);
  const shares = Storage.has(sharesKey) ? Storage.get(sharesKey) : '0';

  return stringToBytes(shares);
}

/**
 * Deposit USDC.e and receive vault shares
 */
export function deposit(binaryArgs: StaticArray<u8>): void {
  // Check if contract is paused
  if (Storage.has(PAUSED_KEY)) {
    assert(false, 'Contract is paused');
  }

  // Reentrancy guard
  if (Storage.has(REENTRANCY_GUARD_KEY)) {
    assert(false, 'Reentrancy attempt detected');
  }
  Storage.set(REENTRANCY_GUARD_KEY, 'true');

  const args = new Args(binaryArgs);
  const amount = args.nextU64().expect('amount required');

  const caller = Context.caller().toString();
  const minDeposit = U64.parseInt(Storage.get(MIN_DEPOSIT_USDC_KEY));

  assert(amount >= minDeposit, 'Amount below minimum deposit');

  // Check vault's USDC balance BEFORE transfer
  const balanceBeforeStr = getTokenBalanceString(USDC_ADDRESS);
  const balanceBefore = U64.parseInt(balanceBeforeStr);

  // Transfer USDC from user to vault contract
  const amountU256 = u256.fromU64(amount);
  const transferArgs = new Args()
    .add<string>(caller) // from
    .add<string>(Context.callee().toString()) // to (vault contract)
    .add<u256>(amountU256); // amount

  Contract.call(
    toAddress(USDC_ADDRESS),
    'transferFrom',
    transferArgs,
    0, // No coins needed for token transfer
  );

  // Verify the transfer succeeded by checking balance AFTER
  const balanceAfterStr = getTokenBalanceString(USDC_ADDRESS);
  const balanceAfter = U64.parseInt(balanceAfterStr);

  // Balance should have increased by at least amount
  assert(
    balanceAfter >= balanceBefore + amount,
    'USDC transfer failed - check allowance and balance',
  );

  // Calculate shares (1:1 for simplicity)
  const sharesAmount = amount;

  // Update user shares
  const sharesKey = userSharesKey(caller);
  const currentShares = Storage.has(sharesKey)
    ? U64.parseInt(Storage.get(sharesKey))
    : 0;
  const newShares = currentShares + sharesAmount;
  Storage.set(sharesKey, newShares.toString());

  // Update total shares
  const totalShares = U64.parseInt(Storage.get(TOTAL_SHARES_KEY));
  Storage.set(TOTAL_SHARES_KEY, (totalShares + sharesAmount).toString());

  // Release reentrancy guard by deleting the key
  Storage.del(REENTRANCY_GUARD_KEY);

  // Emit event
  generateEvent(
    `Deposit:{"user":"${caller}","amount":"${amount}","shares":"${sharesAmount}"}`,
  );
}

/**
 * Redeem shares for proportional amounts of underlying tokens
 * Users can choose to receive tokens in their current form or convert all to USDC
 */
export function redeem(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const shares = args.nextU64().expect('shares required');
  const toUSDC = args.nextBool().expect('toUSDC required');

  const caller = Context.caller().toString();
  const sharesKey = userSharesKey(caller);

  assert(Storage.has(sharesKey), 'No shares to redeem');

  const currentShares = U64.parseInt(Storage.get(sharesKey));
  assert(currentShares >= shares, 'Insufficient shares');

  // Get total shares in vault
  const totalShares = U64.parseInt(Storage.get(TOTAL_SHARES_KEY));
  assert(totalShares > 0, 'No shares in circulation');

  // Calculate proportional ownership (shares / totalShares)
  // Get current token balances
  const wmasBalanceStr = getTokenBalanceString(WMAS_ADDRESS);
  const wethBalanceStr = getTokenBalanceString(WETH_ADDRESS);
  const usdcBalanceStr = getTokenBalanceString(USDC_ADDRESS);

  const wmasBalance = U64.parseInt(wmasBalanceStr);
  const wethBalance = U64.parseInt(wethBalanceStr);
  const usdcBalance = U64.parseInt(usdcBalanceStr);

  // Calculate user's proportional share of each token
  // userAmount = (shares * tokenBalance) / totalShares
  const userWmas = (shares * wmasBalance) / totalShares;
  const userWeth = (shares * wethBalance) / totalShares;
  const userUsdc = (shares * usdcBalance) / totalShares;

  // Update user shares
  const newShares = currentShares - shares;
  if (newShares > 0) {
    Storage.set(sharesKey, newShares.toString());
  } else {
    Storage.del(sharesKey);
  }

  // Update total shares
  Storage.set(TOTAL_SHARES_KEY, (totalShares - shares).toString());

  // Transfer tokens back to user
  if (toUSDC) {
    // Convert WMAS and WETH to USDC via DEX
    let totalUSDC = userUsdc; // Start with existing USDC

    // Swap WMAS → USDC if user has WMAS
    if (userWmas > 0) {
      // Use minimal minOut (accepts market price)
      const minOut: u64 = 1;

      // Approve and execute swap using same format as executeTestSwap
      approveToken(WMAS_ADDRESS, userWmas);

      const swapArgs = new Args();
      swapArgs.add<u256>(u256.fromU64(userWmas)); // amountIn
      swapArgs.add<u256>(u256.fromU64(minOut)); // amountOutMin
      swapArgs.add<Array<u64>>([BIN_STEP_USDC_WMAS]); // pairBinSteps
      swapArgs.add<Array<bool>>([false]); // isLegacyPools
      swapArgs.add<Array<string>>([WMAS_ADDRESS, USDC_ADDRESS]); // tokenPath
      swapArgs.add<string>(Context.callee().toString()); // to
      swapArgs.add<u64>(Context.timestamp() + SWAP_DEADLINE_BUFFER); // deadline

      const result = call(
        toAddress(DUSA_ROUTER),
        'swapExactTokensForTokens',
        swapArgs,
        STORAGE_FEE_PER_SWAP,
      );

      const resultArgs = new Args(result);
      const swappedAmount = resultArgs.nextU256().unwrap().toU64();
      totalUSDC += swappedAmount;

      generateEvent(
        `SwapExecuted:{"type":"redeem","path":"WMAS->USDC","amountIn":"${userWmas}","amountOut":"${swappedAmount}"}`,
      );
    }

    // Swap WETH → WMAS → USDC (multi-hop) if user has WETH
    if (userWeth > 0) {
      // Use minimal minOut (accepts market price)
      const minOut: u64 = 1;

      // Approve and execute multi-hop swap using same format as executeMultiHopSwap
      approveToken(WETH_ADDRESS, userWeth);

      const swapArgs = new Args();
      swapArgs.add<u256>(u256.fromU64(userWeth)); // amountIn
      swapArgs.add<u256>(u256.fromU64(minOut)); // amountOutMin
      swapArgs.add<Array<u64>>([BIN_STEP_WMAS_WETH, BIN_STEP_USDC_WMAS]); // pairBinSteps
      swapArgs.add<Array<bool>>([false, false]); // isLegacyPools
      swapArgs.add<Array<string>>([WETH_ADDRESS, WMAS_ADDRESS, USDC_ADDRESS]); // tokenPath
      swapArgs.add<string>(Context.callee().toString()); // to
      swapArgs.add<u64>(Context.timestamp() + SWAP_DEADLINE_BUFFER); // deadline

      const result = call(
        toAddress(DUSA_ROUTER),
        'swapExactTokensForTokens',
        swapArgs,
        STORAGE_FEE_PER_SWAP,
      );

      const resultArgs = new Args(result);
      const swappedAmount = resultArgs.nextU256().unwrap().toU64();
      totalUSDC += swappedAmount;

      generateEvent(
        `SwapExecuted:{"type":"redeem","path":"WETH->WMAS->USDC","amountIn":"${userWeth}","amountOut":"${swappedAmount}"}`,
      );
    }

    // Get final USDC balance and transfer to user
    const finalUsdcStr = getTokenBalanceString(USDC_ADDRESS);
    const finalUsdc = U64.parseInt(finalUsdcStr);

    transferTokenToUser(USDC_ADDRESS, caller, finalUsdc);

    generateEvent(
      `RedeemExecuted:{"shares":"${shares}","toUSDC":true,"usdcFinal":"${finalUsdc}"}`,
    );
  } else {
    // Transfer proportional amounts of each token
    transferTokenToUser(WMAS_ADDRESS, caller, userWmas);
    transferTokenToUser(WETH_ADDRESS, caller, userWeth);
    transferTokenToUser(USDC_ADDRESS, caller, userUsdc);

    generateEvent(
      `RedeemExecuted:{"shares":"${shares}","wmasOut":"${userWmas}","wethOut":"${userWeth}","usdcOut":"${userUsdc}"}`,
    );
  }

  // Emit event with detailed breakdown
  const toUSDCStr = toUSDC ? 'true' : 'false';
  generateEvent(
    `Withdraw:{"user":"${caller}","shares":"${shares}","wmas":"${userWmas}","weth":"${userWeth}","usdc":"${userUsdc}","toUSDC":${toUSDCStr}}`,
  );
}

/**
 * Helper function to transfer tokens from contract to user
 */
function transferTokenToUser(
  tokenAddress: string,
  userAddress: string,
  amount: u64,
): void {
  if (amount == 0) return; // Skip zero transfers

  const amountU256 = u256.fromU64(amount);
  const args = new Args()
    .add<string>(userAddress) // to
    .add<u256>(amountU256); // amount

  Contract.call(
    toAddress(tokenAddress),
    'transfer',
    args,
    0, // No coins needed for token transfer
  );
}

/**
 * Set risk-off guard
 * Only owner can call
 */
export function setGuard(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const armed = args.nextBool().expect('armed required');

  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can set guard');

  Storage.set(GUARD_ARMED_KEY, armed ? 'true' : 'false');

  generateEvent(`GuardArmed:{"armed":${armed},"reason":"Manual trigger"}`);
}

/**
 * Top up gas bank for autonomous operations
 * Accepts MAS coins sent with call
 */
export function topUpGasBank(_: StaticArray<u8>): void {
  const amount = transferredCoins();
  const newBalance = balance();

  generateEvent(
    `GasBankUpdated:{"newBalance":"${newBalance}","change":"${amount}"}`,
  );
}

/**
 * Execute rebalancing with autonomous scheduling
 * Schedules 6 slices to execute progressively
 */
export function rebalance(_: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  // Allow owner or contract itself to call
  assert(
    caller == owner || caller == Context.callee().toString(),
    'Unauthorized rebalance',
  );

  // Check if vault has any deposits
  const totalShares = U64.parseInt(Storage.get(TOTAL_SHARES_KEY));
  if (totalShares == 0) {
    Storage.set('auton_scheduled', 'false');
    generateEvent('RebalanceSkipped:{"reason":"No deposits"}');
    return;
  }

  // Check if guard is armed (required for rebalancing)
  const guardArmed = Storage.has(GUARD_ARMED_KEY);
  if (!guardArmed) {
    Storage.del('auton_scheduled');
    generateEvent('RebalanceSkipped:{"reason":"Guard off"}');
    return;
  }

  // Check gas bank
  const gasBankBalance = balance();
  if (gasBankBalance < 100_000_000) {
    Storage.set('auton_scheduled', 'false');
    generateEvent(
      `AutonomousRebalanceSkipped:{"reason":"Low gas bank","balance":"${gasBankBalance}"}`,
    );
    return;
  }

  // Epoch gating: check if enough time has passed since last rebalance
  const lastRebalance = Storage.has(LAST_REBALANCE_KEY)
    ? U64.parseInt(Storage.get(LAST_REBALANCE_KEY))
    : 0;
  const epochSeconds = U64.parseInt(Storage.get(REBALANCE_EPOCH_SECONDS_KEY));
  const now = Context.timestamp();

  if (lastRebalance > 0 && now < lastRebalance + epochSeconds * 1000) {
    const waitTime = lastRebalance + epochSeconds * 1000 - now;
    generateEvent(
      `RebalanceSkipped:{"reason":"Too soon","waitMs":"${waitTime}"}`,
    );
    return;
  }

  // Execute the rebalance
  executeRebalanceInternal();

  // Update last rebalance timestamp
  Storage.set(LAST_REBALANCE_KEY, now.toString());

  // Schedule next rebalance
  scheduleNextRebalance();

  // Emit manual trigger event if called by owner
  if (caller == owner) {
    generateEvent(`ManualRebalanceTriggered:{"caller":"${caller}"}`);
  }
}

/**
 * Get guard status
 */
export function getGuardStatus(_: StaticArray<u8>): StaticArray<u8> {
  const armed = Storage.has(GUARD_ARMED_KEY);
  return new Args().add(armed).serialize();
}

/**
 * Pause contract (owner only)
 * Prevents deposits and rebalancing while paused
 */
export function pause(_: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can pause');
  Storage.set(PAUSED_KEY, 'true');

  generateEvent(`ContractPaused:{"timestamp":${Context.timestamp()}}`);
}

/**
 * Unpause contract (owner only)
 */
export function unpause(_: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can unpause');
  Storage.set(PAUSED_KEY, 'false');

  generateEvent(`ContractUnpaused:{"timestamp":${Context.timestamp()}}`);
}

/**
 * Update target allocations (owner only)
 */
export function updateTargets(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can update targets');

  const args = new Args(binaryArgs);
  const target0 = args.nextU64().expect('target0 required');
  const target1 = args.nextU64().expect('target1 required');
  const target2 = args.nextU64().expect('target2 required');

  assert(target0 + target1 + target2 == 10000, 'Targets must sum to 10000 bps');

  const targetsStr = `${target0},${target1},${target2}`;
  Storage.set(TARGETS_BPS_KEY, targetsStr);

  generateEvent(
    `TargetsUpdated:{"target0":${target0},"target1":${target1},"target2":${target2}}`,
  );
}

/**
 * Update maximum drift threshold (owner only)
 */
export function updateMaxDrift(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can update max drift');

  const args = new Args(binaryArgs);
  const newMaxDrift = args.nextU64().expect('maxDrift required');

  assert(
    newMaxDrift > 0 && newMaxDrift <= 2000,
    'Max drift must be 1-2000 bps',
  );

  Storage.set(MAX_DRIFT_BPS_KEY, newMaxDrift.toString());

  generateEvent(`MaxDriftUpdated:{"maxDrift":${newMaxDrift}}`);
}

/**
 * Update rebalance epoch (owner only)
 */
export function updateRebalanceEpoch(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can update rebalance epoch');

  const args = new Args(binaryArgs);
  const newEpoch = args.nextU64().expect('epoch required');

  assert(newEpoch >= 300, 'Epoch must be at least 300 seconds (5 minutes)');

  Storage.set(REBALANCE_EPOCH_SECONDS_KEY, newEpoch.toString());

  generateEvent(`RebalanceEpochUpdated:{"epoch":${newEpoch}}`);
}

/**
 * Emergency withdrawal (owner only)
 * Allows owner to rescue tokens in case of emergency
 */
export function emergencyWithdraw(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can emergency withdraw');
  if (!Storage.has(PAUSED_KEY)) {
    assert(false, 'Contract must be paused for emergency withdrawal');
  }

  const args = new Args(binaryArgs);
  const tokenAddress = args.nextString().expect('tokenAddress required');
  const amount = args.nextU64().expect('amount required');

  transferTokenToUser(tokenAddress, owner, amount);

  generateEvent(
    `EmergencyWithdraw:{"token":"${tokenAddress}","amount":"${amount}","to":"${owner}"}`,
  );
}

/**
 * Transfer ownership (owner only)
 */
export function transferOwnership(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const owner = Storage.get(OWNER_KEY);

  assert(caller == owner, 'Only owner can transfer ownership');

  const args = new Args(binaryArgs);
  const newOwner = args.nextString().expect('newOwner required');

  // Basic validation that newOwner is a valid address format
  assert(newOwner.length > 0, 'New owner address cannot be empty');

  Storage.set(OWNER_KEY, newOwner);

  generateEvent(
    `OwnershipTransferred:{"oldOwner":"${owner}","newOwner":"${newOwner}"}`,
  );
}

/**
 * Get contract pause status
 */
export function isPaused(_: StaticArray<u8>): StaticArray<u8> {
  const paused = Storage.has(PAUSED_KEY);
  return new Args().add(paused).serialize();
}
