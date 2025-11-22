import {
  Account,
  Args,
  JsonRpcProvider,
  MRC20,
  SmartContract,
} from '@massalabs/massa-web3';
import 'dotenv/config';

const CONTRACT_ADDRESS =
  'AS12NRvnKGKVrCcCpPyKUcr29bNs9Gb1wzcxShZ5Lnc55BPurWpWB';
const USDCE_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);
const contract = new SmartContract(provider, CONTRACT_ADDRESS);
const usdce = new MRC20(provider, USDCE_ADDRESS);

console.log('💵 Depositing 0.1 USDC.e to SIV Vault\n');
console.log('================================================');
console.log('Account:', account.address);
console.log('Contract:', CONTRACT_ADDRESS);
console.log('================================================\n');

// Step 1: Approve 0.1 USDC.e
const amount = 100_000; // 0.1 USDC (6 decimals)
console.log('1️⃣ Approving 0.1 USDC.e...');
try {
  const approveOp = await usdce.increaseAllowance(
    CONTRACT_ADDRESS,
    BigInt(amount),
    { maxCoins: 0 },
  );
  console.log('✅ Approval granted!');
  console.log(
    '🔗',
    `https://explorer.massa.net/mainnet/operation/${approveOp.id}`,
  );
  console.log('⏳ Waiting 10 seconds...\n');
  await new Promise((resolve) => setTimeout(resolve, 10000));
} catch (error) {
  console.error(
    '❌ Approval failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}

// Step 2: Deposit
console.log('2️⃣ Depositing 0.1 USDC.e...');
try {
  const depositOp = await contract.call(
    'deposit',
    new Args().addU64(BigInt(amount)),
    { maxCoins: 100_000_000 }, // 0.1 MAS for storage
  );
  console.log('✅ Deposit successful!');
  console.log(
    '🔗',
    `https://explorer.massa.net/mainnet/operation/${depositOp.id}`,
  );
  console.log('⏳ Waiting 20 seconds for finality...\n');
  await new Promise((resolve) => setTimeout(resolve, 20000));

  // Get events
  const events = await provider.getEvents({
    operationId: depositOp.id,
  });

  console.log('================================================');
  console.log('📊 Deposit Events:');
  console.log('================================================\n');

  for (const event of events) {
    console.log('  📋', event.data);
  }

  console.log('\n================================================');
  console.log('✅ DEPOSIT COMPLETE!');
  console.log('================================================');
  console.log('\n📝 Next Step:');
  console.log('   Run test-autonomous-v2.ts to trigger rebalance');
  console.log('   This should now execute a REAL rebalance with swaps!');
} catch (error) {
  console.error(
    '❌ Deposit failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
