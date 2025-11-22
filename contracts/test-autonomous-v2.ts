import {
  Account,
  Args,
  JsonRpcProvider,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';

const CONTRACT_ADDRESS =
  'AS12NRvnKGKVrCcCpPyKUcr29bNs9Gb1wzcxShZ5Lnc55BPurWpWB';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);
const contract = new SmartContract(provider, CONTRACT_ADDRESS);

console.log('🤖 Testing Autonomous Rebalancing Mode - v20\n');
console.log('================================================\n');
console.log('📋 Account:', account.address.toString());
console.log('📋 Contract:', CONTRACT_ADDRESS);
console.log('================================================\n');

// Step 1: Top up gas bank
console.log('1️⃣ Topping up gas bank with 1 MAS...');
try {
  const topUpOp = await contract.call(
    'topUpGasBank',
    new Args(),
    { maxCoins: 1_000_000_000 }, // 1 MAS in nanoMAS
  );
  console.log('✅ Gas bank funded!');
  console.log(
    '🔗',
    `https://explorer.massa.net/mainnet/operation/${topUpOp.id}`,
  );
} catch (error) {
  console.error(
    '❌ Gas bank top-up failed:',
    error instanceof Error ? error.message : error,
  );
}

// Step 2: Arm guard
console.log('\n2️⃣ Arming guard...');
try {
  const armOp = await contract.call('setGuard', new Args().addBool(true), {
    maxCoins: 0,
  });
  console.log('✅ Guard armed!');
  console.log('🔗', `https://explorer.massa.net/mainnet/operation/${armOp.id}`);
} catch (error) {
  console.error(
    '❌ Guard arming failed:',
    error instanceof Error ? error.message : error,
  );
}

// Step 3: Trigger first autonomous rebalance
console.log('\n3️⃣ Triggering FIRST AUTONOMOUS REBALANCE...');
console.log('   This will:');
console.log('   - Read token balances');
console.log('   - Calculate drift');
console.log('   - Execute swap if needed');
console.log('   - Schedule NEXT autonomous rebalance ⭐\n');

try {
  const rebalanceOp = await contract.call('rebalance', new Args(), {
    maxCoins: 50_000_000, // 0.05 MAS for storage
    maxGas: BigInt(500_000_000), // 500M gas for complex operations
  });

  console.log('📋 Rebalance operation:', rebalanceOp);
  console.log('⏳ Waiting 30 seconds for finality...\n');

  // Wait for operation to be final
  await new Promise((resolve) => setTimeout(resolve, 30000));

  // Get events
  console.log('📊 Fetching events...\n');
  const events = await provider.getEvents({
    operationId: rebalanceOp.id,
  });

  console.log('================================================');
  console.log('📊 Events Emitted:');
  console.log('================================================\n');

  let hasAutonomousScheduled = false;
  let hasDriftCalculated = false;
  let hasSwap = false;

  for (const event of events) {
    console.log('  📋', event.data);

    if (event.data.includes('AutonomousRebalanceScheduled')) {
      hasAutonomousScheduled = true;
    }
    if (event.data.includes('DriftCalculated')) {
      hasDriftCalculated = true;
    }
    if (event.data.includes('SwapExecuted')) {
      hasSwap = true;
    }
  }

  console.log('\n================================================');
  console.log('🎯 AUTONOMOUS MODE STATUS');
  console.log('================================================\n');

  if (hasAutonomousScheduled) {
    console.log('✅ AUTONOMOUS SCHEDULING WORKING!');
    console.log('   🤖 Next rebalance will trigger automatically');
    console.log('   ⏰ Check Activity page in 30 minutes');
  } else {
    console.log('⚠️  Autonomous scheduling not triggered');
    console.log('   Reasons: Gas bank < 0.1 MAS or no deposits');
  }

  if (hasDriftCalculated) {
    console.log('\n✅ Drift calculation working');
  }

  if (hasSwap) {
    console.log('✅ DEX swap executed successfully');
  } else {
    console.log('ℹ️  No swap (drift below 500 bps or no deposits)');
  }

  console.log('\n================================================');
  console.log('🔗 VIEW ON EXPLORER:');
  console.log('================================================');
  console.log(`https://explorer.massa.net/mainnet/operation/${rebalanceOp.id}`);
  console.log('\n🎉 TEST COMPLETE!\n');
  console.log('📝 Next Steps:');
  console.log('   1. Open frontend: http://localhost:5173');
  console.log('   2. Check Activity page for events');
  console.log('   3. Wait 30 minutes - check for autonomous rebalance');
  console.log('   4. Monitor gas bank balance in Settings');
  console.log('   5. Document rebalances for hackathon\n');
} catch (error) {
  console.error(
    '\n❌ Rebalance failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
