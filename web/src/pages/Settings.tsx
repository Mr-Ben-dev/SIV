import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { config } from "@/config/env";
import { useVault } from "@/hooks/useVault";
import { useWalletStore } from "@/store/walletStore";
import {
  Copy,
  ExternalLink,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Shield,
  Sun,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const isConnected = useWalletStore((state) => state.connected);
  const { config: vaultConfig, loading, refresh } = useVault();

  // Contract addresses from config
  const addresses = [
    { label: "Vault Address", value: config.addresses.vault },
    { label: "WMAS Token", value: config.addresses.wmas },
    { label: "WETH.e Token", value: config.addresses.wethe },
    { label: "USDC.e Token", value: config.addresses.usdce },
    { label: "Dusa Router", value: config.addresses.dusaRouter },
    { label: "EagleFi Router", value: config.addresses.eaglefiRouter },
  ];

  // Get vault configuration
  const epochSeconds = vaultConfig?.rebalanceEpochSeconds || 1800;
  const totalSlices = 6; // Fixed in contract
  const maxDriftBps = vaultConfig?.maxDriftBps || 500;
  const targetsBps = vaultConfig?.targetsBps || [3333, 3334, 3333];

  // Format targets as percentages
  const formatTarget = (bps: number) => (bps / 100).toFixed(2) + "%";

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const handleResetCache = () => {
    // Clear localStorage
    localStorage.clear();
    toast.success("Local cache cleared");
    // Reload page to reset state
    setTimeout(() => window.location.reload(), 500);
  };

  // Load config on mount if connected
  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your preferences and view system information
          </p>
        </div>
        {isConnected && (
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Network Info */}
      <Card className="glass p-6 space-y-4">
        <h2 className="text-xl font-semibold">Network</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Network</div>
            <div className="font-semibold text-lg">Massa MAINNET</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              RPC Endpoint
            </div>
            <div className="font-mono text-sm truncate">{config.rpcUrl}</div>
          </div>
        </div>
      </Card>

      {/* Contract Addresses */}
      <Card className="glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Contract Addresses</h2>
          <a
            href={`https://explorer.massa.net/address/${config.addresses.vault}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-complement hover:text-complement/80 transition-colors text-sm flex items-center gap-1"
          >
            View on Explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.label} className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-muted-foreground">
                  {addr.label}
                </Label>
                <div className="font-mono text-sm mt-1">{addr.value}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(addr.value, addr.label)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Vault Configuration */}
      {isConnected ? (
        <Card className="glass p-6 space-y-4">
          <h2 className="text-xl font-semibold">Vault Configuration</h2>

          {loading && !vaultConfig ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-complement" />
              <p className="text-sm text-muted-foreground">
                Loading configuration...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Rebalance Period
                  </div>
                  <div className="font-mono text-lg">
                    {Math.floor(epochSeconds / 60)} minutes
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Slices per Rebalance
                  </div>
                  <div className="font-mono text-lg">{totalSlices}</div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Max Drift Tolerance
                  </div>
                  <div className="font-mono text-lg">
                    {(maxDriftBps / 100).toFixed(2)}%
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Time per Slice
                  </div>
                  <div className="font-mono text-lg">
                    {Math.floor(epochSeconds / totalSlices / 60)} minutes
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Target Weights (Read-Only)
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      WMAS
                    </div>
                    <div className="font-mono text-lg">
                      {formatTarget(targetsBps[0])}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      WETH.e
                    </div>
                    <div className="font-mono text-lg">
                      {formatTarget(targetsBps[1])}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      USDC.e
                    </div>
                    <div className="font-mono text-lg">
                      {formatTarget(targetsBps[2])}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="glass p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Wallet Not Connected</h3>
          <p className="text-muted-foreground">
            Connect your wallet to view vault configuration
          </p>
        </Card>
      )}

      {/* User Preferences */}
      <Card className="glass p-6 space-y-6">
        <h2 className="text-xl font-semibold">Preferences</h2>

        <div className="grid gap-6">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="press-scale"
              >
                <Sun className="w-4 h-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="press-scale"
              >
                <Moon className="w-4 h-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
                className="press-scale"
              >
                <Monitor className="w-4 h-4 mr-2" />
                System
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency Display</Label>
            <Select defaultValue="usd">
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="gbp">GBP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Preference saved locally
            </p>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="glass p-6 space-y-4 border-destructive/20">
        <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>

        <div className="space-y-3">
          <div>
            <Button
              variant="outline"
              className="border-destructive/20 hover:bg-destructive/5 text-destructive press-scale"
              onClick={handleResetCache}
            >
              Reset Local Cache
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will clear all cached data and reload the page. Use only if
              experiencing issues.
            </p>
          </div>
        </div>
      </Card>

      {/* Legal */}
      <Card className="glass p-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Sentinel Index Vault is an experimental DeFi protocol on Massa
          blockchain.
        </p>
        <p className="text-xs text-warning">
          ⚠️ Not financial advice. DeFi carries significant risk of loss. Only
          invest what you can afford to lose.
        </p>
      </Card>
    </div>
  );
};

export default Settings;
