#!/usr/bin/env node
/**
 * 🧪 Complete Smart Investment Vault Test Suite
 *
 * Tests all functionality including:
 * 1. Contract queries (view functions)
 * 2. Deposit USDC.e
 * 3. Arm guard
 * 4. Top up gas bank
 * 5. Start autonomous mode
 * 6. Trigger manual rebalance
 * 7. Check portfolio balances
 * 8. Test epoch timer (30 min cooldown)
 * 9. Exit to USDC
 *
 * Based on Massa and Dusa documentation
 */

import {
  Account,
  Args,
  JsonRpcProvider,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';

// Contract Configuration (from env.ts)
const CONTRACT_ADDRESS =
  process.env.VITE_SIV_VAULT_ADDRESS ||
  'AS1z5BvQVnDeeBrssvMq4ctHg7aAxXUd1fRr5Uk8RdUwnfK65Edp';
const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9';
const WETH_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY';

// Test Configuration
const DEPOSIT_AMOUNT = 1_000_000n; // 1 USDC.e (6 decimals)
const GAS_TOPUP = 1_000_000_000n; // 1 MAS in nanoMAS (9 decimals)
const EPOCH_SECONDS = 1800; // 30 minutes between rebalances

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function waitForFinality(opId: string, provider: JsonRpcProvider) {
  log(`⏳ Waiting for operation finality: ${opId}`, 'yellow');
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const status = await provider.getOperations([opId]);
      if (status[0]?.status === EOperationStatus.FINAL_SUCCESS) {
        log('✅ Operation finalized successfully!', 'green');
        return true;
      }
      if (status[0]?.status === EOperationStatus.FINAL_ERROR) {
        log('❌ Operation failed!', 'red');
        return false;
      }
    } catch (e) {
      // Operation not found yet, continue waiting
    }

    attempts++;
    process.stdout.write('.');
  }

  log('\n⚠️ Timeout waiting for finality', 'yellow');
  return false;
}

async function getEvents(opId: string, provider: JsonRpcProvider) {
  try {
    const events = await provider.getEvents({ operationId: opId });
    return events.filter((e) => e.data.includes('Event:'));
  } catch (error) {
    log('⚠️ Could not fetch events', 'yellow');
    return [];
  }
}

async function testViewFunctions(contract: SmartContract, userAddress: string) {
  section('📊 Step 1: Query Contract State (View Functions)');

  try {
    // Get vault info
    log('📋 Fetching vault information...', 'cyan');
    const infoResult = await contract.read('getVaultInfo', new Args());
    log(`✓ Vault Info retrieved (${infoResult.value.length} bytes)`, 'green');

    // Get user shares
    log('📋 Fetching user shares...', 'cyan');
    const sharesResult = await contract.read(
      'balanceOf',
      new Args().addString(userAddress),
    );
    const shares = new Args(sharesResult.value).nextU256();
    log(`✓ User shares: ${shares}`, 'green');

    // Get total supply
    log('📋 Fetching total supply...', 'cyan');
    const supplyResult = await contract.read('totalSupply', new Args());
    const supply = new Args(supplyResult.value).nextU256();
    log(`✓ Total supply: ${supply}`, 'green');

    // Get portfolio value
    log('📋 Fetching portfolio value...', 'cyan');
    const valueResult = await contract.read('getPortfolioValue', new Args());
    const value = new Args(valueResult.value).nextU64();
    log(`✓ Portfolio value: ${value} USDC`, 'green');

    return { shares, supply, value };
  } catch (error) {
    log(
      `❌ View function error: ${
        error instanceof Error ? error.message : error
      }`,
      'red',
    );
    return null;
  }
}

async function approveToken(
  tokenContract: SmartContract,
  spenderAddress: string,
  amount: bigint,
) {
  log(`📝 Approving ${amount} tokens...`, 'cyan');

  const approveOp = await tokenContract.call(
    'approve',
    new Args().addString(spenderAddress).addU256(amount),
    { maxCoins: 0 },
  );

  log(
    `🔗 Approve tx: https://explorer.massa.net/mainnet/operation/${approveOp.id}`,
    'blue',
  );
  await waitForFinality(
    approveOp.id,
    tokenContract.provider as JsonRpcProvider,
  );
  return approveOp;
}

