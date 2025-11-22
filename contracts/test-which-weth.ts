import {
  Account,
  Args,
  JsonRpcProvider,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';

const FACTORY_ADDRESS = 'AS127Lxdux4HCUkZL89SrRYR5kq2u8t64Jt3aYj786t6fBF1cZGcu';
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9';
const WETH_E_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY'; // WETH-e (Ethereum)
const WETH_B_ADDRESS = 'AS125oPLYRTtfVjpWisPZVTLjBhCFfQ1jDsi75XNtRm1NZux54eCj'; // WETH-b (Binance)
const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);
const factory = new SmartContract(provider, FACTORY_ADDRESS);

console.log('🔍 Checking WHICH WETH has liquidity pairs\n');
console.log('================================================\n');

// Check WMAS/WETH-e pair
console.log('1️⃣ Checking WMAS/WETH-e (Ethereum bridge)...');
try {
  const result1 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(WMAS_ADDRESS).addString(WETH_E_ADDRESS),
  );
  const binSteps = new Uint8Array(result1.value);
  if (binSteps.length > 0) {
    console.log(`✅ WMAS/WETH-e EXISTS - bin step: ${binSteps[0]}`);
  } else {
    console.log('❌ WMAS/WETH-e does NOT exist');
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
}

// Check WMAS/WETH-b pair
console.log('\n2️⃣ Checking WMAS/WETH-b (Binance bridge)...');
try {
  const result2 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(WMAS_ADDRESS).addString(WETH_B_ADDRESS),
  );
  const binSteps = new Uint8Array(result2.value);
  if (binSteps.length > 0) {
    console.log(`✅ WMAS/WETH-b EXISTS - bin step: ${binSteps[0]}`);
  } else {
    console.log('❌ WMAS/WETH-b does NOT exist');
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
}

// Check USDC/WETH-e pair
console.log('\n3️⃣ Checking USDC/WETH-e (Ethereum bridge)...');
try {
  const result3 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(USDC_ADDRESS).addString(WETH_E_ADDRESS),
  );
  const binSteps = new Uint8Array(result3.value);
  if (binSteps.length > 0) {
    console.log(`✅ USDC/WETH-e EXISTS - bin step: ${binSteps[0]}`);
  } else {
    console.log('❌ USDC/WETH-e does NOT exist');
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
}

// Check USDC/WETH-b pair
console.log('\n4️⃣ Checking USDC/WETH-b (Binance bridge)...');
try {
  const result4 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(USDC_ADDRESS).addString(WETH_B_ADDRESS),
  );
  const binSteps = new Uint8Array(result4.value);
  if (binSteps.length > 0) {
    console.log(`✅ USDC/WETH-b EXISTS - bin step: ${binSteps[0]}`);
  } else {
    console.log('❌ USDC/WETH-b does NOT exist');
  }
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
}

console.log('\n================================================');
console.log('✅ WETH pair analysis complete!');
console.log('\n📝 Recommendation:');
console.log('   Use the WETH variant that has BOTH pairs:');
console.log('   - WMAS/WETH (for multi-hop routing)');
console.log('   - OR USDC/WETH (for direct swaps)');
