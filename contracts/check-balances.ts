import { Account, Args, JsonRpcProvider } from '@massalabs/massa-web3';
import 'dotenv/config';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.mainnet(account);

const CONTRACT_ADDRESS = 'AS1vq6bHTGjaNCXc8yeHHpf3jtgnBCRJUFsevzYZR54FQJaYSKiS'; // Deployment #14 - Fixed getBalances()
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9'; // Mainnet WMAS
const WETH_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY'; // WETH.e (Ethereum bridge)
const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ'; // USDC.e

console.log('='.repeat(60));
console.log('🔍 Checking token balances for vault:', CONTRACT_ADDRESS);
console.log('='.repeat(60));

async function getTokenBalance(
  tokenAddress: string,
  holderAddress: string,
): Promise<string> {
  try {
    const response = await fetch('https://mainnet.massa.net/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'execute_read_only_call',
        params: [
          {
            max_gas: 1000000000,
            target_address: tokenAddress,
            target_function: 'balanceOf',
            parameter: new Args().addString(holderAddress).serialize(),
            caller_address: holderAddress,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return '0';
    }

    if (data.result && data.result[0]?.result?.Ok) {
      const resultBytes = data.result[0].result.Ok;
      const args = new Args(resultBytes);
      const balance = args.nextU256();
      return balance.toString();
    }

    return '0';
  } catch (error) {
    console.error(`Error fetching balance for ${tokenAddress}:`, error);
    return '0';
  }
}

try {
  console.log('\nFetching vault token balances...\n');

  const [wmasBalance, wethBalance, usdcBalance] = await Promise.all([
    getTokenBalance(WMAS_ADDRESS, CONTRACT_ADDRESS),
    getTokenBalance(WETH_ADDRESS, CONTRACT_ADDRESS),
    getTokenBalance(USDC_ADDRESS, CONTRACT_ADDRESS),
  ]);

  console.log('\nFetching YOUR wallet USDC balance...\n');
  const YOUR_ADDRESS = 'AU12rQ13Pb7B1azLUKzUZJh9vwmtsvMAp6L2kCLeGhpPCdUuJveU';
  const yourUsdcBalance = await getTokenBalance(USDC_ADDRESS, YOUR_ADDRESS);

  console.log('Token Balances in Vault:');
  console.log('------------------------');
  console.log(`WMAS:  ${wmasBalance} (9 decimals)`);
  console.log(`       ${Number(wmasBalance) / 1e9} WMAS`);
  console.log();
  console.log(`WETH:  ${wethBalance} (18 decimals)`);
  console.log(`       ${Number(wethBalance) / 1e18} WETH`);
  console.log();
  console.log(`USDC:  ${usdcBalance} (6 decimals)`);
  console.log(`       ${Number(usdcBalance) / 1e6} USDC`);
  console.log();

  console.log('Your Wallet USDC Balance:');
  console.log('-------------------------');
  console.log(`USDC:  ${yourUsdcBalance} (6 decimals)`);
  console.log(`       ${Number(yourUsdcBalance) / 1e6} USDC`);
  console.log();

  // Calculate rough USD values
  const wmasUSD = (Number(wmasBalance) / 1e9) * 0.06; // $0.06 per WMAS
  const wethUSD = (Number(wethBalance) / 1e18) * 3000; // $3000 per WETH
  const usdcUSD = Number(usdcBalance) / 1e6; // $1 per USDC

  const totalUSD = wmasUSD + wethUSD + usdcUSD;

  console.log('Estimated USD Values:');
  console.log('--------------------');
  console.log(`WMAS:  $${wmasUSD.toFixed(2)}`);
  console.log(`WETH:  $${wethUSD.toFixed(2)}`);
  console.log(`USDC:  $${usdcUSD.toFixed(2)}`);
  console.log(`Total: $${totalUSD.toFixed(2)}`);
  console.log();

  if (totalUSD > 0) {
    const wmasPercent = (wmasUSD / totalUSD) * 100;
    const wethPercent = (wethUSD / totalUSD) * 100;
    const usdcPercent = (usdcUSD / totalUSD) * 100;

    console.log('Current Allocation:');
    console.log('------------------');
    console.log(`WMAS:  ${wmasPercent.toFixed(2)}% (Target: 33.33%)`);
    console.log(`WETH:  ${wethPercent.toFixed(2)}% (Target: 33.33%)`);
    console.log(`USDC:  ${usdcPercent.toFixed(2)}% (Target: 33.34%)`);
    console.log();

    if (wmasPercent > 20 && wethPercent > 20) {
      console.log('✅ Rebalancing DID WORK! Portfolio is diversified.');
    } else if (usdcPercent > 90) {
      console.log('❌ Rebalancing DID NOT WORK! Still 100% USDC.');
    } else {
      console.log('⚠️  Rebalancing partially executed.');
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
}
