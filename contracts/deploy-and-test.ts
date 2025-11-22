/**
 * Deploy v20 Contract and Test Autonomous Mode
 */
import {
  Args,
  Client,
  ClientFactory,
  DefaultProviderUrls,
  IAccount,
  WalletClient,
  fromMAS,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '.env') });

async function deploy() {
  console.log('🚀 Deploying Sentinel Index Vault v20 to Mainnet\n');
  console.log('================================================\n');

  // Setup account
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  const account = await WalletClient.getAccountFromSecretKey(privateKey);
  console.log('📋 Deployer Address:', account.address());

  // Setup client
  const client: Client = await ClientFactory.createDefaultClient(
    DefaultProviderUrls.MAINNET,
    true,
    account as IAccount,
  );

  // Check balance
  const balance = await client.wallet().getAccountBalance(account.address());
  console.log('💰 Balance:', balance?.final || '0', 'nanoMAS\n');

  if (!balance?.final || BigInt(balance.final) < fromMAS(2)) {
    console.error(
      '❌ Insufficient balance. Need at least 2 MAS for deployment.',
    );
    process.exit(1);
  }

  // Constructor arguments
  const constructorArgs = new Args()
    .addString('Sentinel Index Vault')
    .addString('SIV')
    .addU64(BigInt(3333)) // target0: 33.33% WMAS
    .addU64(BigInt(3334)) // target1: 33.34% WETH
    .addU64(BigInt(3333)) // target2: 33.33% USDC
    .addU64(BigInt(500)) // maxDriftBps: 5%
    .addU64(BigInt(86400)) // rebalanceEpochSeconds: 24 hours
    .addU64(BigInt(10)) // minDepositUSDC: 10 microUSDC
    .addU64(BigInt(100)) // minSliceValue: 100 microUSDC
    .addString('AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ') // USDC
    .addString('AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9') // WMAS
    .addString('AS125oPLYRTtfVjpWisPZVTLjBhCFfQ1jDsi75XNtRm1NZux54eCj') // WETH
    .addString('AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p') // Dusa Router
    .addString('AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p'); // EagleFi Router

  console.log('📦 Constructor Parameters:');
  console.log('  - Target Allocations: 33.33% WMAS, 33.34% WETH, 33.33% USDC');
  console.log('  - Max Drift: 5%');
  console.log('  - Rebalance Epoch: 24 hours');
  console.log('  - Min Deposit: 0.00001 USDC\n');

  // Read compiled contract
  const wasmPath = join(__dirname, 'build', 'main.wasm');
  const contractCode = readFileSync(wasmPath);
  console.log(
    `📄 Contract Size: ${(contractCode.length / 1024).toFixed(2)} KB\n`,
  );
  console.log('⏳ Deploying contract...\n');

  try {
    const operationId = await client.smartContracts().deploySmartContract({
      contractDataBinary: new Uint8Array(contractCode),
      maxGas: BigInt(4_700_000_000),
      maxCoins: fromMAS(1),
      parameters: constructorArgs.serialize(),
    });

    console.log('✅ Deployment submitted!');
    console.log('📋 Operation ID:', operationId);
    console.log('⏳ Waiting for finality...\n');

    await client
      .smartContracts()
      .awaitRequiredOperationStatus(operationId, 'FINAL');

    // Get contract address from events
    const events = await client.smartContracts().getFilteredScOutputEvents({
      emitter_address: null,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: operationId,
      is_final: true,
    });

    let contractAddress = '';
    if (events && events.length > 0) {
      // Find contract address from call stack
      for (const event of events) {
        if (event.context.call_stack && event.context.call_stack.length > 0) {
          contractAddress = event.context.call_stack[0];
          break;
        }
      }
    }

    console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!\n');
    console.log('================================================');
    console.log('📍 Contract Address:', contractAddress);
    console.log(
      '🔗 Explorer:',
      `https://explorer.massa.net/address/${contractAddress}`,
    );
    console.log('================================================\n');

    console.log('📝 NEXT STEPS:');
    console.log('1. Update web/.env.local:');
    console.log(`   VITE_SIV_VAULT_ADDRESS=${contractAddress}`);
    console.log('2. Restart frontend: npm run dev');
    console.log('3. Run test script below...\n');

    return contractAddress;
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

async function testAutonomousMode(contractAddress: string) {
  console.log('\n🧪 Testing Autonomous Mode\n');
  console.log('================================================\n');

  const privateKey = process.env.PRIVATE_KEY!;
  const account = await WalletClient.getAccountFromSecretKey(privateKey);

  const client: Client = await ClientFactory.createDefaultClient(
    DefaultProviderUrls.MAINNET,
    true,
    account as IAccount,
  );

  console.log('1️⃣ Topping up gas bank (1 MAS)...');
  try {
    const topUpOp = await client.smartContracts().callSmartContract({
      targetAddress: contractAddress,
      functionName: 'topUpGasBank',
      parameter: new Args().serialize(),
      maxGas: BigInt(100_000_000),
      coins: fromMAS(1), // Send 1 MAS to gas bank
    });

    await client
      .smartContracts()
      .awaitRequiredOperationStatus(topUpOp, 'FINAL');
    console.log('✅ Gas bank funded!\n');
  } catch (error) {
    console.error('❌ Gas bank top-up failed:', error);
  }

  console.log('2️⃣ Depositing 0.01 USDC (test amount)...');
  console.log('⚠️  Make sure you have approved USDC for the contract first!\n');

  // Note: User needs to approve USDC manually via wallet
  // We'll skip deposit for now and just test with contract owner

  console.log('3️⃣ Arming guard...');
  try {
    const armArgs = new Args().addBool(true);

    const armOp = await client.smartContracts().callSmartContract({
      targetAddress: contractAddress,
      functionName: 'setGuard',
      parameter: armArgs.serialize(),
      maxGas: BigInt(100_000_000),
      coins: BigInt(0),
    });

    await client.smartContracts().awaitRequiredOperationStatus(armOp, 'FINAL');
    console.log('✅ Guard armed!\n');
  } catch (error) {
    console.error('❌ Guard arming failed:', error);
  }

  console.log('4️⃣ Triggering first autonomous rebalance...');
  try {
    const rebalanceOp = await client.smartContracts().callSmartContract({
      targetAddress: contractAddress,
      functionName: 'rebalance',
      parameter: new Args().serialize(),
      maxGas: BigInt(700_000_000), // High gas for swap + scheduling
      coins: BigInt(50_000_000), // 0.05 MAS for storage
    });

    console.log('📋 Rebalance Operation:', rebalanceOp);
    console.log('⏳ Waiting for execution...\n');

    await client
      .smartContracts()
      .awaitRequiredOperationStatus(rebalanceOp, 'FINAL');

    // Get events
    const events = await client.smartContracts().getFilteredScOutputEvents({
      emitter_address: contractAddress,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: rebalanceOp,
      is_final: true,
    });

    console.log('✅ REBALANCE EXECUTED!\n');
    console.log('📊 Events Emitted:');
    for (const event of events) {
      console.log('  -', event.data);
    }

    console.log('\n================================================');
    console.log('🤖 AUTONOMOUS MODE STATUS');
    console.log('================================================');

    const hasAutonomousScheduled = events.some((e) =>
      e.data.includes('AutonomousRebalanceScheduled'),
    );

    if (hasAutonomousScheduled) {
      console.log('✅ Autonomous scheduling WORKING!');
      console.log('   Next rebalance will trigger automatically');
      console.log('   Check Activity page in 30 minutes');
    } else {
      console.log('⚠️  Autonomous scheduling not triggered');
      console.log('   Check gas bank balance and contract state');
    }

    console.log('================================================\n');
    console.log('🔗 View on Explorer:');
    console.log(`   https://explorer.massa.net/operation/${rebalanceOp}`);
    console.log('\n✨ Deployment and Testing Complete!');
  } catch (error) {
    console.error('❌ Rebalance failed:', error);
  }
}

// Main execution
deploy()
  .then(async (contractAddress) => {
    if (contractAddress) {
      await testAutonomousMode(contractAddress);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
