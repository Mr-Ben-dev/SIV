import { Account, Args, JsonRpcProvider } from '@massalabs/massa-web3';
import 'dotenv/config';

const CONTRACT_ADDRESS =
  'AS12e5Pc2twKu8NkPaD9EtMjuE5Uhdo7nhqngirjhV6t32hWntBer';

async function testRebalance() {
  try {
    console.log('🧪 Testing Rebalance Function');
    console.log('================================\n');

    const account = await Account.fromEnv();
    const provider = JsonRpcProvider.mainnet(account);

    console.log('Account:', account.address);
    console.log('Contract:', CONTRACT_ADDRESS);
    console.log('\n📞 Calling startAutonomousRebalancing()...\n');

    // Call startAutonomousRebalancing (no args needed)
    const args = new Args();
    const result = await provider.executeSC({
      targetAddress: CONTRACT_ADDRESS,
      functionName: 'startAutonomousRebalancing',
      parameter: args,
      maxCoins: 0n,
    });

    console.log('✅ Success!');
    console.log('Operation ID:', result.operation_id);
    console.log('\n🔗 View on explorer:');
    console.log(`https://explorer.massa.net/operation/${result.operation_id}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('VM Error')) {
      console.error('\n💡 This is a smart contract execution error.');
      console.error('Check if:');
      console.error('- Contract has deposits');
      console.error('- Gas bank is funded');
      console.error('- Guard is armed for depositor');
    }
  }
}

testRebalance();
