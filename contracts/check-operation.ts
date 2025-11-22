import { Account, JsonRpcProvider } from '@massalabs/massa-web3';
import 'dotenv/config';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);

const OPERATION_ID = 'O1bUo8RRzK2PdgkWXFPq2oqeCQcz5c1NQCfqfyszAUZkwXc2fqT';

console.log('='.repeat(60));
console.log('🔍 Checking operation details:', OPERATION_ID);
console.log('='.repeat(60));

try {
  const response = await fetch('https://mainnet.massa.net/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'get_operations',
      params: [[OPERATION_ID]],
    }),
  });

  const data = await response.json();
  console.log('\nOperation Result:');
  console.log(JSON.stringify(data.result, null, 2));
} catch (error) {
  console.error('Error:', error);
}