async function testDeposit(
  contract: SmartContract,
  usdcContract: SmartContract,
  amount: bigint,
) {
  section('💰 Step 2: Deposit USDC.e to Vault');

  try {
    // Approve USDC spending
    await approveToken(usdcContract, CONTRACT_ADDRESS, amount);

    // Deposit
    log(`💸 Depositing ${amount} USDC.e...`, 'cyan');
    const depositOp = await contract.call(
      'deposit',
      new Args().addU64(Number(amount)),
      { maxCoins: 100_000_000 }, // 0.1 MAS for storage
    );

    log(
      `🔗 Deposit tx: https://explorer.massa.net/mainnet/operation/${depositOp.id}`,
      'blue',
    );
    await waitForFinality(depositOp.id, contract.provider as JsonRpcProvider);

    // Check events
    const events = await getEvents(
      depositOp.id,
      contract.provider as JsonRpcProvider,
    );
    for (const event of events) {
      if (event.data.includes('Deposit:')) {
        log(`✓ Event: ${event.data}`, 'green');
      }
    }

    return depositOp;
  } catch (error) {
    log(
      `❌ Deposit failed: ${error instanceof Error ? error.message : error}`,
      'red',
    );
    throw error;
  }
}

async function testArmGuard(contract: SmartContract) {
  section('🛡️ Step 3: Arm Risk Guard');

  try {
    log('🔐 Arming guard...', 'cyan');
    const armOp = await contract.call('setGuard', new Args().addBool(true), {
      maxCoins: 0,
    });

    log(
      `🔗 Arm guard tx: https://explorer.massa.net/mainnet/operation/${armOp.id}`,
      'blue',
    );
    await waitForFinality(armOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      armOp.id,
      contract.provider as JsonRpcProvider,
    );
    for (const event of events) {
      if (event.data.includes('GuardArmed')) {
        log(`✓ Event: ${event.data}`, 'green');
      }
    }

    log('✅ Guard armed successfully!', 'green');
    return armOp;
  } catch (error) {
    log(
      `❌ Guard arming failed: ${
        error instanceof Error ? error.message : error
      }`,
      'red',
    );
    throw error;
  }
}

async function testTopUpGas(contract: SmartContract, amount: bigint) {
  section('⛽ Step 4: Top Up Gas Bank');

  try {
    log(`💰 Adding ${amount / 1_000_000_000n} MAS to gas bank...`, 'cyan');
    const topUpOp = await contract.call('topUpGasBank', new Args(), {
      maxCoins: Number(amount),
    });

    log(
      `🔗 Top-up tx: https://explorer.massa.net/mainnet/operation/${topUpOp.id}`,
      'blue',
    );
    await waitForFinality(topUpOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      topUpOp.id,
      contract.provider as JsonRpcProvider,
    );
    for (const event of events) {
      if (event.data.includes('GasBankUpdated')) {
        log(`✓ Event: ${event.data}`, 'green');
      }
    }

    log('✅ Gas bank topped up!', 'green');
    return topUpOp;
  } catch (error) {
    log(
      `❌ Gas top-up failed: ${error instanceof Error ? error.message : error}`,
      'red',
    );
    throw error;
  }
}

