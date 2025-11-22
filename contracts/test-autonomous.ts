/**
 * Test Autonomous Rebalancing Mode - v20
 */
import {
  Args,
  Client,
  ClientFactory,
  DefaultProviderUrls,
  IAccount,
  WalletClient,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '.env') });

const CONTRACT_ADDRESS =
  'AS12JWBDaz6LAQPzD2qbfW34JBtGx2o97v1MHXZCFYMXjneT5LqxW';

async function main() {
  console.log('🤖 Testing Autonomous Rebalancing Mode - v20\n');
  console.log('================================================\n');

  // Setup account
  const account = await WalletClient.getAccountFromSecretKey(
    process.env.PRIVATE_KEY!,
  );
  console.log('📋 Account:', account.address);

  // Setup client
  const client: Client = await ClientFactory.createDefaultClient(
    DefaultProviderUrls.MAINNET,
    true,
    account as IAccount,
  );

  // Step 1: Top up gas bank
  console.log('\n1️⃣ Topping up gas bank with 1 MAS...');
  try {
    const topUpOp = await client.smartContracts().callSmartContract({
      targetAddress: CONTRACT_ADDRESS,
      functionName: 'topUpGasBank',
      parameter: new Args().serialize(),
      maxGas: BigInt(100_000_000),
      coins: BigInt(1_000_000_000), // 1 MAS
    });

    console.log('📋 Top-up operation:', topUpOp);
    await client
      .smartContracts()
      .awaitRequiredOperationStatus(topUpOp, 'FINAL');
    console.log('✅ Gas bank funded with 1 MAS!\n');
    console.log(
      '🔗 View:',
      `https://explorer.massa.net/mainnet/operation/${topUpOp}`,
    );
  } catch (error) {
    console.error('❌ Gas bank top-up failed:', error);
    console.error('   Continuing anyway...\n');
  }

  // Step 2: Arm guard
  console.log('\n2️⃣ Arming guard (required for rebalancing)...');
  try {
    const armArgs = new Args().addBool(true);

    const armOp = await client.smartContracts().callSmartContract({
      targetAddress: CONTRACT_ADDRESS,
      functionName: 'setGuard',
      parameter: armArgs.serialize(),
      maxGas: BigInt(100_000_000),
      coins: BigInt(0),
    });

    console.log('📋 Arm guard operation:', armOp);
    await client.smartContracts().awaitRequiredOperationStatus(armOp, 'FINAL');
    console.log('✅ Guard armed!\n');
    console.log(
      '🔗 View:',
      `https://explorer.massa.net/mainnet/operation/${armOp}`,
    );
  } catch (error) {
    console.error('❌ Guard arming failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
  }

  // Step 3: Make a small test deposit (optional - skip if no USDC approved)
  console.log('\n3️⃣ Skipping deposit (requires manual USDC approval)');
  console.log('   You can deposit via the frontend UI if needed\n');

  // Step 4: Trigger first autonomous rebalance
  console.log('4️⃣ Triggering FIRST AUTONOMOUS REBALANCE...');
  console.log('   This will:');
  console.log('   - Read token balances');
  console.log('   - Calculate drift');
  console.log('   - Execute swap if needed');
  console.log('   - Schedule NEXT autonomous rebalance ⭐\n');

  try {
    const rebalanceOp = await client.smartContracts().callSmartContract({
      targetAddress: CONTRACT_ADDRESS,
      functionName: 'rebalance',
      parameter: new Args().serialize(),
      maxGas: BigInt(700_000_000), // High gas for swap + autonomous scheduling
      coins: BigInt(50_000_000), // 0.05 MAS for storage fees
    });

    console.log('📋 Rebalance operation:', rebalanceOp);
    console.log('⏳ Waiting for execution...\n');

    await client
      .smartContracts()
      .awaitRequiredOperationStatus(rebalanceOp, 'FINAL');

    // Get events
    const events = await client.smartContracts().getFilteredScOutputEvents({
      emitter_address: CONTRACT_ADDRESS,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: rebalanceOp,
      is_final: true,
    });

    console.log('\n✅ REBALANCE EXECUTED!\n');
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
      console.log('   📊 Or watch explorer for contract activity');
    } else {
      console.log('⚠️  Autonomous scheduling not triggered');
      console.log('   Possible reasons:');
      console.log('   - Gas bank insufficient (< 0.1 MAS)');
      console.log('   - Guard not armed');
      console.log('   - No deposits in vault');
    }

    if (hasDriftCalculated) {
      console.log('\n✅ Drift calculation working');
    }

    if (hasSwap) {
      console.log('✅ DEX swap executed successfully');
    } else {
      console.log(
        'ℹ️  No swap executed (drift below threshold or no deposits)',
      );
    }

    console.log('\n================================================');
    console.log('🔗 VIEW ON EXPLORER:');
    console.log('================================================');
    console.log(`https://explorer.massa.net/mainnet/operation/${rebalanceOp}`);
    console.log('\n🎉 TEST COMPLETE!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Open frontend: http://localhost:5173');
    console.log('   2. Check Activity page for events');
    console.log('   3. Wait 30 minutes and check for autonomous rebalance');
    console.log('   4. Monitor gas bank balance');
    console.log('   5. Document rebalances for hackathon submission\n');
  } catch (error) {
    console.error('\n❌ Rebalance failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);
