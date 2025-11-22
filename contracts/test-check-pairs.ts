import {
  Account,
  Args,
  JsonRpcProvider,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';

const FACTORY_ADDRESS = 'AS127Lxdux4HCUkZL89SrRYR5kq2u8t64Jt3aYj786t6fBF1cZGcu';
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9';
const WETH_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY';
const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);
const factory = new SmartContract(provider, FACTORY_ADDRESS);

console.log('🔍 Checking Available Dusa Pairs\n');
console.log('================================================\n');

// Check USDC/WMAS pair
console.log('1️⃣ Checking USDC/WMAS pair...');
try {
  const result1 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(USDC_ADDRESS).addString(WMAS_ADDRESS),
  );
  console.log('✅ USDC/WMAS bin steps:', result1);
} catch (error) {
  console.error(
    '❌ USDC/WMAS error:',
    error instanceof Error ? error.message : error,
  );
}

// Check USDC/WETH pair
console.log('\n2️⃣ Checking USDC/WETH pair...');
try {
  const result2 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(USDC_ADDRESS).addString(WETH_ADDRESS),
  );
  console.log('✅ USDC/WETH bin steps:', result2);
} catch (error) {
  console.error(
    '❌ USDC/WETH error:',
    error instanceof Error ? error.message : error,
  );
}

// Check WMAS/WETH pair
console.log('\n3️⃣ Checking WMAS/WETH pair...');
try {
  const result3 = await factory.read(
    'getAvailableLBPairBinSteps',
    new Args().addString(WMAS_ADDRESS).addString(WETH_ADDRESS),
  );
  console.log('✅ WMAS/WETH bin steps:', result3);
} catch (error) {
  console.error(
    '❌ WMAS/WETH error:',
    error instanceof Error ? error.message : error,
  );
}

console.log('\n================================================');
console.log('✅ Pair check complete!');
