import { Args } from '@massalabs/massa-web3';

const VAULT_ADDRESS = 'AS1vq6bHTGjaNCXc8yeHHpf3jtgnBCRJUFsevzYZR54FQJaYSKiS'; // Deployment #14 - Fixed getBalances()

console.log('🔍 Checking vault internal state...\n');
console.log('='.repeat(60));

// Get total shares from vault
async function getVaultData() {
  try {
    const emptyArgs = new Args().serialize();
    const response = await fetch('https://mainnet.massa.net/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'execute_read_only_call',
        params: [
          [
            {
              max_gas: 1000000000,
              target_address: VAULT_ADDRESS,
              target_function: 'getBalances',
              parameter: emptyArgs,
              caller_address: VAULT_ADDRESS,
            },
          ],
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('RPC error:', data.error);
      return null;
    }

    if (data.result && data.result[0]?.result?.Ok) {
      const resultBytes = data.result[0].result.Ok;
      const args = new Args(resultBytes);

      const totalValueUSDC = args.nextU64();
      const wmasBalance = args.nextU64();
      const wetheBalance = args.nextU64();
      const usdceBalance = args.nextU64();
      const totalShares = args.nextU64();

      return {
        totalValueUSDC,
        wmasBalance,
        wetheBalance,
        usdceBalance,
        totalShares,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching vault data:', error);
    return null;
  }
}

const vaultData = await getVaultData();

if (vaultData) {
  console.log('\n📊 VAULT INTERNAL STATE (from getBalances()):\n');
  console.log(
    `Total Value (USDC):   ${vaultData.totalValueUSDC} units (${(
      Number(vaultData.totalValueUSDC) / 1e6
    ).toFixed(6)} USDC)`,
  );
  console.log(
    `WMAS Balance:         ${vaultData.wmasBalance} units (${(
      Number(vaultData.wmasBalance) / 1e9
    ).toFixed(9)} WMAS)`,
  );
  console.log(
    `WETH Balance:         ${vaultData.wetheBalance} units (${(
      Number(vaultData.wetheBalance) / 1e18
    ).toFixed(18)} WETH)`,
  );
  console.log(
    `USDC Balance:         ${vaultData.usdceBalance} units (${(
      Number(vaultData.usdceBalance) / 1e6
    ).toFixed(6)} USDC)`,
  );
  console.log(`Total Shares:         ${vaultData.totalShares} units`);

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 ANALYSIS:\n');

  if (vaultData.totalShares > 0) {
    console.log(
      `✅ Vault has ${vaultData.totalShares} shares (${(
        Number(vaultData.totalShares) / 1e6
      ).toFixed(6)} USDC worth)`,
    );
    console.log(
      `   This means someone deposited ${(
        Number(vaultData.totalShares) / 1e6
      ).toFixed(6)} USDC`,
    );

    if (vaultData.wmasBalance === 0n && vaultData.wetheBalance === 0n) {
      console.log(
        '\n⚠️  WARNING: getBalances() returns HARDCODED ZEROS for WMAS/WETH!',
      );
      console.log(
        '   The contract function does NOT read actual token balances.',
      );
      console.log('   Check line 1014-1017 in main.ts:');
      console.log('   ```');
      console.log('   const wmasBalance: u64 = 0;  // <-- HARDCODED!');
      console.log('   const wethBalance: u64 = 0;  // <-- HARDCODED!');
      console.log('   ```');
      console.log(
        '\n   This is why the frontend shows 0 balances even after swaps!',
      );
    }
  } else {
    console.log('❌ No shares in vault - no deposits recorded');
  }
} else {
  console.log('❌ Failed to fetch vault data');
}

// Now check actual token balances via token contracts
console.log('\n' + '='.repeat(60));
console.log('\n📊 ACTUAL TOKEN BALANCES (from token contracts):\n');

const USDC_ADDRESS = 'AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ';
const WMAS_ADDRESS = 'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9';
const WETH_ADDRESS = 'AS124vf3YfAJCSCQVYKczzuWWpXrximFpbTmX4rheLs5uNSftiiRY';

async function getRealBalance(
  tokenAddress: string,
  symbol: string,
  decimals: number,
) {
  try {
    const response = await fetch('https://mainnet.massa.net/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'execute_read_only_call',
        params: [
          [
            {
              max_gas: 1000000000,
              target_address: tokenAddress,
              target_function: 'balanceOf',
              parameter: new Args().addString(VAULT_ADDRESS).serialize(),
              caller_address: VAULT_ADDRESS,
            },
          ],
        ],
      }),
    });

    const data = await response.json();

    if (data.result && data.result[0]?.result?.Ok) {
      const resultBytes = data.result[0].result.Ok;
      const args = new Args(resultBytes);
      const balance = args.nextU256();
      return balance;
    }
    return 0n;
  } catch {
    return 0n;
  }
}

const usdcReal = await getRealBalance(USDC_ADDRESS, 'USDC', 6);
const wmasReal = await getRealBalance(WMAS_ADDRESS, 'WMAS', 9);
const wethReal = await getRealBalance(WETH_ADDRESS, 'WETH', 18);

console.log(
  `USDC:  ${usdcReal} units (${(Number(usdcReal) / 1e6).toFixed(6)} USDC)`,
);
console.log(
  `WMAS:  ${wmasReal} units (${(Number(wmasReal) / 1e9).toFixed(9)} WMAS)`,
);
console.log(
  `WETH:  ${wethReal} units (${(Number(wethReal) / 1e18).toFixed(18)} WETH)`,
);

console.log('\n' + '='.repeat(60));
console.log('\n🎯 VERDICT:\n');

if (vaultData && vaultData.totalShares > 0) {
  if (usdcReal > 0n || wmasReal > 0n || wethReal > 0n) {
    console.log('✅ TOKENS ARE IN THE VAULT! The deposit worked!');
    console.log('   But getBalances() returns hardcoded 0s for WMAS/WETH.');
    console.log(
      '\n🔧 FIX NEEDED: Implement actual token balance reading in getBalances()',
    );
  } else {
    console.log('⚠️  Shares exist but no tokens found.');
    console.log(
      '   Tokens may have been: withdrawn, swapped away, or used for gas',
    );
  }
} else {
  console.log('❌ No shares = no deposits recorded in vault');
}

console.log('\n');
