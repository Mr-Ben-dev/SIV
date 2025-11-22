import {
  Account,
  Args,
  JsonRpcProvider,
  Mas,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';
import { getScByteCode } from './utils';

// Check for private key
if (!process.env.PRIVATE_KEY) {
  console.error('\n❌ Error: PRIVATE_KEY environment variable not set');
  console.error('\nTo deploy the contract, you need to:');
  console.error('1. Copy .env.example to .env');
  console.error('2. Add your wallet private key to the .env file');
  console.error('3. Make sure your wallet has MAS for deployment fees\n');
  console.error(
    'Alternative: Deploy via the web interface at http://localhost:5173\n',
  );
  process.exit(1);
}

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);

console.log('='.repeat(60));
console.log('🚀 Deploying Smart Investment Vault v23');
console.log('='.repeat(60));
console.log('Network:', 'MAINNET');
console.log('Deployer:', account.address);

const byteCode = getScByteCode('build', 'main.wasm');

// Smart Investment Vault constructor parameters (v23)
const name = 'Smart Investment Vault';
const symbol = 'SIV';
const target0 = 3333; // WMAS 33.33%
const target1 = 3333; // WETH.e 33.33%
const target2 = 3334; // USDC.e 33.34%
const maxDriftBps = 1000; // 10% drift threshold
const rebalanceEpochSeconds = 1800; // 30 minutes
const minDepositUSDC = 500000; // 0.5 USDC.e (6 decimals) - higher for DEX minimum swap amounts
const minSliceValue = 50000; // 0.05 USDC.e minimum per slice

// Token addresses (Massa mainnet)
const usdceAddress = 'AS12tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYerT';
const wmasAddress = 'AS12tAbKwZRkGc7PmZvvDxU3HXBGvZ8nKhQzKvnCZm7XJ9r5hHnYfsU';
const wethbAddress = 'AS12htZRiMNK13ZCQ93qeVswodVFRzHfPycj1b5ykrCVvPUC2Qxsx';

// DEX addresses
const dusaRouterAddress =
  'AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p';
const eaglefiRouterAddress = ''; // Not used

console.log('\nContract Parameters:');
console.log('  Name:', name);
console.log('  Symbol:', symbol);
console.log(
  '  Target Allocations:',
  `${target0}, ${target1}, ${target2}`,
  'bps (33.33%, 33.33%, 33.34%)',
);
console.log('  Max Drift:', maxDriftBps, 'bps (10%)');
console.log('  Rebalance Epoch:', rebalanceEpochSeconds / 60, 'minutes');
console.log('  Min Deposit:', minDepositUSDC / 1000000, 'USDC.e');

const constructorArgs = new Args()
  .addString(name)
  .addString(symbol)
  .addU64(BigInt(target0))
  .addU64(BigInt(target1))
  .addU64(BigInt(target2))
  .addU64(BigInt(maxDriftBps))
  .addU64(BigInt(rebalanceEpochSeconds))
  .addU64(BigInt(minDepositUSDC))
  .addU64(BigInt(minSliceValue))
  .addString(usdceAddress)
  .addString(wmasAddress)
  .addString(wethbAddress)
  .addString(dusaRouterAddress)
  .addString(eaglefiRouterAddress);

console.log('\n📦 Deploying contract...');

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  { coins: Mas.fromString('0.1') }, // Deployment fee
);

console.log('\n✅ Contract deployed successfully!');
console.log('='.repeat(60));
console.log('Contract Address:', contract.address);
console.log('='.repeat(60));

console.log('\n📋 Deployment Events:');
const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('  Event:', event.data);
}

console.log('\n🔗 Next Steps:');
console.log('1. Update VITE_SIV_VAULT_ADDRESS in web/.env');
console.log('2. Deposit tokens to the vault');
console.log('3. Arm the guard (mark depositor as safe)');
console.log('4. Trigger rebalance to test the MVP swap!');
console.log('\n📊 View on Explorer:');
console.log(`https://explorer.massa.net/address/${contract.address}\n`);
