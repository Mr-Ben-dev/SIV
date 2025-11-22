import { Account, JsonRpcProvider } from '@massalabs/massa-web3';
import 'dotenv/config';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);

const CONTRACT_ADDRESS = 'AS1iukrtMDBPvoxzjnRTkfmawo34JHHv7dPoacaCpPY7pNksoxUu';

console.log('='.repeat(60));
console.log('🔍 Fetching events from contract:', CONTRACT_ADDRESS);
console.log('='.repeat(60));

try {
  // Get events from the contract using RPC method
  const response = await fetch('https://mainnet.massa.net/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'get_filtered_sc_output_event',
      params: [
        {
          start: null,
          end: null,
          emitter_address: CONTRACT_ADDRESS,
          original_caller_address: null,
          original_operation_id: null,
          is_final: true,
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch events');
  }

  const events = data.result || [];

  console.log(`\nFound ${events.length} events:\n`);

  // Sort by slot (newest first)
  events.sort((a, b) => {
    const slotA = a.context?.slot?.period || 0;
    const slotB = b.context?.slot?.period || 0;
    return slotB - slotA;
  });

  // Display each event
  for (const event of events) {
    const data = event.data || '';
    const colonIndex = data.indexOf(':');

    let type = 'Unknown';
    let jsonData = '';

    if (colonIndex > 0) {
      type = data.substring(0, colonIndex);
      jsonData = data.substring(colonIndex + 1);
    } else {
      jsonData = data;
    }

    const slot = event.context?.slot?.period || 0;
    const timestamp = event.context?.slot?.timestamp
      ? new Date(event.context.slot.timestamp).toLocaleString()
      : 'Unknown';
    const opId = event.context?.origin_operation_id || 'N/A';

    console.log(`Event: ${type}`);
    console.log(`  Slot: ${slot}`);
    console.log(`  Time: ${timestamp}`);
    console.log(`  OpID: ${opId}`);
    console.log(`  Data: ${jsonData}`);
    console.log('');
  }

  if (events.length === 0) {
    console.log('⚠️  No events found. Possible reasons:');
    console.log('  - Contract has not emitted any events yet');
    console.log('  - Events have expired (they only last ~30-60 minutes)');
    console.log('  - Wrong contract address');
  }
} catch (error) {
  console.error('❌ Error fetching events:', error);
}
