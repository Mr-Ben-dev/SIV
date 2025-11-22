import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/hooks/useVault";
import { useVaultEvents } from "@/hooks/useVaultEvents";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Fuel,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const Autonomy = () => {
  const { connected: isConnected, address } = useWallet();
  const {
    config,
    balances,
    loading: vaultLoading,
    startAutonomousRebalancing,
    triggerRebalance,
    isAutonomousScheduled,
    refresh: refreshVault,
  } = useVault();

  const {
    events,
    loading: eventsLoading,
    refresh: refreshEvents,
  } = useVaultEvents();

  const [scheduled, setScheduled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Check if user is owner
  const isOwner = config?.owner?.toLowerCase() === address?.toLowerCase();

  // Check scheduled state
  useEffect(() => {
    // Note: isAutonomousScheduled() not available in current contract version
    // Autonomous mode is tracked via events instead
    setScheduled(false); // Manual mode for now
  }, [isConnected]);

  // Handle starting autonomous
  const handleStartAutonomous = async () => {
    if (!isOwner) {
      toast.error("Only the contract owner can start autonomous rebalancing");
      return;
    }

    setStarting(true);
    try {
      await startAutonomousRebalancing();
      toast.success("Autonomous rebalancing started!");
      setTimeout(() => {
        refreshVault();
        refreshEvents();
      }, 2000);
    } catch (error: any) {
      console.error("Failed to start autonomous:", error);
      toast.error(error?.message || "Failed to start autonomous rebalancing");
    } finally {
      setStarting(false);
    }
  };

  // Handle triggering manual rebalance
  const handleTriggerRebalance = async () => {
    if (!isOwner) {
      toast.error("Only the contract owner can trigger rebalancing");
      return;
    }

    setTriggering(true);
    try {
      await triggerRebalance();
      toast.success("Rebalance triggered! Check event log for details.");
      setTimeout(() => {
        refreshVault();
        refreshEvents();
      }, 2000);
    } catch (error: any) {
      console.error("Failed to trigger rebalance:", error);
      toast.error(error?.message || "Failed to trigger rebalance");
    } finally {
      setTriggering(false);
    }
  };

  // Gas bank status
  const gasBankBalance = balances?.gasBank || 0n;
  const gasOK = gasBankBalance >= 100_000_000n; // 0.1 MAS minimum

  // Guard status (from events or config)
  const guardArmed = true; // Default to true for now

  // Health status
  const isHealthy = gasOK && guardArmed && scheduled;

  // Wallet not connected
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Autonomy Center</h1>
          <p className="text-muted-foreground">
            Monitor and control autonomous operations
          </p>
        </div>
        <Card className="glass p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Wallet Not Connected</h3>
          <p className="text-muted-foreground">
            Connect your wallet to view autonomous operations
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Autonomy Center</h1>
          <p className="text-muted-foreground">
            Monitor and control autonomous operations
          </p>
        </div>
        <Button
          onClick={() => {
            refreshVault();
            refreshEvents();
          }}
          variant="outline"
          size="sm"
          disabled={vaultLoading || eventsLoading}
        >
          {vaultLoading || eventsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Health Status */}
      <Card className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">System Health</h2>
          <Badge
            className={
              isHealthy
                ? "bg-success-muted border-success/20 text-success"
                : "bg-warning-muted border-warning/20 text-warning"
            }
          >
            {isHealthy ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Healthy
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Attention Required
              </>
            )}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scheduler Status */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Scheduler</span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {scheduled ? "Active" : "Inactive"}
            </div>
            <div className="text-xs text-muted-foreground">
              {scheduled ? "Rebalancing every 30 min" : "Not started"}
            </div>
          </Card>

          {/* Gas Bank */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Gas Bank</span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {(Number(gasBankBalance) / 1_000_000_000).toFixed(2)} MAS
            </div>
            <div className="text-xs text-muted-foreground">
              {gasOK ? "Sufficient" : "Low - top up needed"}
            </div>
          </Card>

          {/* Risk Guard */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Risk Guard</span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {guardArmed ? "Armed" : "Off"}
            </div>
            <div className="text-xs text-muted-foreground">
              {guardArmed ? "Protecting vault" : "Inactive"}
            </div>
          </Card>
        </div>
      </Card>

      {/* Control Panel */}
      {isOwner && (
        <Card className="glass p-6">
          <h2 className="text-xl font-semibold mb-4">Control Panel</h2>
          <div className="flex gap-3">
            <Button
              onClick={handleStartAutonomous}
              disabled={starting || scheduled || !gasOK || !guardArmed}
              className="bg-complement hover:bg-complement/90"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Start Autonomous Mode
                </>
              )}
            </Button>

            <Button
              onClick={handleTriggerRebalance}
              disabled={triggering || !gasOK}
              variant="outline"
            >
              {triggering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Triggering...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Trigger Rebalance
                </>
              )}
            </Button>
          </div>

          {!scheduled && (!gasOK || !guardArmed) && (
            <Alert className="mt-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {!gasOK && "Gas bank needs at least 0.1 MAS. "}
                {!guardArmed && "Risk guard must be armed. "}
                Complete these requirements before starting.
              </AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      {/* Event Log */}
      <Card className="glass p-6">
        <h2 className="text-xl font-semibold mb-4">Event Log</h2>

        {eventsLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 50).map((e, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{e.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {e.operationId && (
                    <a
                      href={`https://explorer.massa.net/operation/${e.operationId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {e.operationId.slice(0, 8)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <pre className="text-xs text-muted-foreground mt-1 overflow-auto">
                    {JSON.stringify(e.data, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Autonomy;
