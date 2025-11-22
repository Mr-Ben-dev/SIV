import { formatLargeUSDValue, formatUSDPrice } from "@/adapters/priceFeed";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { usePrices, useVaultUSDValue } from "@/hooks/usePrices";
import { useVault } from "@/hooks/useVault";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { formatTokenAmount, parseTokenAmount } from "@/lib/addresses";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Fuel,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const Portfolio = () => {
  const [amount, setAmount] = useState("");
  const [userShares, setUserShares] = useState<bigint>(0n);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exiting, setExiting] = useState(false);
  const { toast } = useToast();
  const { connected, address } = useWallet();
  const {
    config: vaultConfig,
    balances,
    loading,
    error,
    refresh,
    getUserShares,
    depositUSDC,
    redeemShares,
    redeemToUSDC,
    setGuard,
    topUpGasBank,
  } = useVault();

  // Fetch token prices
  const {
    prices,
    loading: pricesLoading,
    refresh: refreshPrices,
  } = usePrices();

  // Calculate vault USD value
  const { usdValue, loading: usdValueLoading } = useVaultUSDValue(balances);

  // Calculate USER's share value (not total vault value)
  const userShareValue = useMemo(() => {
    console.log("userShareValue calculation:", {
      userShares: userShares?.toString(),
      totalShares: balances?.totalShares?.toString(),
      usdValue,
      hasShares: userShares && userShares > 0n,
      hasTotalShares: balances?.totalShares && balances.totalShares > 0n,
    });

    if (!userShares || userShares === 0n || !usdValue || usdValue === 0) {
      console.log("Returning 0 - no shares or no value");
      return 0;
    }

    // Calculate based on user's share proportion
    // userValue = (userShares / totalShares) * totalVaultUSDValue
    if (balances?.totalShares && balances.totalShares > 0n) {
      const shareRatio = Number(userShares) / Number(balances.totalShares);
      const calculatedValue = shareRatio * usdValue;
      console.log("Share calculation:", {
        shareRatio,
        calculation: `${Number(userShares)} / ${Number(
          balances.totalShares
        )} × ${usdValue}`,
        result: calculatedValue,
      });
      return calculatedValue;
    }

    // Fallback: if totalShares not available but user has shares, estimate
    console.log("No totalShares, returning full usdValue:", usdValue);
    return usdValue;
  }, [userShares, usdValue, balances?.totalShares]);

  // Fetch wallet balances
  const { balances: walletBalances, loading: walletLoading } =
    useWalletBalance();

  // Calculate current drift from target weights
  const currentDrift = useMemo(() => {
    if (!balances || !vaultConfig || !usdValue || usdValue < 0.01) {
      // If vault USD value is near zero, no meaningful drift calculation
      return 0;
    }

    // Calculate current weights
    const wmasUsdValue =
      (Number(balances.wmas) / 1_000_000_000) * (prices?.wmas || 0);
    const wetheUsdValue =
      (Number(balances.wethe) / 1_000_000_000_000_000_000) *
      (prices?.wethe || 0);
    const usdceUsdValue = (Number(balances.usdce) / 1_000_000) * 1.0; // USDC.e is always $1

    // Avoid division by zero
    if (usdValue === 0) return 0;

    const currentWmasWeight = (wmasUsdValue / usdValue) * 10000; // in bps
    const currentWetheWeight = (wetheUsdValue / usdValue) * 10000;
    const currentUsdceWeight = (usdceUsdValue / usdValue) * 10000;

    // Target weights in bps (e.g., 3333 = 33.33%)
    const targetWmas = vaultConfig.targetsBps[0];
    const targetWethe = vaultConfig.targetsBps[1];
    const targetUsdce = vaultConfig.targetsBps[2];

    // Calculate max deviation (drift)
    const driftWmas = Math.abs(currentWmasWeight - targetWmas);
    const driftWethe = Math.abs(currentWetheWeight - targetWethe);
    const driftUsdce = Math.abs(currentUsdceWeight - targetUsdce);

    return Math.max(driftWmas, driftWethe, driftUsdce); // Return max drift in bps
  }, [balances, vaultConfig, usdValue, prices]);

  // Refresh vault data and user shares when wallet connects
  useEffect(() => {
    if (connected && address) {
      refresh();
      // Fetch user shares
      getUserShares().then((shares) => {
        setUserShares(shares);
      });
    }
  }, [connected, address, refresh, getUserShares]);

  const vaultData = vaultConfig
    ? [
        {
          name: "WMAS",
          value: vaultConfig.targetsBps[0] / 100,
          color: "hsl(258, 90%, 66%)",
        },
        {
          name: "WETH.e",
          value: vaultConfig.targetsBps[1] / 100,
          color: "hsl(330, 81%, 60%)",
        },
        {
          name: "USDC.e",
          value: vaultConfig.targetsBps[2] / 100,
          color: "hsl(187, 85%, 53%)",
        },
      ]
    : [];

  const handleDeposit = async () => {
    if (!amount || loading) return;

    try {
      const amountBigInt = parseTokenAmount(amount, 6); // USDC.e has 6 decimals
      await depositUSDC(amountBigInt);
      setAmount("");
      // Refresh user shares after deposit
      const shares = await getUserShares();
      setUserShares(shares);
    } catch (err) {
      console.error("Deposit error:", err);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || loading) return;

    try {
      const sharesBigInt = parseTokenAmount(amount, 6);
      await redeemShares(sharesBigInt);
      setAmount("");
      // Refresh user shares after withdraw
      const shares = await getUserShares();
      setUserShares(shares);
    } catch (err) {
      console.error("Withdraw error:", err);
    }
  };

  const handleExitToUSDC = async () => {
    if (!userShares || userShares === 0n) {
      toast({
        title: "No Shares",
        description: "You don't have any shares to redeem",
        variant: "destructive",
      });
      return;
    }

    setExiting(true);
    try {
      await redeemToUSDC(userShares);
      setShowExitDialog(false);
      toast({
        title: "Exit Complete",
        description: "Successfully converted all tokens to USDC",
      });
      // Refresh user shares
      const shares = await getUserShares();
      setUserShares(shares);
    } catch (error) {
      console.error("Exit failed:", error);
    } finally {
      setExiting(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="glass p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your portfolio
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            Manage your vault position and deposits
          </p>
        </div>
        <Button
          onClick={refresh}
          disabled={loading}
          variant="outline"
          size="sm"
          className="press-scale"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="glass p-4 border-danger/20 bg-danger/5">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      {/* Gas Bank Low Warning */}
      {balances?.gasBank &&
        balances.gasBank < 5_000_000_000n && ( // 5 MAS in nanoMAS
          <Alert className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">Low gas bank balance:</span>{" "}
              {(Number(balances.gasBank) / 1e9).toFixed(2)} MAS remaining. Top
              up at least 10 MAS for autonomous rebalancing to continue.
            </AlertDescription>
          </Alert>
        )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Deposit/Withdraw Card */}
        <Card className="glass p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Manage Position</h2>
            <Badge variant="outline" className="font-mono text-xs">
              USDC.e
            </Badge>
          </div>

          <div className="bg-info-muted border border-info/20 rounded-lg p-3">
            <p className="text-xs text-info">
              💡 Deposit USDC.e and the vault automatically diversifies into
              WMAS (33%), WETH.e (33%), and USDC.e (33%) through automated
              rebalancing.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Amount</Label>
                <span className="text-xs text-muted-foreground">
                  Wallet:{" "}
                  {walletBalances
                    ? formatTokenAmount(walletBalances.usdce, 6, 2)
                    : "0.00"}{" "}
                  USDC.e
                  {walletLoading && " (loading...)"}
                </span>
              </div>
              <div className="relative mt-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20 font-mono"
                  disabled={loading}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                  onClick={() =>
                    setAmount(
                      walletBalances
                        ? formatTokenAmount(walletBalances.usdce, 6, 6)
                        : "0"
                    )
                  }
                  disabled={loading || !walletBalances}
                >
                  MAX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your shares:{" "}
                <span className="font-mono">
                  {formatTokenAmount(userShares, 6)}
                </span>
              </p>
            </div>

            <div className="bg-warning-muted border border-warning/20 rounded-lg p-3">
              <p className="text-xs text-warning">
                Deposits are subject to 0.3% slippage tolerance and may take up
                to 24h for full rebalancing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleDeposit}
                className="bg-primary hover:bg-primary/90 text-primary-foreground press-scale"
                disabled={!amount || loading}
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                {loading ? "Processing..." : "Deposit"}
              </Button>
              <Button
                onClick={handleWithdraw}
                variant="outline"
                className="border-primary/20 hover:bg-primary/5 press-scale"
                disabled={!amount || loading}
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                {loading ? "Processing..." : "Withdraw"}
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full border-danger/20 hover:bg-danger/5 text-danger press-scale"
              onClick={() => setShowExitDialog(true)}
              disabled={userShares === 0n || loading}
            >
              Exit to USDC
            </Button>
          </div>
        </Card>

        {/* Vault State */}
        <Card className="glass p-6 space-y-6">
          <h2 className="text-xl font-semibold">Target vs Current Weights</h2>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vaultData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {vaultData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Drift from Target</span>
              <span className="font-mono text-warning">
                {usdValue && usdValue < 0.01
                  ? "Pending"
                  : currentDrift > 0
                  ? `${(currentDrift / 100).toFixed(1)}%`
                  : "0.0%"}
              </span>
            </div>
            <Progress
              value={Math.min(currentDrift / 100, 10)} // Cap at 10% for display
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {usdValue && usdValue < 0.01
                ? "⏳ Waiting for first rebalancing"
                : currentDrift < 500
                ? "✓ Within acceptable range"
                : "⚠ Rebalance recommended"}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Total Portfolio Value */}
        <Card className="glass p-6 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-5 h-5 text-success" />
            <Badge variant="outline" className="text-xs">
              {usdValueLoading ? "Loading..." : "Live"}
            </Badge>
          </div>
          <h3 className="font-semibold mb-2">Total Value</h3>
          <p className="text-2xl font-mono text-success">
            {userShareValue ? formatLargeUSDValue(userShareValue) : "$0.00"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {userShares === 0n ? (
              "No shares deposited yet"
            ) : balances && prices ? (
              <>Your share of vault holdings</>
            ) : (
              "Fetching prices..."
            )}
          </p>
        </Card>

        {/* Risk-Off Status */}
        <Card className="glass p-6 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <Shield className="w-5 h-5 text-success" />
            <Badge
              className={
                vaultConfig?.guardArmed
                  ? "badge-danger text-xs"
                  : "badge-success text-xs"
              }
            >
              {vaultConfig?.guardArmed ? "Armed" : "Disarmed"}
            </Badge>
          </div>
          <h3 className="font-semibold mb-2">Risk-Off Guard</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {vaultConfig?.guardArmed
              ? "Protection active • Monitoring volatility"
              : "Guard disarmed • Normal operation"}
          </p>
          <Button
            onClick={() => vaultConfig && setGuard(!vaultConfig.guardArmed)}
            size="sm"
            variant="outline"
            className="text-xs press-scale w-full"
            disabled={loading || !vaultConfig}
          >
            {vaultConfig?.guardArmed ? "Disarm" : "Arm"} Guard
          </Button>
        </Card>

        {/* Gas Bank */}
        <Card className="glass p-6 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <Fuel className="w-5 h-5 text-complement" />
            <Button
              onClick={() => topUpGasBank(1000000000n)} // 1 MAS
              size="sm"
              variant="outline"
              className="text-xs press-scale"
              disabled={loading}
            >
              Refill
            </Button>
          </div>
          <h3 className="font-semibold mb-2">Gas Bank</h3>
          <p className="text-sm font-mono text-complement">
            {balances ? formatTokenAmount(balances.gasBank, 9) : "0.0"} MAS
          </p>
          {prices && balances && (
            <p className="text-xs text-muted-foreground mt-1">
              ≈{" "}
              {formatUSDPrice(
                (Number(balances.gasBank) / 1_000_000_000) * prices.wmas
              )}
            </p>
          )}
        </Card>
      </div>

      {/* Vault Token Holdings */}
      <Card className="glass p-6">
        <h2 className="text-xl font-semibold mb-4">Vault Holdings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* WMAS */}
          <div className="flex flex-col p-4 border rounded-lg">
            <span className="text-sm text-muted-foreground mb-1">WMAS</span>
            <span className="text-lg font-mono">
              {balances ? formatTokenAmount(balances.wmas, 9, 4) : "0.0000"}
            </span>
            {prices && balances && (
              <span className="text-xs text-muted-foreground mt-1">
                ≈{" "}
                {formatUSDPrice(
                  (Number(balances.wmas) / 1_000_000_000) * prices.wmas
                )}
              </span>
            )}
          </div>

          {/* WETH.e */}
          <div className="flex flex-col p-4 border rounded-lg">
            <span className="text-sm text-muted-foreground mb-1">WETH.e</span>
            <span className="text-lg font-mono">
              {balances ? formatTokenAmount(balances.wethe, 18, 6) : "0.000000"}
            </span>
            {prices && balances && (
              <span className="text-xs text-muted-foreground mt-1">
                ≈{" "}
                {formatUSDPrice(
                  (Number(balances.wethe) / 1_000_000_000_000_000_000) *
                    prices.wethe
                )}
              </span>
            )}
          </div>

          {/* USDC.e */}
          <div className="flex flex-col p-4 border rounded-lg">
            <span className="text-sm text-muted-foreground mb-1">USDC.e</span>
            <span className="text-lg font-mono">
              {balances ? formatTokenAmount(balances.usdce, 6, 4) : "0.0000"}
            </span>
            {prices && balances && (
              <span className="text-xs text-muted-foreground mt-1">
                ≈ {formatUSDPrice(Number(balances.usdce) / 1_000_000)}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Wallet Balances Card */}
      <Card className="glass p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Wallet Balances</h2>
          <Button
            onClick={() => {
              refresh();
              refreshPrices();
            }}
            disabled={walletLoading}
            variant="outline"
            size="sm"
            className="press-scale"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${walletLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Wallet Total Value */}
        <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Wallet Total Value
            </span>
            {walletLoading && (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
          <p className="text-3xl font-bold mt-2">
            {walletBalances
              ? formatLargeUSDValue(walletBalances.totalUSD)
              : "$0.00"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sum of all your wallet token balances
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {/* MAS Balance */}
          <div className="p-4 bg-card-muted rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">MAS</span>
              <Badge variant="secondary" className="text-xs">
                Native
              </Badge>
            </div>
            <p className="text-xl font-mono">
              {walletBalances
                ? formatTokenAmount(walletBalances.mas, 9, 4)
                : "0.0000"}
            </p>
            {prices && walletBalances && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈{" "}
                {formatUSDPrice(
                  (Number(walletBalances.mas) / 1_000_000_000) * prices.wmas
                )}
              </p>
            )}
          </div>

          {/* WMAS Balance */}
          <div className="p-4 bg-card-muted rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">WMAS</span>
              <Badge variant="secondary" className="text-xs">
                MRC-20
              </Badge>
            </div>
            <p className="text-xl font-mono">
              {walletBalances
                ? formatTokenAmount(walletBalances.wmas, 9, 4)
                : "0.0000"}
            </p>
            {prices && walletBalances && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈{" "}
                {formatUSDPrice(
                  (Number(walletBalances.wmas) / 1_000_000_000) * prices.wmas
                )}
              </p>
            )}
          </div>

          {/* WETH.e Balance */}
          <div className="p-4 bg-card-muted rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">WETH.e</span>
              <Badge variant="secondary" className="text-xs">
                MRC-20
              </Badge>
            </div>
            <p className="text-xl font-mono">
              {walletBalances
                ? formatTokenAmount(walletBalances.wethe, 18, 6)
                : "0.000000"}
            </p>
            {prices && walletBalances && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈{" "}
                {formatUSDPrice(
                  (Number(walletBalances.wethe) / 1_000_000_000_000_000_000) *
                    prices.wethe
                )}
              </p>
            )}
          </div>

          {/* USDC.e Balance */}
          <div className="p-4 bg-card-muted rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">USDC.e</span>
              <Badge variant="secondary" className="text-xs">
                MRC-20
              </Badge>
            </div>
            <p className="text-xl font-mono">
              {walletBalances
                ? formatTokenAmount(walletBalances.usdce, 6, 2)
                : "0.00"}
            </p>
            {prices && walletBalances && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {formatUSDPrice(Number(walletBalances.usdce) / 1_000_000)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-info-muted border border-info/20 rounded-lg">
          <p className="text-xs text-info">
            💰 These are your available wallet balances. Tokens in the vault are
            shown in the "Total Value" card above.
          </p>
        </div>
      </Card>

      {/* Exit to USDC Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit to USDC</DialogTitle>
            <DialogDescription>
              This will redeem all {Number(userShares).toLocaleString()} shares
              and convert all tokens to USDC.e.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>WMAS balance:</span>
              <span>
                {balances ? formatTokenAmount(balances.wmas, 9, 3) : "0"} WMAS
              </span>
            </div>
            <div className="flex justify-between">
              <span>WETH.e balance:</span>
              <span>
                {balances ? formatTokenAmount(balances.wethe, 18, 6) : "0"}{" "}
                WETH.e
              </span>
            </div>
            <div className="flex justify-between">
              <span>USDC.e balance:</span>
              <span>
                {balances ? formatTokenAmount(balances.usdce, 6, 2) : "0"}{" "}
                USDC.e
              </span>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Swaps will use Dusa Router with 0.5% slippage protection. You will
              receive USDC.e.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              disabled={exiting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExitToUSDC}
              disabled={exiting || loading}
            >
              {exiting ? "Exiting..." : "Confirm Exit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Portfolio;
