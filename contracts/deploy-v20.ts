// Deploy v20 - Production-Ready Contract with Autonomous Rebalancing
import { Args, fromMAS } from '@massalabs/massa-web3';
import { readFileSync } from 'fs';
import { getScClient } from './src/utils';

async function deploy() {
  console.log('🚀 Deploying Sentinel Index Vault v20 - Production Ready');
  console.log('================================================\n');

  // Get client with wallet
  const client = await getScClient();
  const deployer = await client.wallet().getBaseAccount();

  if (!deployer) {
    console.error('❌ No wallet account found. Check your .env file.');
    process.exit(1);
  }

  console.log('📍 Deployer address:', deployer.address());
  console.log('💰 Checking balance...\n');

  // Constructor arguments
  const constructorArgs = new Args()
    .addString('Sentinel Index Vault') // name
    .addString('SIV') // symbol
    .addU64(BigInt(3333)) // target0: 33.33% WMAS
    .addU64(BigInt(3334)) // target1: 33.34% WETH
    .addU64(BigInt(3333)) // target2: 33.33% USDC
    .addU64(BigInt(500)) // maxDriftBps: 5%
    .addU64(BigInt(86400)) // rebalanceEpochSeconds: 24 hours
    .addU64(BigInt(10)) // minDepositUSDC: 10 microUSDC (0.00001 USDC)
    .addU64(BigInt(100)) // minSliceValue: 100 microUSDC
    .addString('AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ') // USDC address
    .addString('AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9') // WMAS address
    .addString('AS125oPLYRTtfVjpWisPZVTLjBhCFfQ1jDsi75XNtRm1NZux54eCj') // WETH address
    .addString('AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p') // Dusa Router
    .addString('AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p'); // EagleFi Router (same as Dusa for now)

  console.log('📦 Constructor Arguments:');
  console.log('  - Name: Sentinel Index Vault');
  console.log('  - Symbol: SIV');
  console.log('  - Target Allocations: 33.33% WMAS, 33.34% WETH, 33.33% USDC');
  console.log('  - Max Drift: 5%');
  console.log('  - Rebalance Epoch: 24 hours');
  console.log('  - Min Deposit: 0.00001 USDC\n');

  // Read compiled contract
  const wasmPath = './build/main.wasm';
  const contractCode = readFileSync(wasmPath);

  console.log(
    `📄 Contract size: ${(contractCode.length / 1024).toFixed(2)} KB\n`,
  );
  console.log('⏳ Deploying contract to mainnet...\n');

  try {
    // Deploy contract
    const operationId = await deployer.deploySmartContract(
      {
        contractCode,
        constructorArgs: constructorArgs.serialize(),
        maxGas: BigInt(4_700_000_000), // 4.7B gas for large contract
        maxCoins: fromMAS(1), // 1 MAS for storage fees
      },
      {
        waitFinalExecution: true,
      },
    );

    console.log('✅ Contract deployed successfully!\n');
    console.log('📋 Deployment Details:');
    console.log('  - Operation ID:', operationId);

    // Get contract address from events
    const events = await client.smartContracts().getFilteredScOutputEvents({
      emitter_address: null,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: operationId,
      is_final: true,
    });

    if (events && events.length > 0) {
      // Find contract address from deployment event
      const deployEvent = events.find((e) =>
        e.data.includes('Constructor called'),
      );
      if (deployEvent) {
        console.log('  - Contract Address:', deployEvent.context.call_stack[0]);
        console.log('\n🎯 Next Steps:');
        console.log(
          '  1. Update web/.env.local with new VITE_SIV_VAULT_ADDRESS',
        );
        console.log('  2. Restart frontend: npm run dev');
        console.log('  3. Test deposit → rebalance → withdraw cycle');
        console.log('  4. Verify autonomous rebalancing works');
        console.log(
          '\n💡 Remember to fund gas bank with: topUpGasBank() + 1 MAS',
        );
      }
    }

    console.log(
      '\n🔗 View on Explorer: https://explorer.massa.net/operation/' +
        operationId,
    );
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
