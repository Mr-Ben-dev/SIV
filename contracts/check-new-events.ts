import 'dotenv/config';

const CONTRACT_ADDRESS = 'AS18R5FmFbLKdEuGA92nvoyg7LfKpACZzms8E5FFrPACHSp6zAVE';

console.log('='.repeat(60));
console.log('🔍 Fetching events from NEW contract:', CONTRACT_ADDRESS);
console.log('='.repeat(60));

try {
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
    const eventData = event.data || '';
    const colonIndex = eventData.indexOf(':');

    let type = 'Unknown';
    let jsonData = '';

    if (colonIndex > 0) {
      type = eventData.substring(0, colonIndex);
      jsonData = eventData.substring(colonIndex + 1);
    } else {
      jsonData = eventData;
    }

    const slot = event.context?.slot?.period || 0;
    const opId = event.context?.origin_operation_id || 'N/A';

    console.log(`Event: ${type}`);
    console.log(`  Slot: ${slot}`);
    console.log(`  OpID: ${opId}`);
    console.log(`  Data: ${jsonData}`);
    console.log('');
  }

  if (events.length === 0) {
    console.log('⚠️  No events found.');
  }
} catch (error) {
  console.error('❌ Error fetching events:', error);
}