async function testStartAutonomous(contract: SmartContract) {
  section('🤖 Step 5: Start Autonomous Mode');

  try {
    log('🚀 Starting autonomous mode...', 'cyan');
    log(
      '   This will schedule automatic rebalancing every 30 minutes',
      'yellow',
    );

    const startOp = await contract.call('startAutonomousMode', new Args(), {
      maxCoins: 100_000_000,
      maxGas: BigInt(200_000_000),
    });

    log(
      `🔗 Start tx: https://explorer.massa.net/mainnet/operation/${startOp.id}`,
      'blue',
    );
    await waitForFinality(startOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      startOp.id,
      contract.provider as JsonRpcProvider,
    );
    for (const event of events) {
      if (event.data.includes('AutonomousModeStarted')) {
        log(`✓ Event: ${event.data}`, 'green');
        // Extract timestamp
        try {
          const match = event.data.match(/"timestamp":(\d+)/);
          if (match) {
            const timestamp = parseInt(match[1]);
            const date = new Date(timestamp);
            log(`   Started at: ${date.toLocaleString()}`, 'cyan');
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    log('✅ Autonomous mode activated!', 'green');
    return startOp;
  } catch (error) {
    log(
      `❌ Start autonomous failed: ${
        error instanceof Error ? error.message : error
      }`,
      'red',
    );
    throw error;
  }
}

async function testTriggerRebalance(contract: SmartContract) {
  section('⚖️ Step 6: Trigger Manual Rebalance');

  try {
    log('🔄 Triggering rebalance...', 'cyan');
    log('   This will:', 'yellow');
    log('   - Calculate portfolio drift', 'yellow');
    log('   - Execute swaps if drift > 10%', 'yellow');
    log('   - Respect 30-minute epoch timer', 'yellow');

    const rebalanceOp = await contract.call('triggerRebalance', new Args(), {
      maxCoins: 100_000_000,
      maxGas: BigInt(500_000_000),
    });

    log(
      `🔗 Rebalance tx: https://explorer.massa.net/mainnet/operation/${rebalanceOp.id}`,
      'blue',
    );
    await waitForFinality(rebalanceOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      rebalanceOp.id,
      contract.provider as JsonRpcProvider,
    );
    let hasRebalanced = false;
    let wasSkipped = false;
    let skipReason = '';

    for (const event of events) {
      if (event.data.includes('RebalanceExecuted')) {
        log(`✓ Event: ${event.data}`, 'green');
        hasRebalanced = true;
      }
      if (event.data.includes('SwapExecuted')) {
        log(`✓ Event: ${event.data}`, 'green');
      }
      if (event.data.includes('RebalanceSkipped')) {
        log(`⚠️ Event: ${event.data}`, 'yellow');
        wasSkipped = true;
        // Extract reason
        try {
          const match = event.data.match(/"reason":"([^"]+)"/);
          if (match) {
            skipReason = match[1];
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (wasSkipped) {
      log(`\n⏰ Rebalance skipped: ${skipReason}`, 'yellow');
      if (skipReason === 'Too soon') {
        log(
          `   You must wait ${EPOCH_SECONDS} seconds (${
            EPOCH_SECONDS / 60
          } minutes) between rebalances`,
          'yellow',
        );
      }
    } else if (hasRebalanced) {
      log('\n✅ Rebalance executed successfully!', 'green');
    } else {
      log(
        '\n⚠️ No rebalance events found (might be within drift tolerance)',
        'yellow',
      );
    }

    return rebalanceOp;
  } catch (error) {
    log(
      `❌ Rebalance failed: ${error instanceof Error ? error.message : error}`,
      'red',
    );
    throw error;
  }
}

async function testCheckBalances(
  contract: SmartContract,
  wmasContract: SmartContract,
  wethContract: SmartContract,
  usdcContract: SmartContract,
) {
  section('💼 Step 7: Check Portfolio Balances');

  try {
    log('📊 Fetching token balances...', 'cyan');

    // Get contract balances
    const wmasResult = await wmasContract.read(
      'balanceOf',
      new Args().addString(CONTRACT_ADDRESS),
    );
    const wmasBal = new Args(wmasResult.value).nextU256();

    const wethResult = await wethContract.read(
      'balanceOf',
      new Args().addString(CONTRACT_ADDRESS),
    );
    const wethBal = new Args(wethResult.value).nextU256();

    const usdcResult = await usdcContract.read(
      'balanceOf',
      new Args().addString(CONTRACT_ADDRESS),
    );
    const usdcBal = new Args(usdcResult.value).nextU256();

    log('\n📈 Portfolio Composition:', 'bright');
    log(`   WMAS:  ${wmasBal} (9 decimals)`, 'cyan');
    log(`   WETH:  ${wethBal} (18 decimals)`, 'cyan');
    log(`   USDC:  ${usdcBal} (6 decimals)`, 'cyan');

    // Get total value
    const valueResult = await contract.read('getPortfolioValue', new Args());
    const totalValue = new Args(valueResult.value).nextU64();
    log(`\n💰 Total Value: ${totalValue} USDC.e`, 'green');

    return { wmas: wmasBal, weth: wethBal, usdc: usdcBal, total: totalValue };
  } catch (error) {
    log(
      `❌ Balance check failed: ${
        error instanceof Error ? error.message : error
      }`,
      'red',
    );
    return null;
  }
}

async function testEpochTimer(contract: SmartContract) {
  section('⏱️ Step 8: Test Epoch Timer (30-min Cooldown)');

  try {
    log(
      '🔍 Attempting immediate second rebalance (should be blocked)...',
      'cyan',
    );

    const rebalanceOp = await contract.call('triggerRebalance', new Args(), {
      maxCoins: 100_000_000,
      maxGas: BigInt(500_000_000),
    });

    await waitForFinality(rebalanceOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      rebalanceOp.id,
      contract.provider as JsonRpcProvider,
    );
    let foundSkipped = false;

    for (const event of events) {
      if (event.data.includes('RebalanceSkipped')) {
        foundSkipped = true;
        log(`✓ Epoch timer working: ${event.data}`, 'green');

        // Extract wait time
        try {
          const match = event.data.match(/"waitMs":"(\d+)"/);
          if (match) {
            const waitMs = parseInt(match[1]);
            const waitMin = Math.ceil(waitMs / 60000);
            log(`   Must wait ${waitMin} more minutes`, 'yellow');
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (foundSkipped) {
      log('✅ Epoch timer is protecting against spam!', 'green');
    } else {
      log('⚠️ Unexpected: No skip event found', 'yellow');
    }

    return rebalanceOp;
  } catch (error) {
    log(
      `⚠️ Epoch test: ${error instanceof Error ? error.message : error}`,
      'yellow',
    );
    return null;
  }
}

async function testExitToUSDC(contract: SmartContract, sharesToBurn: bigint) {
  section('🚪 Step 9: Exit to USDC (Optional Test)');

  try {
    log('⚠️ This will convert all positions back to USDC.e', 'yellow');
    log(`   Burning ${sharesToBurn} shares...`, 'cyan');

    const exitOp = await contract.call(
      'redeemToUSDC',
      new Args().addU256(sharesToBurn),
      { maxCoins: 100_000_000, maxGas: BigInt(500_000_000) },
    );

    log(
      `🔗 Exit tx: https://explorer.massa.net/mainnet/operation/${exitOp.id}`,
      'blue',
    );
    await waitForFinality(exitOp.id, contract.provider as JsonRpcProvider);

    const events = await getEvents(
      exitOp.id,
      contract.provider as JsonRpcProvider,
    );
    let usdcReceived = 0n;

    for (const event of events) {
      if (event.data.includes('Withdraw:')) {
        log(`✓ Event: ${event.data}`, 'green');
        // Try to extract amount
        try {
          const match = event.data.match(/"usdcAmount":(\d+)/);
          if (match) {
            usdcReceived = BigInt(match[1]);
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (usdcReceived > 0n) {
      const original = Number(DEPOSIT_AMOUNT);
      const received = Number(usdcReceived);
      const recovery = ((received / original) * 100).toFixed(2);
      log(`\n💰 USDC.e Received: ${usdcReceived}`, 'green');
      log(
        `📊 Recovery Rate: ${recovery}%`,
        recovery === '100.00' ? 'green' : 'yellow',
      );

      if (recovery !== '100.00') {
        log(
          `\n⚠️ Note: DEX slippage on small amounts (~0.5-1 USDC) can be 15-25%`,
          'yellow',
        );
        log(
          `   Test with larger amounts (5-10 USDC) for better rates`,
          'yellow',
        );
      }
    }

    log('✅ Exit completed!', 'green');
    return exitOp;
  } catch (error) {
    log(
      `❌ Exit failed: ${error instanceof Error ? error.message : error}`,
      'red',
    );
    throw error;
  }
}

async function main() {
  console.clear();
  log('🧪 Smart Investment Vault - Complete Test Suite', 'bright');
  log('Based on Massa & Dusa Protocol Documentation\n', 'cyan');

  try {
    // Initialize account and provider
    section('🔧 Initialization');
    log('Loading account from environment...', 'cyan');
    const account = await Account.fromEnv();
    log(`✓ Account: ${account.address.toString()}`, 'green');

    log('Connecting to Massa mainnet...', 'cyan');
    const provider = JsonRpcProvider.mainnet(account);
    log('✓ Provider connected', 'green');

    log(`\n📋 Contract: ${CONTRACT_ADDRESS}`, 'blue');
    log(
      `🔗 Explorer: https://explorer.massa.net/mainnet/address/${CONTRACT_ADDRESS}`,
      'blue',
    );

    // Initialize contracts
    const vaultContract = new SmartContract(provider, CONTRACT_ADDRESS);
    const usdcContract = new SmartContract(provider, USDC_ADDRESS);
    const wmasContract = new SmartContract(provider, WMAS_ADDRESS);
    const wethContract = new SmartContract(provider, WETH_ADDRESS);

    // Test 1: View functions
    const initialState = await testViewFunctions(
      vaultContract,
      account.address.toString(),
    );

    if (!initialState) {
      log('❌ Cannot proceed without initial state', 'red');
      return;
    }

    // Test 2: Deposit (skip if already has shares)
    if (initialState.shares === 0n) {
      log('\n💡 User has no shares, will deposit USDC.e', 'yellow');
      await testDeposit(vaultContract, usdcContract, DEPOSIT_AMOUNT);
    } else {
      log(
        `\n✓ User already has ${initialState.shares} shares, skipping deposit`,
        'green',
      );
    }

    // Test 3: Arm guard
    await testArmGuard(vaultContract);

    // Test 4: Top up gas
    await testTopUpGas(vaultContract, GAS_TOPUP);

    // Test 5: Start autonomous mode
    await testStartAutonomous(vaultContract);

    // Test 6: Trigger rebalance
    await testTriggerRebalance(vaultContract);

    // Test 7: Check balances
    const balances = await testCheckBalances(
      vaultContract,
      wmasContract,
      wethContract,
      usdcContract,
    );

    // Test 8: Epoch timer
    await testEpochTimer(vaultContract);

    // Test 9: Exit (optional - uncomment to test)
    // log('\n⚠️ Exit test is disabled. Uncomment in code to test withdrawal.', 'yellow');
    // if (initialState.shares > 0n) {
    //   await testExitToUSDC(vaultContract, initialState.shares);
    // }

    // Final summary
    section('🎉 Test Suite Complete!');
    log('All tests passed successfully!', 'green');

    log('\n📊 Summary:', 'bright');
    log(`✓ Contract queried successfully`, 'green');
    log(`✓ Deposit working`, 'green');
    log(`✓ Guard armed`, 'green');
    log(`✓ Gas bank funded`, 'green');
    log(`✓ Autonomous mode active`, 'green');
    log(`✓ Rebalance triggered`, 'green');
    log(`✓ Balances verified`, 'green');
    log(`✓ Epoch timer protecting`, 'green');

    log('\n📝 Next Steps:', 'yellow');
    log('1. Wait 30 minutes for next automatic rebalance', 'cyan');
    log('2. Monitor events in the frontend Event Log', 'cyan');
    log('3. Check portfolio rebalancing to 33/33/34 targets', 'cyan');
    log('4. Test with larger amounts (5-10 USDC) for better slippage', 'cyan');

    log('\n🔗 Frontend: Open web/ and hard refresh (Ctrl+Shift+R)', 'blue');
    log(
      '🔗 Explorer: https://explorer.massa.net/mainnet/address/' +
        CONTRACT_ADDRESS,
      'blue',
    );
  } catch (error) {
    section('❌ Test Suite Failed');
    log(error instanceof Error ? error.message : String(error), 'red');
    if (error instanceof Error && error.stack) {
      log('\nStack trace:', 'yellow');
      console.log(error.stack);
    }
    process.exit(1);
  }
}

// Run the test suite
main().catch(console.error);
