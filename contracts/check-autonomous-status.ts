/**
 * Check if autonomous rebalancing is working
 */

import { Args } from '@massalabs/massa-web3';
import fetch from 'node-fetch';

const CONTRACT_ADDRESS =
  'AS12GgBGhc7hyh1N8qCFptHNUAaVD2n7B6Xt9PYPPEn3rLWtBEi8V';
const RPC_URL = 'https://mainnet.massa.net/api/v2';

async function rpcCall(method: string, params: any[]) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function main() {
  console.log('=== Checking Autonomous Rebalancing Status ===\n');

  // 1. Check if autonomous mode is enabled
  console.log('1. Checking if autonomous mode is enabled...');
  try {
    const result = await rpcCall('execute_read_only_call', [
      {
        target_address: CONTRACT_ADDRESS,
        target_function: 'isAutonomousScheduled',
        parameter: Array.from(new Args().serialize()),
        max_gas: 100_000_000,
        coins: 0,
      },
    ]);

    const args = new Args(Uint8Array.from(result.executed_at.result.ok));
    const isEnabled = args.nextBool();
    console.log(`   Autonomous mode enabled: ${isEnabled}`);

    if (!isEnabled) {
      console.log('   ❌ PROBLEM: Autonomous mode not enabled!');
      console.log('      - Deferred call may have failed to register');
      console.log('      - Or autonomous mode was stopped due to low gas');
    } else {
      console.log('   ✅ Autonomous mode is ENABLED');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // 2. Check last rebalance timestamp from config
  console.log('\n2. Checking last rebalance timestamp...');
  try {
    const result = await rpcCall('execute_read_only_call', [
      {
        target_address: CONTRACT_ADDRESS,
        target_function: 'getConfig',
        parameter: Array.from(new Args().serialize()),
        max_gas: 200_000_000,
        coins: 0,
      },
    ]);

    const args = new Args(Uint8Array.from(result.executed_at.result.ok));
    const name = args.nextString();
    const symbol = args.nextString();
    const owner = args.nextString();

    // Skip targets array
    const targetsLen = args.nextU32();
    for (let i = 0; i < targetsLen; i++) {
      args.nextU64();
    }

    const maxDrift = args.nextU64();
    const rebalanceEpoch = args.nextU64();
    const minDeposit = args.nextU64();
    const minSliceValue = args.nextU64();
    const lastRebalance = args.nextU64();

    console.log(`   Last rebalance timestamp: ${lastRebalance}`);

    if (lastRebalance === 0n) {
      console.log(
        '   ℹ️  Never rebalanced yet (OK - waiting for first trigger)',
      );
    } else {
      const lastRebalanceDate = new Date(Number(lastRebalance));
      const now = Date.now();
      const timeSince = Math.floor((now - Number(lastRebalance)) / 1000);
      console.log(`   Last rebalance: ${lastRebalanceDate.toISOString()}`);
      console.log(`   Time since: ${timeSince}s ago`);
      console.log(
        `   Epoch period: ${rebalanceEpoch}s (${
          Number(rebalanceEpoch) / 60
        } minutes)`,
      );

      if (timeSince > Number(rebalanceEpoch) + 300) {
        console.log(
          `   ⚠️  OVERDUE: Should have rebalanced ${
            timeSince - Number(rebalanceEpoch)
          }s ago`,
        );
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // 3. Check gas bank balance
  console.log('\n3. Checking gas bank balance...');
  try {
    const addressInfo = await rpcCall('get_addresses', [[CONTRACT_ADDRESS]]);
    if (addressInfo && addressInfo.length > 0) {
      const balance = BigInt(addressInfo[0].candidate_balance);
      const balanceMAS = Number(balance) / 1_000_000_000;
      console.log(`   Balance: ${balanceMAS.toFixed(4)} MAS`);

      if (balanceMAS < 2) {
        console.log(
          `   ⚠️  LOW: Below MIN_GAS_BANK_BALANCE (2 MAS) - autonomous may have stopped!`,
        );
      } else {
        console.log(`   ✅ Balance sufficient for autonomous rebalancing`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // 4. Check vault balances
  console.log('\n4. Checking vault token balances...');
  try {
    const result = await rpcCall('execute_read_only_call', [
      {
        target_address: CONTRACT_ADDRESS,
        target_function: 'getBalances',
        parameter: Array.from(new Args().serialize()),
        max_gas: 200_000_000,
        coins: 0,
      },
    ]);

    const args = new Args(Uint8Array.from(result.executed_at.result.ok));
    const totalValueUSDC = args.nextU64();
    const wmasBalance = args.nextU64();
    const wetheBalance = args.nextU64();
    const usdceBalance = args.nextU64();
    const totalShares = args.nextU64();

    console.log(
      `   WMAS: ${wmasBalance} (${Number(wmasBalance) / 1e9} tokens)`,
    );
    console.log(
      `   WETH.e: ${wetheBalance} (${Number(wetheBalance) / 1e18} tokens)`,
    );
    console.log(
      `   USDC.e: ${usdceBalance} (${Number(usdceBalance) / 1e6} tokens)`,
    );
    console.log(`   Total shares: ${totalShares}`);

    // Calculate allocation
    const total =
      Number(wmasBalance) / 1e9 +
      Number(wetheBalance) / 1e18 +
      Number(usdceBalance) / 1e6;
    if (total > 0) {
      const wmasPct = ((Number(wmasBalance) / 1e9 / total) * 100).toFixed(1);
      const wethePct = ((Number(wetheBalance) / 1e18 / total) * 100).toFixed(1);
      const usdcePct = ((Number(usdceBalance) / 1e6 / total) * 100).toFixed(1);
      console.log(
        `   Allocation: ${wmasPct}% WMAS, ${wethePct}% WETH.e, ${usdcePct}% USDC.e`,
      );
      console.log(`   Target: 33% WMAS, 33% WETH.e, 34% USDC.e`);

      if (Number(wmasBalance) === 0 && Number(wetheBalance) === 0) {
        console.log(`   ⚠️  NO REBALANCING YET: Still 100% USDC.e`);
        console.log(`   This confirms deferred call has NOT executed yet`);
      } else {
        console.log(`   ✅ Rebalancing has occurred!`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('\n=== DIAGNOSIS ===\n');
  console.log('If autonomous mode is ENABLED but no rebalancing happened:');
  console.log('  1. Deferred call may not have been registered properly');
  console.log('  2. Massa deferred call system may have issues');
  console.log('  3. Gas bank dropped below 2 MAS threshold');
  console.log('  4. Contract execution failed silently');
  console.log('');
  console.log('WORKAROUND: Try manual trigger:');
  console.log('  - Go to Autonomy page');
  console.log('  - Click "Trigger Rebalance" button');
  console.log('  - This will test if rebalancing logic works');
  console.log('  - Then restart autonomous mode');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
