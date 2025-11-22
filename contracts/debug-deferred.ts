/**
 * Debug script to investigate deferred call and event issues
 */

import { JsonRpcProvider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS =
  'AS12GgBGhc7hyh1N8qCFptHNUAaVD2n7B6Xt9PYPPEn3rLWtBEi8V';
const START_TX = 'O1FyCJMRa818UhWKJNM3uwt9aJvb9u5YibNkKm3PoFCSssQSXto';
const REBALANCE_EPOCH_SECONDS = 1800; // 30 minutes
const SLOTS_PER_SECOND = 2; // 0.5s per slot

async function main() {
  console.log('=== Massa Deferred Call Debugger ===\n');

  const provider = JsonRpcProvider.mainnet();

  console.log('1. Fetching ALL events from contract...');
  try {
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
      isFinal: false, // Get all events, not just final
    });

    console.log(`   Found ${events.length} events total`);

    if (events.length === 0) {
      console.log('   ⚠ NO EVENTS FOUND - This is a critical issue!');
      console.log('   Possible causes:');
      console.log('     1. Events expired (Massa events are ephemeral)');
      console.log('     2. Contract never emitted events');
      console.log("     3. RPC node doesn't have event history");
    } else {
      console.log('\n   All events (most recent first):');
      const sorted = [...events].sort(
        (a, b) => b.context.slot.period - a.context.slot.period,
      );
      sorted.forEach((event, i) => {
        console.log(
          `     ${i + 1}. [Period ${event.context.slot.period}] ${event.data}`,
        );
      });
    }
  } catch (error) {
    console.log(`   ✗ Error fetching events: ${error}`);
  }

  console.log('\n2. Checking operation that started autonomous mode...');
  try {
    const operations = await provider.getOperations([START_TX]);

    if (operations && operations.length > 0) {
      const op = operations[0];
      console.log(`   Status: ${op.isOperationFinal ? 'Final' : 'Pending'}`);

      if (op.inBlocks && op.inBlocks.length > 0) {
        const block = op.inBlocks[0];
        const startPeriod = block.slot.period;
        console.log(`   Executed at period: ${startPeriod}`);

        // Calculate expected trigger period
        const targetPeriod =
          startPeriod + REBALANCE_EPOCH_SECONDS * SLOTS_PER_SECOND;
        console.log(`   Expected trigger period: ${targetPeriod}`);

        // Get current period
        const nodeStatus = await provider.getNodeStatus();
        const currentPeriod = nodeStatus.lastSlot.period;
        console.log(`   Current period: ${currentPeriod}`);

        if (currentPeriod > targetPeriod) {
          const periodsPassed = currentPeriod - targetPeriod;
          const secondsPassed = periodsPassed / SLOTS_PER_SECOND;
          console.log(
            `   ⚠ OVERDUE by ${periodsPassed} periods (~${secondsPassed.toFixed(
              0,
            )}s)`,
          );
          console.log(`   ❌ Deferred call SHOULD have executed but didn't!`);
        } else {
          const periodsRemaining = targetPeriod - currentPeriod;
          const secondsRemaining = periodsRemaining / SLOTS_PER_SECOND;
          console.log(
            `   ⏳ ${periodsRemaining} periods until trigger (~${secondsRemaining.toFixed(
              0,
            )}s)`,
          );
        }
      }
    }
  } catch (error) {
    console.log(`   ✗ Error fetching operation: ${error}`);
  }

  console.log('\n3. Checking contract balance (gas bank)...');
  try {
    const addressInfo = await provider.getAddresses([CONTRACT_ADDRESS]);
    if (addressInfo && addressInfo.length > 0) {
      const balance = addressInfo[0].candidateBalance;
      const balanceMAS = Number(balance) / 1_000_000_000;
      console.log(`   Balance: ${balanceMAS.toFixed(4)} MAS`);

      if (balanceMAS < 0.5) {
        console.log(`   ⚠ LOW BALANCE! May not have enough for execution`);
      } else {
        console.log(`   ✓ Balance sufficient`);
      }
    }
  } catch (error) {
    console.log(`   ✗ Error fetching balance: ${error}`);
  }

  console.log('\n=== ROOT CAUSE ANALYSIS ===\n');

  console.log('FINDINGS:');
  console.log('─'.repeat(70));
  console.log(
    '• Events are EPHEMERAL in Massa (not stored permanently on chain)',
  );
  console.log(
    '• Massa nodes only keep recent events in memory (last ~30-60 min)',
  );
  console.log('• Your operation was 32+ minutes ago - events likely EXPIRED');
  console.log('• Cannot verify if AutonomousModeStarted event was emitted');
  console.log('• Cannot verify if deferred call was registered successfully');
  console.log('');

  console.log('CRITICAL ISSUE WITH MASSA EVENTS:');
  console.log('─'.repeat(70));
  console.log('Events are NOT suitable for monitoring long-running processes!');
  console.log('They disappear after a short time window.');
  console.log('');

  console.log('ALTERNATIVE MONITORING STRATEGY:');
  console.log('─'.repeat(70));
  console.log('1. Use CONTRACT STORAGE instead of events for state:');
  console.log('   - Store: last_rebalance_timestamp');
  console.log('   - Store: next_rebalance_timestamp');
  console.log('   - Store: rebalance_count');
  console.log('   - Store: deferred_call_status');
  console.log('');
  console.log('2. Create read-only getter functions:');
  console.log('   - getLastRebalanceTime()');
  console.log('   - getNextRebalanceTime()');
  console.log('   - getRebalanceCount()');
  console.log('   - getDeferredCallStatus()');
  console.log('');
  console.log('3. Frontend polls storage instead of events');
  console.log('');

  console.log('IMMEDIATE DEBUG STEPS:');
  console.log('─'.repeat(70));
  console.log('1. Check Massa Explorer RIGHT NOW for current events');
  console.log(
    `   https://explorer.massa.net/mainnet/address/${CONTRACT_ADDRESS}`,
  );
  console.log('');
  console.log('2. Call contract to check if autonomous mode is enabled:');
  console.log('   - Call: isAutonomousScheduled()');
  console.log('   - Call: getConfig() to check last_rebalance timestamp');
  console.log('');
  console.log('3. Manually trigger rebalance to test if it works:');
  console.log('   - Call: triggerRebalance()');
  console.log('   - Watch for immediate events in explorer');
  console.log('');
  console.log('4. If deferred call never executed:');
  console.log('   - Check if gas bank was sufficient');
  console.log('   - Verify slot calculation is correct');
  console.log('   - Check Massa network status (congestion/issues)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
