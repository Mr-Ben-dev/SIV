// Deploy v14 - FIXED getBalances() to read ACTUAL token balances
import { Args, fromMAS } from '@massalabs/massa-web3';
import { readFileSync } from 'fs';
import { getScClient } from './src/utils';

async function deploy() {
  console.log('🚀 Deploying SIV v14 - FIXED getBalances()');
  console.log('='.repeat(70));

  const client = await getScClient();
  const deployer = await client.wallet().getBaseAccount();

  if (!deployer) {
    console.error('❌ No wallet account found');
    process.exit(1);
  }

  console.log(`Deployer: ${deployer.address()}\n`);

  // Read compiled bytecode
  const bytecode = readFileSync('./build/main.wasm');
  console.log(`Contract size: ${(bytecode.length / 1024).toFixed(2)} KB\n`);

  // Constructor arguments
  const args = new Args()
    .addString('Smart Investment Vault')
    .addString('SIV')
    .addU64(BigInt(3333)) // 33.33% WMAS
    .addU64(BigInt(3333)) // 33.33% WETH
    .addU64(BigInt(3334)) // 33.34% USDC
    .addU64(BigInt(1000)) // 10% max drift
    .addU64(BigInt(1800)) // 30 min rebalance
    .addU64(BigInt(100000)) // 0.1 USDC min deposit
    .addU64(BigInt(50000)); // 0.05 USDC min slice

  console.log('📦 Parameters:');
  console.log('  - Targets: 33.33% WMAS, 33.33% WETH, 33.34% USDC');
  console.log('  - Max Drift: 10%');
  console.log('  - Rebalance: Every 30 minutes');
  console.log('  - Min Deposit: 0.1 USDC\n');

  try {
    console.log('📤 Deploying...');

    const opId = await deployer.deploySmartContract(
      {
        contractCode: bytecode,
        constructorArgs: args.serialize(),
        maxGas: BigInt(4_700_000_000),
        maxCoins: fromMAS(1),
      },
      {
        waitFinalExecution: true,
      },
    );

    console.log(`✅ Operation: ${opId}`);

    // Get contract address
    const events = await client.smartContracts().getFilteredScOutputEvents({
      emitter_address: null,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: opId,
      is_final: true,
    });

    let contractAddress = '';
    if (events && events.length > 0) {
      const deployEvent = events.find((e) => e.data.includes('Constructor'));
      if (deployEvent) {
        contractAddress = deployEvent.context.call_stack[0];
      }
    }

    console.log(`📝 Contract: ${contractAddress}\n`);
    console.log('🔗 Explorer:', `https://explorer.massa.net/operation/${opId}`);

    console.log('\n💡 KEY FIX:');
    console.log('✅ getBalances() now reads REAL token balances');
    console.log('✅ No more hardcoded zeros!');
    console.log('✅ Frontend will show actual WMAS/WETH/USDC balances\n');

    console.log('🎯 UPDATE .env.local:');
    console.log(`VITE_SIV_VAULT_ADDRESS=${contractAddress}\n`);
  } catch (error) {
    console.error('\n❌ FAILED:', error);
    process.exit(1);
  }
}

deploy();
