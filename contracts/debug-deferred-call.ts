/**
 * Debug script to investigate deferred call and event issues
 *
 * This script will:
 * 1. Check if deferred call is registered/executed
 * 2. Verify event emission from the contract
 * 3. Query storage for deferred call ID
 * 4. Calculate expected vs actual trigger times
 */

import { Args, JsonRpcProvider } from '@massalabs/massa-web3';
import 'dotenv/config';

// Contract address
const CONTRACT_ADDRESS =
  'AS12GgBGhc7hyh1N8qCFptHNUAaVD2n7B6Xt9PYPPEn3rLWtBEi8V';

// Transaction that started autonomous rebalancing
const START_TX = 'O1FyCJMRa818UhWKJNM3uwt9aJvb9u5YibNkKm3PoFCSssQSXto';

// Expected parameters
const REBALANCE_EPOCH_SECONDS = 1800; // 30 minutes
const SLOTS_PER_SECOND = 2; // 0.5s per slot

async function main() {
  console.log('=== Massa Deferred Call Debugger ===\n');

  // Initialize provider (no wallet needed for read-only operations)
  const provider = JsonRpcProvider.mainnet();

  console.log('1. Checking contract storage for deferred call ID...');
  try {
    const keys = [stringToBytes('deferred_call_id')];
    const result = await provider.getStorageKeys(CONTRACT_ADDRESS, keys);

    if (result && result.length > 0 && result[0]) {
      const deferredId = bytesToString(result[0]);
      console.log(`   ✓ Deferred call ID found: ${deferredId}`);
    } else {
      console.log('   ✗ No deferred call ID found in storage');
    }
  } catch (error) {
    console.log(`   ✗ Error reading storage: ${error}`);
  }

  console.log('\n2. Fetching ALL events from contract...');
  try {
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
      isFinal: true,
    });

    console.log(`   Found ${events.length} events total`);

    if (events.length === 0) {
      console.log('   ⚠ NO EVENTS FOUND - This is the problem!');
      console.log('   Possible causes:');
      console.log('     - Events are not being emitted by contract');
      console.log('     - Events expired (not stored permanently)');
      console.log("     - RPC node doesn't have event history");
    } else {
      console.log('\n   Recent events:');
      events.slice(-10).forEach((event) => {
        const timestamp = new Date(event.context.slot.timestamp).toISOString();
        console.log(`     [${timestamp}] ${event.data}`);
      });
    }
  } catch (error) {
    console.log(`   ✗ Error fetching events: ${error}`);
  }

  console.log('\n4. Checking operation details...');
  try {
    const operations = await client.publicApi().getOperations([START_TX]);

    if (operations && operations.length > 0) {
      const op = operations[0];
      console.log(`   Status: ${op.is_operation_final ? 'Final' : 'Pending'}`);
      console.log(
        `   Slot: Period ${op.in_blocks[0]?.slot?.period}, Thread ${op.in_blocks[0]?.slot?.thread}`,
      );

      // Calculate expected trigger time
      const startPeriod = op.in_blocks[0]?.slot?.period || 0;
      const targetPeriod =
        startPeriod + REBALANCE_EPOCH_SECONDS * SLOTS_PER_SECOND;
      console.log(`   Start period: ${startPeriod}`);
      console.log(`   Target period: ${targetPeriod}`);

      // Get current period
      const nodeStatus = await client.publicApi().getNodeStatus();
      const currentPeriod = nodeStatus.last_slot.period;
      console.log(`   Current period: ${currentPeriod}`);

      if (currentPeriod > targetPeriod) {
        const periodsPassed = currentPeriod - targetPeriod;
        const secondsPassed = periodsPassed / SLOTS_PER_SECOND;
        console.log(
          `   ⚠ Target period passed ${periodsPassed} periods ago (~${secondsPassed.toFixed(
            0,
          )}s ago)`,
        );
        console.log(`   Deferred call SHOULD have executed by now!`);
      } else {
        const periodsRemaining = targetPeriod - currentPeriod;
        const secondsRemaining = periodsRemaining / SLOTS_PER_SECOND;
        console.log(
          `   ⏳ ${periodsRemaining} periods remaining (~${secondsRemaining.toFixed(
            0,
          )}s)`,
        );
      }
    }
  } catch (error) {
    console.log(`   ✗ Error fetching operation: ${error}`);
  }

  console.log('\n5. Checking contract balance (gas bank)...');
  try {
    const addresses = await client.publicApi().getAddresses([CONTRACT_ADDRESS]);
    if (addresses && addresses.length > 0) {
      const balance = addresses[0].final_balance;
      const balanceMAS = Number(balance) / 1_000_000_000;
      console.log(`   Balance: ${balanceMAS.toFixed(4)} MAS`);

      if (balanceMAS < 0.5) {
        console.log(
          `   ⚠ Low balance! May not have enough for deferred call execution`,
        );
      }
    }
  } catch (error) {
    console.log(`   ✗ Error fetching balance: ${error}`);
  }

  console.log('\n6. Testing direct function calls...');
  try {
    // Try calling isAutonomousScheduled
    const scheduledResult = await client.smartContracts().readSmartContract({
      targetAddress: CONTRACT_ADDRESS,
      targetFunction: 'isAutonomousScheduled',
      parameter: new Args().serialize(),
      maxGas: fromMAS(0.1),
    });

    const isScheduled = new Args(scheduledResult.returnValue).nextBool();
    console.log(`   Autonomous mode enabled: ${isScheduled}`);
  } catch (error) {
    console.log(`   ✗ Error calling contract: ${error}`);
  }

  console.log('\n=== Analysis Complete ===\n');

  console.log('NEXT STEPS:');
  console.log('1. If events.length === 0:');
  console.log('   - Events are ephemeral in Massa and may have expired');
  console.log('   - Check explorer for operation events immediately after tx');
  console.log('   - Consider using async messages instead of deferred calls');
  console.log('');
  console.log('2. If deferred call still exists (not executed):');
  console.log('   - Check gas quote vs balance');
  console.log('   - Verify target slot calculation');
  console.log('   - Check Massa network congestion');
  console.log('');
  console.log(
    "3. If deferred call doesn't exist but no TriggerRebalance event:",
  );
  console.log('   - Deferred call executed but failed');
  console.log('   - Check for error events in explorer');
  console.log('   - Verify triggerRebalance function logic');
}

// Helper functions
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
